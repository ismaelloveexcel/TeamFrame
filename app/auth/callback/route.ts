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

function safeNext(raw: string | null): string {
  if (!raw) return "";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "";
  }
  return raw;
}

function defaultNextForRole(role: "admin" | "employee"): string {
  return role === "employee" ? "/me" : "/dashboard";
}

type CookieWipe = "none" | "verifier" | "all";

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
  | "invalid_link"
  | "auth_unavailable"
  | "session_exchange_failed"
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

  if (message.includes("expired") || code.includes("expired")) return "expired_link";
  if (message.includes("invalid") || message.includes("otp") || code.includes("invalid")) return "invalid_link";
  if (status === 500 || message.includes("service unavailable")) return "auth_unavailable";
  if (stage === "session_exchange") return "session_exchange_failed";
  return "unknown";
}

function logCallbackDiagnostic(input: {
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

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "magiclink";
  const next = safeNext(searchParams.get("next"));
  const supabaseErr = searchParams.get("error_description") ?? searchParams.get("error");

  if (supabaseErr) {
    const reason = classifyCallbackFailure("supabase_param", { message: supabaseErr });
    logCallbackDiagnostic({
      stage: "supabase_param",
      reason,
      message: supabaseErr,
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
      type,
      next,
    });
    return redirectTo(origin, `/auth?error=callback_failed&reason=${reason}`, request, "verifier");
  }

  if (!code && !tokenHash) {
    const reason = classifyCallbackFailure("missing_token", null);
    logCallbackDiagnostic({
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

  const supabase = await createServerClient();
  const { error } = tokenHash
    ? await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type === "invite" ? "invite" : "magiclink",
      })
    : await supabase.auth.exchangeCodeForSession(code ?? "");

  if (error) {
    const reason = classifyCallbackFailure("session_exchange", error);
    logCallbackDiagnostic({
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
    return redirectTo(origin, `/auth?error=callback_failed&reason=${reason}`, request, "verifier");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const reason = classifyCallbackFailure("user_lookup", null);
    logCallbackDiagnostic({
      stage: "user_lookup",
      reason,
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
      type,
      next,
    });
    return redirectTo(origin, `/auth?error=callback_failed&reason=${reason}`, request, "verifier");
  }

  const identity = await resolveIdentity(user.id);
  if (!identity.employeeId && identity.role !== "admin") {
    const reason = classifyCallbackFailure("identity_resolution", null);
    logCallbackDiagnostic({
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

  // Wipe leftover PKCE code-verifier cookies (NOT auth-token) after success.
  return redirectTo(origin, next || defaultNextForRole(identity.role), request, "verifier");
}
