import Link from "next/link";
import { requireTenantActor } from "@/middleware/rbac";
import { listOrgChart } from "@/services/employeeService";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const actor = await requireTenantActor();
  const employees = await listOrgChart(actor);

  const total = employees.length;
  const active = employees.filter((e) => e.status === "active").length;
  const onLeave = employees.filter((e) => e.status === "on_leave").length;
  const inactive = employees.filter((e) => e.status === "inactive").length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <nav className="mb-6 flex gap-4 text-[14px] text-ink-500">
        <span className="text-ink-900 font-medium">Dashboard</span>
        <Link href="/employees" className="hover:text-ink-900 transition">Employees</Link>
        <Link href="/onboarding" className="hover:text-ink-900 transition">Onboarding</Link>
        <Link href="/leaves" className="hover:text-ink-900 transition">Leaves</Link>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Overview</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Dashboard</h1>
        </div>
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="rounded-full border border-ink-300 px-4 py-1.5 text-[13px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900"
          >
            Sign out
          </button>
        </form>
      </div>

      {total === 0 ? (
        <section className="mt-10 rounded-xl border border-dashed border-ink-300/80 bg-white/60 p-8 text-center">
          <p className="text-[16px] text-ink-700">No employees yet.</p>
          <p className="mt-2 text-[14px] text-ink-500">
            Add your first employee to start populating the directory.
          </p>
          <Link
            href="/employees"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-ink-900 px-5 py-2 text-[14px] font-medium text-paper transition hover:bg-ink-700"
          >
            Go to Employees
          </Link>
        </section>
      ) : (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
              <p className="text-[12px] text-ink-500">Total employees</p>
              <p className="mt-2 text-[24px] tracking-tight">{total}</p>
            </article>
            <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
              <p className="text-[12px] text-ink-500">Active</p>
              <p className="mt-2 text-[24px] tracking-tight">{active}</p>
            </article>
            <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
              <p className="text-[12px] text-ink-500">On leave</p>
              <p className="mt-2 text-[24px] tracking-tight">{onLeave}</p>
            </article>
            <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
              <p className="text-[12px] text-ink-500">Inactive</p>
              <p className="mt-2 text-[24px] tracking-tight">{inactive}</p>
            </article>
          </section>

          <nav className="mt-10 flex flex-wrap gap-4 text-[14px]">
            <Link
              href="/employees"
              className="text-ink-700 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900"
            >
              Employees
            </Link>
            <Link
              href="/org-chart"
              className="text-ink-700 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900"
            >
              Org chart
            </Link>
          </nav>
        </>
      )}
    </main>
  );
}
