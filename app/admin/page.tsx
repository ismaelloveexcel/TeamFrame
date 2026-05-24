import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Finance controls</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Export readiness</h1>
        </div>
        <p className="text-[12px] text-ink-500">Role-gated · audit-covered</p>
      </div>

      <p className="mt-7 max-w-xl text-[15px] text-ink-700">
        Keep payroll input records reviewable before finance export without turning this workspace into a payroll engine.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="tf-kpi">
          <p className="text-[12px] text-ink-500">Record control</p>
          <p className="mt-2 text-[20px] tracking-tight">Create, update, archive</p>
        </article>
        <article className="tf-kpi">
          <p className="text-[12px] text-ink-500">Batch review</p>
          <p className="mt-2 text-[20px] tracking-tight">Status changes before export</p>
        </article>
        <article className="tf-kpi">
          <p className="text-[12px] text-ink-500">System boundary</p>
          <p className="mt-2 text-[20px] tracking-tight">No tax, payments, or compliance automation</p>
        </article>
      </section>

      <section className="tf-panel mt-8 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] tracking-tight">Primary action</h2>
            <p className="mt-1 max-w-xl text-[13px] text-ink-500">
              Review employee data records before the next payroll snapshot or finance export packet.
            </p>
          </div>
          <Link href="/employees" className="tf-button-primary">
            Review employee data
          </Link>
        </div>
      </section>

      {/*
        Every route under /admin must be gated by requireRole('admin')
        in the API/Server Action or middleware before any DB access.
        Sensitive mutations write to audit_logs.
      */}
    </main>
  );
}
