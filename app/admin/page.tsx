export default function AdminPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Admin workspace</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Team operations</h1>
        </div>
        <p className="text-[12px] text-ink-500">Role-gated · audit-covered</p>
      </div>

      <p className="mt-7 max-w-xl text-[15px] text-ink-700">
        Controlled workspace for staffing, leave decisions, and document administration.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Staffing actions</p>
          <p className="mt-2 text-[20px] tracking-tight">Create, edit, archive</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Leave approvals</p>
          <p className="mt-2 text-[20px] tracking-tight">Decision workflow</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Document control</p>
          <p className="mt-2 text-[20px] tracking-tight">Signed access only</p>
        </article>
      </section>

      {/*
        Every route under /admin must be gated by requireRole('admin')
        in the API/Server Action or middleware before any DB access.
        Sensitive mutations write to audit_logs.
      */}
    </main>
  );
}
