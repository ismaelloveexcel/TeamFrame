"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <div className="space-y-2 border-b border-ink-300/60 pb-5">
        <p className="text-[12px] tracking-[0.14em] text-ink-500">Operational error</p>
        <h1 className="text-[34px] leading-tight tracking-tight">This workspace could not be loaded.</h1>
      </div>

      <p className="mt-7 max-w-xl text-[15px] text-ink-700">
        Something interrupted this export view. Retry to continue with payroll data preparation.
      </p>

      <button type="button" onClick={() => reset()} className="tf-button-primary mt-6">
        Retry
      </button>
    </main>
  );
}
