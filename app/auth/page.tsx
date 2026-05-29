import { createServerClient } from "@/lib/db/supabaseServer";
import { resolveIdentity } from "@/lib/rbac/roles";
import { AuthForm } from "./AuthForm";
import { continueCurrentSessionAction, switchAccountAction } from "./actions";

const ERROR_COPY: Record<string, string> = {
  invalid_email: "That doesn't look like a valid email.",
  callback_failed: "Sign-in link could not be verified. Send one fresh link and use it right away.",
  not_authorized: "That email isn't on the team yet. Ask your admin to add you.",
  switched_account: "You have been signed out. Continue with the other account's link.",
};

const CALLBACK_REASON_COPY: Record<string, string> = {
  provider_rejected: "Sign-in provider rejected that link. Send a fresh link and use only the latest email.",
  missing_token: "That sign-in link is incomplete. Send a new link from the sign-in page.",
  expired_link: "That link expired. Send a fresh link and open it immediately.",
  already_used_link: "That sign-in link has already been used. Request a fresh one and use it right away.",
  invalid_link: "That sign-in link is invalid. Delete old emails and use the newest link.",
  stale_return_to: "That sign-in link pointed to an outdated page. Use a fresh link from the sign-in page.",
  invalid_tenant: "Your account is missing required team access. Ask your admin to verify your tenant setup.",
  session_mismatch: "That link belongs to a different session. Sign in again from the correct email.",
  session_recovered: "Your existing session is still active. Continue from your dashboard.",
  auth_unavailable: "Sign-in is temporarily unavailable. Wait a moment and try a fresh link.",
  session_exchange_failed: "Could not complete sign-in from that link. Request a new one and retry.",
  unknown: "Sign-in could not be completed. Request a fresh link and retry.",
};

const CALLBACK_REASON_TITLES: Record<string, string> = {
  expired_link: "Link expired",
  already_used_link: "Link already used",
  invalid_link: "Invalid link",
  session_mismatch: "Wrong active session",
};

function getErrorMessage(error: string | undefined, reason: string | undefined): string | null {
  if (error === "callback_failed") {
    const byReason = reason ? CALLBACK_REASON_COPY[reason] : undefined;
    return byReason ?? "Sign-in link could not be verified. Send one fresh link and use it right away.";
  }
  if (!error) {
    return null;
  }
  return ERROR_COPY[error] ?? null;
}

async function getActiveSessionDestination(): Promise<string | null> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const identity = await resolveIdentity(user.id);
    return identity.role === "admin" ? "/dashboard" : "/me";
  } catch {
    return null;
  }
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string; switched_account?: string }>;
}) {
  const { error, reason, switched_account: switchedAccount } = await searchParams;
  const errorMessage = getErrorMessage(error, reason);
  const activeSessionDestination = await getActiveSessionDestination();
  const showSessionRecoveryActions = reason === "session_mismatch" && Boolean(activeSessionDestination);
  const callbackTitle = reason ? CALLBACK_REASON_TITLES[reason] ?? "Sign-in issue" : "Sign-in issue";
  const infoMessage = switchedAccount ? ERROR_COPY.switched_account : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="space-y-2">
        <p className="text-[12px] uppercase tracking-[0.18em] text-ink-500">
          TeamFrame
        </p>
        <h1 className="text-[32px] leading-tight tracking-tight">Sign in.</h1>
        <p className="text-[15px] text-ink-700">
          Enter your work email. We&apos;ll send you a one-time link.
        </p>
      </div>

      {error === "callback_failed" && errorMessage ? (
        <section className="mt-8 rounded-xl border border-ink-300/80 bg-white/80 px-4 py-4">
          <p className="text-[12px] uppercase tracking-[0.14em] text-ink-500">{callbackTitle}</p>
          <p role="alert" className="mt-2 text-[14px] text-ink-800">{errorMessage}</p>
          {showSessionRecoveryActions ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <form action={continueCurrentSessionAction} className="flex-1">
                <button
                  type="submit"
                  className="w-full rounded-full bg-ink-900 px-4 py-2 text-[14px] font-medium text-paper transition hover:bg-ink-700"
                >
                  Continue as current user
                </button>
              </form>
              <form action={switchAccountAction} className="flex-1">
                <button
                  type="submit"
                  className="w-full rounded-full border border-ink-300 px-4 py-2 text-[14px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900"
                >
                  Switch account
                </button>
              </form>
            </div>
          ) : null}
        </section>
      ) : null}

      {infoMessage ? (
        <p className="mt-6 rounded-lg border border-ink-300/80 bg-white/80 px-4 py-3 text-[13px] text-ink-700">
          {infoMessage}
        </p>
      ) : null}

      <AuthForm errorMessage={errorMessage} />

      <p className="mt-10 text-[12px] text-ink-500">
        No passwords. No social logins. Admin-invited only.
      </p>
    </main>
  );
}
