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
        <h1 className="text-[32px] leading-tight tracking-tight">Check your email.</h1>
        <p className="max-w-prose text-[15px] leading-relaxed text-ink-700">
          We sent a sign-in link to <span className="font-medium">{recipient}</span>. Open it on
          this device to finish signing in.
        </p>
      </div>

      <Link
        href="/auth"
        className="mt-10 inline-flex w-fit items-center text-[14px] text-ink-700 underline decoration-ink-300 underline-offset-4 transition hover:decoration-ink-900"
      >
        Use a different email
      </Link>

      <p className="mt-12 text-[12px] text-ink-500">
        Didn&apos;t receive it? Check spam, or ask your admin to confirm you&apos;re on the team.
      </p>
    </main>
  );
}
