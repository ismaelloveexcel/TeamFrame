/**
 * Magic-link callback.
 *
 * Supabase redirects here after the user clicks a magic link. TeamFrame
 * supports both callback shapes:
 *  - recommended: `?token_hash=...&type=magiclink` (email template flow)
 *  - fallback: `?code=...` (Supabase default PKCE flow)
 *
 * On failure (expired link, bad code, etc.), bounce back to /auth with a
 * friendly error code in the query string.
 */

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/db/supabaseServer";
import { resolveIdentity } from "@/lib/rbac/roles";
import { track } from "@/lib/telemetry/track";

const NEXT_ALLOWLIST = ["/dashboard", "/employees", "/org-chart", "/leaves", "/onboarding", "/me"] as const;

type NextResolution = {
  next: string;
  isStale: boolean;
};

function safeNext(raw: string | null): NextResolution {
  if (!raw) return { next: "", isStale: false };
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return { next: "", isStale: true };
  }

  const [rawPathname, search = ""] = raw.split("?");
  const pathname = rawPathname ?? "";
  const isAllowedPath = NEXT_ALLOWLIST.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!isAllowedPath || pathname.startsWith("/auth")) {
    return { next: "", isStale: true };
  }

  return { next: search ? `${pathname}?${search}` : pathname, isStale: false };
}

function defaultNextForRole(role: "admin" | "employee"): string {
  return role === "employee" ? "/me" : "/dashboard";
}

type CookieWipe = "none" | "verifier" | "all";

type PreservedCookie = {
  name: string;
  value: string;
};

function redirectTo(origin: string, path: string, request: NextRequest, wipe: CookieWipe = "none") {
  const response = NextResponse.redirect(`${origin}${path}`);
  if (wipe === "none") return response;
  for (const cookie of request.cookies.getAll()) {
    const name = cookie.name;
    const isVerifier = name.includes("code-verifier");
    const isAuthToken = name.includes("auth-token");
    if (wipe === "verifier" && isVerifier) {
      response.cookies.delete(name);
    } else if (wipe === "all" && (isVerifier || isAuthToken)) {
      response.cookies.delete(name);
    }
  }
  return response;
}

function snapshotAuthCookies(request: NextRequest): PreservedCookie[] {
  return request.cookies
    .getAll()
    .filter((cookie) => cookie.name.includes("auth-token"))
    .map((cookie) => ({ name: cookie.name, value: cookie.value }));
}

