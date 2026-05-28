import { AuthForm } from "./AuthForm";

const ERROR_COPY: Record<string, string> = {
  invalid_email: "That doesn't look like a valid email.",
  callback_failed: "Sign-in link could not be verified. Send one fresh link and use it right away.",
  not_authorized: "That email isn't on the team yet. Ask your admin to add you.",
};

const CALLBACK_REASON_COPY: Record<string, string> = {
  provider_rejected: "Sign-in provider rejected that link. Send a fresh link and use only the latest email.",
  missing_token: "That sign-in link is incomplete. Send a new link from the sign-in page.",
  expired_link: "That link expired. Send a fresh link and open it immediately.",
  invalid_link: "That sign-in link is invalid. Delete old emails and use the newest link.",
  auth_unavailable: "Sign-in is temporarily unavailable. Wait a moment and try a fresh link.",
  session_exchange_failed: "Could not complete sign-in from that link. Request a new one and retry.",
  unknown: "Sign-in could not be completed. Request a fresh link and retry.",
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

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>;
}) {
  const { error, reason } = await searchParams;
  const errorMessage = getErrorMessage(error, reason);

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

      <AuthForm errorMessage={errorMessage} />

      <p className="mt-10 text-[12px] text-ink-500">
        No passwords. No social logins. Admin-invited only.
      </p>
    </main>
  );
}
