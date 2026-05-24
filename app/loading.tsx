export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14" aria-busy="true" aria-live="polite">
      <div className="space-y-2 border-b border-ink-300/60 pb-5">
        <p className="text-[12px] tracking-[0.14em] text-ink-500">Preparing payroll workspace...</p>
        <div className="h-9 w-64 rounded bg-ink-100" />
      </div>

      <p className="mt-7 text-[14px] text-ink-500">Loading export data...</p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="tf-kpi h-[78px] animate-pulse bg-white/60" />
        <div className="tf-kpi h-[78px] animate-pulse bg-white/60" />
        <div className="tf-kpi h-[78px] animate-pulse bg-white/60" />
        <div className="tf-kpi h-[78px] animate-pulse bg-white/60" />
      </section>

      <section className="tf-panel mt-8 p-5">
        <div className="h-4 w-44 rounded bg-ink-100" />
        <div className="mt-3 h-4 w-full max-w-2xl rounded bg-ink-100" />
        <div className="mt-2 h-4 w-full max-w-xl rounded bg-ink-100" />
      </section>
    </main>
  );
}
