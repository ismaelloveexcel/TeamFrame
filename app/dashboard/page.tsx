import Link from "next/link";
import { requireTenantActor } from "@/middleware/rbac";
import { listOrgChart } from "@/services/employeeService";
import { listAllOnboardingTasks } from "@/services/onboardingService";
import { listPendingLeavesWithEmployee } from "@/services/leaveService";
import { listActivationEvents } from "@/services/activationService";

export const dynamic = "force-dynamic";

const ACTIVATION_EVENTS = [
  { event: "first_employee_added", label: "Employee created" },
  { event: "first_onboarding_assigned", label: "Onboarding assigned" },
  { event: "first_onboarding_completed", label: "Onboarding completed" },
  { event: "first_leave_requested", label: "Leave requested" },
  { event: "first_leave_approved", label: "Leave approved" },
  { event: "activation_completed", label: "Activation complete" },
] as const;

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "< 1 hour";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

const SETUP_STEPS = [
  {
    event: "first_employee_added",
    title: "Add your first employee",
    description: "Create a team member profile with their role, department, and manager.",
    href: "/employees",
    cta: "Add employee",
  },
  {
    event: "first_onboarding_assigned",
    title: "Assign an onboarding task",
    description: "Give a new hire their first task so they know exactly what to do from day one.",
    href: "/onboarding",
    cta: "Open onboarding",
  },
  {
    event: "first_leave_approved",
    title: "Approve a leave request",
    description: "Your team submits time-off requests here — you review and approve or decline.",
    href: "/leaves",
    cta: "Manage leave",
  },
] as const;

