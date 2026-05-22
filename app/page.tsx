import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 md:py-14">
      <header className="flex items-center justify-between border-b border-ink-300/60 pb-5">
        <span className="text-[15px] font-medium tracking-tight">TeamFrame</span>
        <span className="text-[12px] text-ink-500">Snapshot 22 May 2026 · 14:02 UTC</span>
      </header>

      <section className="mt-12 grid gap-12 md:grid-cols-[1.25fr_0.9fr] md:items-end">
        <div className="space-y-5">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Operational intelligence platform</p>
          <h1 className="max-w-2xl text-[44px] leading-[1.02] tracking-tight md:text-[62px]">
            Calm operating view
            <br />
            for startup people systems.
          </h1>
          <p className="max-w-xl text-[17px] leading-relaxed text-ink-700">
            Directory, leave, and documents in one executive surface. Current posture is stable and release-ready.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/auth"
              className="inline-flex items-center justify-center rounded-full bg-ink-900 px-6 py-3 text-[15px] font-medium text-paper transition hover:bg-ink-700"
            >
              Open platform
            </Link>
            <Link
              href="/dashboard"
              className="text-[15px] text-ink-700 underline decoration-ink-300 underline-offset-4 transition hover:decoration-ink-900"
            >
              View executive summary
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-ink-300/70 bg-white/75 p-6 backdrop-blur-sm">
          <p className="text-[11px] tracking-[0.14em] text-ink-500">Current posture</p>
          <p className="mt-2 text-[28px] leading-tight tracking-tight">Operationally stable</p>
          <p className="mt-2 text-[14px] text-ink-700">All release gates verified in strict sequence.</p>

          <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 text-[14px]">
            <div>
              <dt className="text-ink-500">Release gates</dt>
              <dd className="mt-1 text-[18px] tracking-tight">9 / 9 green</dd>
            </div>
            <div>
              <dt className="text-ink-500">Reliability checks</dt>
              <dd className="mt-1 text-[18px] tracking-tight">3 / 3 passing</dd>
            </div>
            <div>
              <dt className="text-ink-500">Data controls</dt>
              <dd className="mt-1 text-[18px] tracking-tight">RLS + stale-write</dd>
            </div>
            <div>
              <dt className="text-ink-500">Active domains</dt>
              <dd className="mt-1 text-[18px] tracking-tight">Employees, leave, documents</dd>
            </div>
          </dl>
        </div>
      </section>

      <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-ink-300/60 pt-5 text-[12px] text-ink-500">
        <span>Built for focused teams of 6-25.</span>
        <span>V1 behavior frozen for stabilization.</span>
      </footer>
    </main>
  );
}
