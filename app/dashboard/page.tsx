import Link from "next/link";
import { requireTenantActor } from "@/middleware/rbac";
import { listOrgChart, listPayrollReadinessForAdmin } from "@/services/employeeService";
import { listPendingLeaves } from "@/services/leaveService";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const actor = await requireTenantActor();
  const employees = await listOrgChart(actor);
  const activeEmployees = employees.filter((employee) => employee.status === "active").length;
  const needsAttention = employees.filter((employee) => employee.status !== "active").length;

  const pendingApprovals =
    actor.role === "admin" ? (await listPendingLeaves(actor)).length : null;
  const readinessRows = actor.role === "admin" ? await listPayrollReadinessForAdmin(actor) : [];
  const blockedForExport = readinessRows.filter((row) => !row.ready_for_finance_export).length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Payroll operations</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Snapshot workspace</h1>
        </div>
        <p className="text-[12px] text-ink-500">Finance-ready employee data · role-gated</p>
      </div>

      <p className="mt-7 max-w-xl text-[15px] text-ink-700">
        Review payroll inputs, record status changes, and export posture from one calm operational view.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="tf-kpi">
          <p className="text-[12px] text-ink-500">Ready to run</p>
          <p className="mt-2 text-[24px] tracking-tight">{activeEmployees}</p>
        </article>
        <article className="tf-kpi">
          <p className="text-[12px] text-ink-500">Needs attention</p>
          <p className="mt-2 text-[24px] tracking-tight">{needsAttention}</p>
        </article>
        <article className="tf-kpi">
          <p className="text-[12px] text-ink-500">Payroll batch changes</p>
          <p className="mt-2 text-[24px] tracking-tight">
            {pendingApprovals === null ? "Admin only" : pendingApprovals}
          </p>
        </article>
        <article className="tf-kpi">
          <p className="text-[12px] text-ink-500">Finance export</p>
          <p className="mt-2 text-[24px] tracking-tight">
            {actor.role === "admin"
              ? blockedForExport === 0
                ? "Ready"
                : `Blocked (${blockedForExport})`
              : "CSV / Sheets"}
          </p>
        </article>
        <article className="tf-kpi">
          <p className="text-[12px] text-ink-500">Data records</p>
          <p className="mt-2 text-[24px] tracking-tight">{employees.length}</p>
        </article>
      </section>

      <section className="tf-panel mt-8 px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[18px] tracking-tight">Batch notes</h2>
            <p className="mt-1 text-[13px] text-ink-500">
              Use this view to prepare the next payroll snapshot before export.
            </p>
          </div>
          <Link href="/employees" className="tf-button-primary">
            Review payroll inputs
          </Link>
        </div>
        <ul className="mt-3 space-y-2 text-[14px] text-ink-700">
          <li className="flex items-start justify-between gap-3 border-b border-ink-100 pb-2">
            <span>Employee dataset is available for snapshot review.</span>
            <span className="text-[12px] text-ink-500">Current export batch</span>
          </li>
          <li className="flex items-start justify-between gap-3 border-b border-ink-100 pb-2">
            <span>Status changes that can affect payroll batches remain visible.</span>
            <span className="text-[12px] text-ink-500">Ready for finance review</span>
          </li>
          <li className="flex items-start justify-between gap-3">
            <span>Finance export preparation stays role-gated and audit tracked.</span>
            <span className="text-[12px] text-ink-500">Export prepared</span>
          </li>
        </ul>

        {actor.role === "admin" ? (
          <div className="mt-4">
            <Link href="/admin" className="text-[13px] text-ink-700 underline decoration-ink-300 underline-offset-4 transition hover:decoration-ink-900">
              Open finance controls
            </Link>
          </div>
        ) : null}
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