export default async function DashboardPage() {
  const actor = await requireTenantActor();
  const isAdmin = actor.role === "admin";

  const [employees, onboardingTasks, pendingLeaves] = await Promise.all([
    listOrgChart(actor),
    actor.role === "admin" ? listAllOnboardingTasks(actor) : Promise.resolve([]),
    actor.role === "admin" ? listPendingLeavesWithEmployee(actor) : Promise.resolve([]),
  ]);

  const total = employees.length;
  const active = employees.filter((e) => e.status === "active").length;
  const onLeave = employees.filter((e) => e.status === "on_leave").length;
  const inactive = employees.filter((e) => e.status === "inactive").length;

  // Read all activation events with timestamps through the service layer
  const eventRows = await listActivationEvents(
    actor,
    ACTIVATION_EVENTS.map((e) => e.event),
  );

  const eventMap = new Map(
    eventRows.map((r) => [r.event_name, r.created_at]),
  );

  const firedEvents = new Set(eventMap.keys());
  const isActivated = firedEvents.has("activation_completed");
  const completedSteps = SETUP_STEPS.filter((s) => firedEvents.has(s.event)).length;
  // First-run: only the admin in the system and none of the setup steps completed yet
  const isFirstRun = total <= 1 && completedSteps === 0;
  const nextStep = SETUP_STEPS.find((s) => !firedEvents.has(s.event));

  // Time to activation: delta from first_employee_added → activation_completed
  const t0 = eventMap.get("first_employee_added");
  const t1 = eventMap.get("activation_completed");
  const timeToActivation =
    t0 && t1 ? formatDuration(new Date(t1).getTime() - new Date(t0).getTime()) : null;

  // Trust status — derived from already-fetched data, zero new queries
  const allTimestamps = [...eventMap.values()].map((ts) => new Date(ts).getTime());
  const latestEventAt =
    allTimestamps.length > 0 ? new Date(Math.max(...allTimestamps)) : null;
  const isEventFresh =
    latestEventAt !== null &&
    Date.now() - latestEventAt.getTime() < 24 * 60 * 60 * 1000;
  const ACTIVATION_PREREQUISITES = [
    "first_employee_added",
    "first_onboarding_assigned",
    "first_onboarding_completed",
    "first_leave_requested",
    "first_leave_approved",
  ] as const;
  const activationConsistencyOk =
    !isActivated || ACTIVATION_PREREQUISITES.every((e) => firedEvents.has(e));

  // Single deterministic invariant: activation_completed present, all prerequisites
  // present, and exactly one activation_completed row exists for this tenant
  const activationCompletedCount = (eventRows ?? []).filter(
    (r: { event_name: string; created_at: string }) =>
      r.event_name === "activation_completed",
  ).length;
  const systemConsistent =
    isActivated &&
    ACTIVATION_PREREQUISITES.every((e) => firedEvents.has(e)) &&
    activationCompletedCount === 1;

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <nav className="mb-6 flex gap-4 text-[14px] text-ink-500">
        <span className="text-ink-900 font-medium">Dashboard</span>
        {!isAdmin ? (
          <Link href="/me" className="hover:text-ink-900 transition">
            My space
          </Link>
        ) : null}
        <Link href="/employees" className="hover:text-ink-900 transition">
          Employees
        </Link>
        <Link href="/onboarding" className="hover:text-ink-900 transition">
          Onboarding
        </Link>
        <Link href="/leaves" className="hover:text-ink-900 transition">
          Leaves
        </Link>
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

      {isFirstRun ? (
        /* ── Full getting-started guide for brand-new companies ── */
        <section className="mt-10">
          <div className="mb-7">
            <p className="text-[20px] font-medium tracking-tight text-ink-900">
              Welcome — let&apos;s get TeamFrame set up
            </p>
            <p className="mt-1 text-[14px] text-ink-500">
              3 steps to get your team running. Takes about 5 minutes.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-200">
                <div
                  className="h-full rounded-full bg-ink-900 transition-all"
                  style={{ width: `${(completedSteps / SETUP_STEPS.length) * 100}%` }}
                />
              </div>
              <span className="shrink-0 text-[12px] text-ink-500">
                {completedSteps} of {SETUP_STEPS.length} done
              </span>
            </div>
          </div>

          <ol className="space-y-3">
            {SETUP_STEPS.map((step, idx) => {
              const done = firedEvents.has(step.event);
              const isNext =
                !done && SETUP_STEPS.slice(0, idx).every((s) => firedEvents.has(s.event));
              return (
                <li
                  key={step.event}
                  className={`flex items-start gap-4 rounded-xl border p-5 transition ${
                    done
                      ? "border-ink-200 bg-white/50"
                      : isNext
                        ? "border-ink-900 bg-white shadow-sm"
                        : "border-dashed border-ink-200 bg-white/30"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-medium ${
                      done
                        ? "bg-ink-900 text-paper"
                        : isNext
                          ? "border-2 border-ink-900 text-ink-900"
                          : "border border-ink-300 text-ink-400"
                    }`}
                  >
                    {done ? "✓" : idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-[15px] font-medium ${
                        done ? "text-ink-400 line-through decoration-ink-300" : "text-ink-900"
                      }`}
                    >
                      {step.title}
                    </p>
                    {!done && (
                      <p className="mt-0.5 text-[13px] text-ink-500">{step.description}</p>
                    )}
                  </div>
                  {!done && (
                    <Link
                      href={step.href}
                      className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium transition ${
                        isNext
                          ? "bg-ink-900 text-paper hover:bg-ink-700"
                          : "border border-ink-300 text-ink-600 hover:border-ink-700 hover:text-ink-900"
                      }`}
                    >
                      {step.cta}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ) : (
        <>
          {/* ── Setup progress strip (in-progress companies) ── */}
          {!isActivated && nextStep && (
            <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-ink-200 bg-white/70 px-5 py-3.5">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-ink-700">
                  <span className="font-medium">
                    Getting started: {completedSteps} of {SETUP_STEPS.length} done
                  </span>
                  <span className="text-ink-400 mx-1.5">·</span>
                  <span className="text-ink-500">Next: </span>
                  <Link
                    href={nextStep.href}
                    className="text-ink-900 underline decoration-ink-300 underline-offset-2 hover:decoration-ink-900"
                  >
                    {nextStep.title}
                  </Link>
                </p>
              </div>
              <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-ink-200">
                <div
                  className="h-full rounded-full bg-ink-900"
                  style={{ width: `${(completedSteps / SETUP_STEPS.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Activation complete badge ── */}
          {isActivated && (
            <div className="mt-6 rounded-xl border border-ink-200 bg-white/70 px-5 py-3.5">
              <p className="text-[13px] text-ink-700">
                <span className="font-medium">✓ Setup complete</span>
                <span className="text-ink-400 mx-1.5">·</span>
                Your team workflows are fully operational.
              </p>
            </div>
          )}

          {/* ── Stats grid ── */}
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        </>
      )}

      {/* ── Activation View — admin only, always visible ── */}
      {/* Removed misleading trust/health surfaces. Only setup progress, activation badge, and operational counts remain. */}

      <nav className="mt-10 flex flex-wrap gap-4 text-[14px]">
        {!isAdmin ? (
          <Link
            href="/me"
            className="text-ink-700 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900"
          >
            My space
          </Link>
        ) : null}
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
    </main>
  );
}
