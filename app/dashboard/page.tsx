import Link from "next/link";
import { requireTenantActor } from "@/middleware/rbac";

export const dynamic = "force-dynamic";

/**
 * FPORS Risk Dashboard — Wave 1 placeholder.
 *
 * The HR-system dashboard (employee counts, activation telemetry, audit
 * timeline, schema visibility) was removed in the pivot to FPORS
 * (see docs/business/blueprint-locked.md).
 *
 * The real risk dashboard — Red / Yellow / Green lanes driven by the
 * signal engine — ships in Wave 3 (Saturday afternoon).
 */
export default async function DashboardPage() {
  await requireTenantActor();

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <nav className="mb-6 flex gap-4 text-[14px] text-ink-500">
        <span className="text-ink-900 font-medium">Dashboard</span>
        <Link href="/employees" className="hover:text-ink-900 transition">Team roster</Link>
        <Link href="/onboarding" className="hover:text-ink-900 transition">Onboarding</Link>
        <Link href="/leaves" className="hover:text-ink-900 transition">Leaves</Link>
      </nav>

      <div className="space-y-2 border-b border-ink-300/60 pb-5">
        <p className="text-[12px] tracking-[0.14em] text-ink-500">Founder view</p>
        <h1 className="text-[34px] leading-tight tracking-tight">Risk dashboard</h1>
        <p className="text-[14px] text-ink-500">Your check-engine light for people-ops.</p>
      </div>

      <section className="mt-9 rounded-xl border border-dashed border-ink-300/80 bg-white/60 p-8">
        <p className="text-[13px] tracking-[0.12em] text-ink-500">Coming Saturday afternoon</p>
        <h2 className="mt-2 text-[24px] tracking-tight">Red / Yellow / Green lanes</h2>
        <p className="mt-3 max-w-prose text-[15px] text-ink-700">
          Three lanes — missing contracts, expiring documents, stalled offboarding.
          Each card surfaces the people-ops risk and a one-click <em>fix this</em> action.
        </p>
        <p className="mt-4 text-[13px] text-ink-500">
          Wave 1 cleanup is complete. The signal engine (Wave 2) and the live dashboard (Wave 3) are next.
        </p>
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <Link
          href="/employees"
          className="rounded-xl border border-ink-300/70 bg-white/75 p-4 transition hover:border-ink-900"
        >
          <p className="text-[12px] tracking-[0.12em] text-ink-500">Manage</p>
          <p className="mt-2 text-[18px] tracking-tight">Team roster</p>
          <p className="mt-1 text-[13px] text-ink-500">Add and update teammates.</p>
        </Link>
        <Link
          href="/onboarding"
          className="rounded-xl border border-ink-300/70 bg-white/75 p-4 transition hover:border-ink-900"
        >
          <p className="text-[12px] tracking-[0.12em] text-ink-500">Track</p>
          <p className="mt-2 text-[18px] tracking-tight">Onboarding</p>
          <p className="mt-1 text-[13px] text-ink-500">Readiness checklist.</p>
        </Link>
        <Link
          href="/leaves"
          className="rounded-xl border border-ink-300/70 bg-white/75 p-4 transition hover:border-ink-900"
        >
          <p className="text-[12px] tracking-[0.12em] text-ink-500">Approve</p>
          <p className="mt-2 text-[18px] tracking-tight">Leaves</p>
          <p className="mt-1 text-[13px] text-ink-500">Requests pending review.</p>
        </Link>
      </section>
    </main>
  );
}
