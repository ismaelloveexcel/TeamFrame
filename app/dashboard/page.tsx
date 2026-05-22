export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Executive summary</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Operational snapshot</h1>
        </div>
        <p className="text-[12px] text-ink-500">Published 22 May 2026 · 14:02 UTC</p>
      </div>

      <p className="mt-7 max-w-xl text-[15px] text-ink-700">
        Stable operating posture with strict runtime controls active across employee, leave, and document workflows.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Employee records</p>
          <p className="mt-2 text-[24px] tracking-tight">Current</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Leave queue</p>
          <p className="mt-2 text-[24px] tracking-tight">In control</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Document workflows</p>
          <p className="mt-2 text-[24px] tracking-tight">Audited</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Release posture</p>
          <p className="mt-2 text-[24px] tracking-tight">Green</p>
        </article>
      </section>

      <form action="/auth/logout" method="post" className="mt-10">
        <button
          type="submit"
          className="rounded-full border border-ink-300 px-5 py-2 text-[14px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900"
        >
          Sign out
        </button>
      </form>

      {/*
        V1 dashboard scope (drift-guard):
          - active employee count
          - pending leave count
          - latest joiners (list)
          - latest company updates (list)
        Forbidden: charts, engagement metrics, HR insights, scoring.
      */}
    </main>
  );
}
