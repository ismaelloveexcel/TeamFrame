import { AuthForm } from "./AuthForm";

const ERROR_COPY: Record<string, string> = {
  invalid_email: "That doesn't look like a valid email.",
  callback_failed: "That link is stale. Delete old emails, send one new link, and click only the newest one.",
  not_authorized: "That email isn't on the team yet. Ask your admin to add you.",
};

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_COPY[error] ?? null) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="space-y-2">
        <p className="text-[12px] uppercase tracking-[0.18em] text-ink-500">
          TeamFrame
        </p>
        <h1 className="text-[32px] leading-tight tracking-tight">Sign in to your payroll data workspace.</h1>
        <p className="text-[15px] text-ink-700">
          Use your work email to access payroll inputs, snapshot review, and finance export preparation.
        </p>
      </div>

      <AuthForm errorMessage={errorMessage} />

      <p className="mt-10 text-[12px] text-ink-500">
        Password-free access. If you are not recognized, ask your admin to add your work email to the data record first.
      </p>
    </main>
  );
}
