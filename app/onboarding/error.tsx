"use client";

export default function OnboardingError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <section className="rounded-xl border border-ink-300/70 bg-white/80 p-6">
        <p className="text-[12px] tracking-[0.14em] text-ink-500">Onboarding</p>
        <h1 className="mt-2 text-[28px] leading-tight tracking-tight">We could not load this page.</h1>
        <p className="mt-3 text-[14px] text-ink-700">
          Please try again. If this keeps happening, sign out and sign in again.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-5 rounded-full bg-ink-900 px-5 py-2 text-[14px] font-medium text-paper transition hover:bg-ink-700"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
