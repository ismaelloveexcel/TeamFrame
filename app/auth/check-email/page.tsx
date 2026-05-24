import Link from "next/link";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const recipient = email && email.length > 0 ? email : "your inbox";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="space-y-3">
        <p className="text-[12px] uppercase tracking-[0.18em] text-ink-500">
          Link sent
        </p>
        <h1 className="text-[32px] leading-tight tracking-tight">Check your inbox.</h1>
        <p className="max-w-prose text-[15px] leading-relaxed text-ink-700">
          A secure sign-in link was sent to <span className="font-medium">{recipient}</span>. Open
          the newest email on this device to continue into your payroll data workspace.
        </p>
      </div>

      <Link
        href="/auth"
        className="mt-10 inline-flex w-fit items-center text-[14px] text-ink-700 underline decoration-ink-300 underline-offset-4 transition hover:decoration-ink-900"
      >
        Use a different email
      </Link>

      <p className="mt-12 text-[12px] text-ink-500">
        If it doesn&apos;t arrive within a minute, check spam first, then confirm your data record is active with your admin.
      </p>
      <p className="mt-3 text-[12px] text-ink-500">
        Security note: each new sign-in request invalidates older email links.
      </p>
    </main>
  );
}