function redirectPreservingAuthSession(
  origin: string,
  path: string,
  request: NextRequest,
  preservedAuthCookies: readonly PreservedCookie[],
) {
  const response = redirectTo(origin, path, request, "verifier");
  for (const cookie of preservedAuthCookies) {
    response.cookies.set(cookie.name, cookie.value, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}

type CallbackStage =
  | "supabase_param"
  | "missing_token"
  | "session_exchange"
  | "user_lookup"
  | "identity_resolution";

type CallbackReason =
  | "provider_rejected"
  | "missing_token"
  | "expired_link"
  | "already_used_link"
  | "invalid_link"
  | "stale_return_to"
  | "invalid_tenant"
  | "session_mismatch"
  | "auth_unavailable"
  | "session_exchange_failed"
  | "session_recovered"
  | "identity_not_authorized"
  | "unknown";

function authErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function authErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function authErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

function classifyCallbackFailure(stage: CallbackStage, error: unknown): CallbackReason {
  if (stage === "supabase_param") return "provider_rejected";
  if (stage === "missing_token") return "missing_token";
  if (stage === "identity_resolution") return "identity_not_authorized";

  const code = authErrorCode(error).toLowerCase();
  const message = authErrorMessage(error).toLowerCase();
  const status = authErrorStatus(error);

  if (message.includes("already") && (message.includes("used") || message.includes("consumed"))) {
    return "already_used_link";
  }
  if (message.includes("expired") || code.includes("expired")) return "expired_link";
  if (message.includes("invalid") || message.includes("otp") || code.includes("invalid")) return "invalid_link";
  if (status === 500 || message.includes("service unavailable")) return "auth_unavailable";
  if (stage === "session_exchange") return "session_exchange_failed";
  return "unknown";
}

function logCallbackDiagnostic(input: {
  requestId: string;
  stage: CallbackStage;
  reason: CallbackReason;
  message?: string;
  code?: string;
  status?: number | null;
  hasCode: boolean;
  hasTokenHash: boolean;
  type: string;
  next: string;
}) {
  const payload = {
    request_id: input.requestId,
    stage: input.stage,
    reason: input.reason,
    code: input.code ?? null,
    status: input.status ?? null,
    message: input.message ?? null,
    has_code_param: input.hasCode,
    has_token_hash_param: input.hasTokenHash,
    otp_type: input.type,
    next: input.next || null,
  };

  if (input.reason === "identity_not_authorized") {
    console.warn("AUTH_CALLBACK_DIAGNOSTIC", payload);
    return;
  }
  console.error("AUTH_CALLBACK_DIAGNOSTIC", payload);
}

function logCallbackEvent(
  event: "success" | "session_recovery" | "tenant_mismatch",
  requestId: string,
  payload: Record<string, unknown>,
) {
  const logger = event === "success" ? console.info : console.warn;
  logger("AUTH_CALLBACK_EVENT", {
    request_id: requestId,
    event,
    ...payload,
  });
}

async function resolveSignedInDestination(userId: string) {
  const identity = await resolveIdentity(userId);
  if (identity.role === "employee" && !identity.tenantId) {
    throw new Error("INVALID_TENANT_CONTEXT");
  }
  return {
    identity,
    path: defaultNextForRole(identity.role),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "magiclink";
  const { next, isStale: staleNext } = safeNext(searchParams.get("next"));
  const supabaseErr = searchParams.get("error_description") ?? searchParams.get("error");
  const supabase = await createServerClient();
  const preservedAuthCookies = snapshotAuthCookies(request);
  const {
    data: { user: preExchangeUser },
  } = await supabase.auth.getUser();
  const lastUsedTokenHash = request.cookies.get("tf_last_used_magiclink")?.value ?? null;

  if (tokenHash && lastUsedTokenHash && tokenHash === lastUsedTokenHash) {
    logCallbackDiagnostic({
      requestId,
      stage: "session_exchange",
      reason: "already_used_link",
      message: "Incoming token_hash matches last consumed callback token",
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
      type,
      next,
    });
    if (preExchangeUser) {
      try {
        const destination = await resolveSignedInDestination(preExchangeUser.id);
        logCallbackEvent("session_recovery", requestId, {
          reason: "already_used_link",
          pre_auth_user_id: preExchangeUser.id,
          recovered_role: destination.identity.role,
          recovered_tenant_id: destination.identity.tenantId,
        });
        return redirectTo(origin, `${destination.path}?status=session_recovered`, request, "verifier");
      } catch {
        return redirectTo(origin, "/auth?error=callback_failed&reason=session_mismatch", request, "all");
      }
    }
    return redirectTo(origin, "/auth?error=callback_failed&reason=already_used_link", request, "verifier");
  }

  if (staleNext) {
    logCallbackDiagnostic({
      requestId,
      stage: "session_exchange",
      reason: "stale_return_to",
      message: "Blocked stale or unsafe next param",
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
      type,
      next,
    });
  }

  if (supabaseErr) {
    const reason = classifyCallbackFailure("supabase_param", { message: supabaseErr });
    logCallbackDiagnostic({
      requestId,
      stage: "supabase_param",
      reason,
      message: supabaseErr,
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
      type,
      next,
    });
    if (preExchangeUser) {
      try {
        const destination = await resolveSignedInDestination(preExchangeUser.id);
        logCallbackEvent("session_recovery", requestId, {
          reason,
          pre_auth_user_id: preExchangeUser.id,
          recovered_role: destination.identity.role,
          recovered_tenant_id: destination.identity.tenantId,
        });
        return redirectTo(origin, `${destination.path}?status=session_recovered`, request, "verifier");
      } catch {
        return redirectTo(origin, "/auth?error=callback_failed&reason=session_mismatch", request, "all");
      }
    }
    return redirectTo(origin, `/auth?error=callback_failed&reason=${reason}`, request, "verifier");
  }

  if (!code && !tokenHash) {
    if (preExchangeUser) {
      try {
        const destination = await resolveSignedInDestination(preExchangeUser.id);
        logCallbackEvent("session_recovery", requestId, {
          reason: "session_recovered",
          pre_auth_user_id: preExchangeUser.id,
          recovered_role: destination.identity.role,
          recovered_tenant_id: destination.identity.tenantId,
        });
        return redirectTo(origin, `${destination.path}?status=session_recovered`, request, "verifier");
      } catch {
        logCallbackDiagnostic({
          requestId,
          stage: "missing_token",
          reason: "session_mismatch",
          message: "Signed-in session could not be recovered",
          hasCode: Boolean(code),
          hasTokenHash: Boolean(tokenHash),
          type,
          next,
        });
        return redirectTo(origin, "/auth?error=callback_failed&reason=session_mismatch", request, "all");
      }
    }

    const reason = classifyCallbackFailure("missing_token", null);
    logCallbackDiagnostic({
      requestId,
      stage: "missing_token",
      reason,
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
      type,
      next,
    });
    return redirectTo(origin, `/auth?error=callback_failed&reason=${reason}`, request, "verifier");
  }

  if (process.env.NODE_ENV === "development") {
    const cookieStore = await cookies();
    const all = cookieStore.getAll().map((c) => c.name);
    const hasVerifier = all.some((n) => n.includes("code-verifier"));
    console.log(
      `[callback] code=${code?.slice(0, 8) ?? "none"} token_hash=${tokenHash?.slice(0, 8) ?? "none"} cookies=[${all.join(", ")}] code_verifier_present=${hasVerifier}`,
    );
  }

  const { error } = tokenHash
    ? await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type === "invite" ? "invite" : "magiclink",
      })
    : await supabase.auth.exchangeCodeForSession(code ?? "");

  if (error) {
    const reason = classifyCallbackFailure("session_exchange", error);
    logCallbackDiagnostic({
      requestId,
      stage: "session_exchange",
      reason,
      message: authErrorMessage(error),
      code: authErrorCode(error),
      status: authErrorStatus(error),
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
      type,
      next,
    });
    if (preExchangeUser) {
      try {
        const destination = await resolveSignedInDestination(preExchangeUser.id);
        logCallbackEvent("session_recovery", requestId, {
          reason,
          pre_auth_user_id: preExchangeUser.id,
          recovered_role: destination.identity.role,
          recovered_tenant_id: destination.identity.tenantId,
        });
        return redirectTo(origin, `${destination.path}?status=session_recovered`, request, "verifier");
      } catch {
        return redirectTo(origin, "/auth?error=callback_failed&reason=session_mismatch", request, "all");
      }
    }
    return redirectTo(origin, `/auth?error=callback_failed&reason=${reason}`, request, "verifier");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const reason = classifyCallbackFailure("user_lookup", null);
    logCallbackDiagnostic({
      requestId,
      stage: "user_lookup",
      reason,
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
      type,
      next,
    });
    return redirectTo(origin, `/auth?error=callback_failed&reason=${reason}`, request, "verifier");
  }

  if (preExchangeUser && preExchangeUser.id !== user.id) {
    logCallbackDiagnostic({
      requestId,
      stage: "session_exchange",
      reason: "session_mismatch",
      message: "Callback resolved to a different auth user than active session",
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
      type,
      next,
    });
    return redirectPreservingAuthSession(
      origin,
      "/auth?error=callback_failed&reason=session_mismatch",
      request,
      preservedAuthCookies,
    );
  }

  const identity = await resolveIdentity(user.id);
  if (identity.role === "employee" && !identity.tenantId) {
    logCallbackEvent("tenant_mismatch", requestId, {
      auth_user_id: identity.authUserId,
      role: identity.role,
      tenant_id: identity.tenantId,
      has_employee_record: Boolean(identity.employeeId),
    });
    await supabase.auth.signOut();
    return redirectTo(origin, "/auth?error=callback_failed&reason=invalid_tenant", request, "all");
  }
  if (!identity.employeeId && identity.role !== "admin") {
    const reason = classifyCallbackFailure("identity_resolution", null);
    logCallbackDiagnostic({
      requestId,
      stage: "identity_resolution",
      reason,
      message: "No employee record linked to authenticated user",
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
      type,
      next,
    });
    return redirectTo(origin, "/auth?error=not_authorized", request, "verifier");
  }

  await track({
    tenantId: identity.tenantId,
    userId: identity.authUserId,
    eventName: "session_started",
    properties: { role: identity.role },
  });

  logCallbackEvent("success", requestId, {
    auth_user_id: identity.authUserId,
    role: identity.role,
    tenant_id: identity.tenantId,
    used_token_hash: Boolean(tokenHash),
    used_code: Boolean(code),
    next: next || defaultNextForRole(identity.role),
  });

  // Wipe leftover PKCE code-verifier cookies (NOT auth-token) after success.
  const response = redirectTo(origin, next || defaultNextForRole(identity.role), request, "verifier");
  if (tokenHash) {
    response.cookies.set("tf_last_used_magiclink", tokenHash, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/auth/callback",
      maxAge: 60 * 60 * 24,
    });
  }
  return response;
}
