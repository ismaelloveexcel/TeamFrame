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

function redirectTo(origin: string, path: string, request: NextRequest, clearAuthCookies = false) {
  const response = NextResponse.redirect(`${origin}${path}`);
  if (clearAuthCookies) {
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.includes("code-verifier") || cookie.name.includes("auth-token")) {
        response.cookies.delete(cookie.name);
      }
    }
  }
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "magiclink";
  const next = safeNext(searchParams.get("next"));
  const supabaseErr = searchParams.get("error_description") ?? searchParams.get("error");

  if (supabaseErr) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[callback] supabase rejected the link: ${supabaseErr}`);
    }
    return redirectTo(origin, "/auth?error=callback_failed", request, true);
  }

  if (!code && !tokenHash) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[callback] no code, token_hash, or error in URL");
    }
    return redirectTo(origin, "/auth?error=callback_failed", request, true);
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
    if (process.env.NODE_ENV === "development") {
      console.warn(`[callback] session exchange failed: ${error.message}`);
    }
    return redirectTo(origin, "/auth?error=callback_failed", request, true);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectTo(origin, "/auth?error=callback_failed", request, true);
  }

  const identity = await resolveIdentity(user.id);
  if (!identity.employeeId && identity.role !== "admin") {
    await supabase.auth.signOut();
    return redirectTo(origin, "/auth?error=not_authorized", request, true);
  }

  await track({
    tenantId: identity.tenantId,
    userId: identity.authUserId,
    eventName: "session_started",
    properties: { role: identity.role },
  });

  return redirectTo(origin, next || defaultNextForRole(identity.role), request);
}
