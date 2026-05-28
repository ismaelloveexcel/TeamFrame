import Link from "next/link";
import { requireTenantActor } from "@/middleware/rbac";
import { listEmployeesForAdmin, listOrgChart } from "@/services/employeeService";
import { listActivationEvents } from "@/services/activationService";
import { listPendingLeavesWithEmployee } from "@/services/leaveService";
import { listAllOnboardingTasks } from "@/services/onboardingService";
import { logoutAction } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

const ACTIVATION_EVENTS = [
  { event: "first_employee_added" },
  { event: "first_onboarding_assigned" },
  { event: "first_onboarding_completed" },
  { event: "first_leave_requested" },
  { event: "first_leave_approved" },
  { event: "activation_completed" },
] as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  if (diffHours < 1) return "updated just now";
  if (diffHours < 24) return `updated ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `updated ${diffDays}d ago`;
}

function QueueChip({
  label,
  tone,
}: {
  label: string;
  tone: "warning" | "info" | "success";
}) {
  const tones = {
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  } as const;

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {label}
    </span>
  );
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

  const [orgEmployees, adminEmployees, pendingLeaves, onboardingTasks, eventRows] = await Promise.all([
    isAdmin ? Promise.resolve([]) : listOrgChart(actor),
    isAdmin ? listEmployeesForAdmin(actor) : Promise.resolve([]),
    isAdmin ? listPendingLeavesWithEmployee(actor) : Promise.resolve([]),
    isAdmin ? listAllOnboardingTasks(actor) : Promise.resolve([]),
    isAdmin ? listActivationEvents(actor, ACTIVATION_EVENTS.map((e) => e.event)) : Promise.resolve([]),
  ]);

  const employees = isAdmin
    ? adminEmployees.map((employee) => ({
        id: employee.id,
        full_name: employee.full_name,
        role_title: employee.role_title,
        department: employee.department,
        manager_id: employee.manager_id,
        status: employee.status,
      }))
    : orgEmployees;

  const total = employees.length;
  const active = employees.filter((e) => e.status === "active").length;
  const onLeave = employees.filter((e) => e.status === "on_leave").length;
  const inactive = employees.filter((e) => e.status === "inactive").length;

  const pendingInvites = adminEmployees.filter(
    (e) => e.status !== "inactive" && e.setup_status === "incomplete",
  ).length;
  const pendingLeaveCount = pendingLeaves.length;
  const onboardingNeedsAttention = onboardingTasks.filter((task) => task.status === "pending").length;
  const pendingInviteEmployees = adminEmployees
    .filter((e) => e.status !== "inactive" && e.setup_status === "incomplete")
    .slice(0, 3);
  const onboardingAttentionItems = onboardingTasks.filter((task) => task.status === "pending").slice(0, 3);
  const employeeMap = new Map(adminEmployees.map((employee) => [employee.id, employee.full_name]));
  const latestQueueUpdate = [
    ...pendingInviteEmployees.map((employee) => employee.updated_at),
    ...pendingLeaves.map((leave) => leave.updated_at),
    ...onboardingAttentionItems.map((task) => task.updated_at),
  ].sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

  const eventMap = new Map(
    eventRows.map((r) => [r.event_name, r.created_at]),
  );

  const firedEvents = new Set(eventMap.keys());
  const isActivated = firedEvents.has("activation_completed");
  const completedSteps = SETUP_STEPS.filter((s) => firedEvents.has(s.event)).length;
  // First-run: only the admin in the system and none of the setup steps completed yet
  const isFirstRun = total <= 1 && completedSteps === 0;
  const nextStep = SETUP_STEPS.find((s) => !firedEvents.has(s.event));

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
        <form action={logoutAction}>
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

          {isAdmin ? (
            <section className="mt-6 rounded-xl border border-ink-300/70 bg-white/80 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-300/60 pb-4">
                <div>
                  <p className="text-[12px] tracking-[0.14em] text-ink-500">Needs attention</p>
                  <h2 className="text-[19px] font-medium tracking-tight">Manager action center</h2>
                  <p className="mt-1 text-[14px] text-ink-500">Start with the queues blocking activation and day-to-day approvals.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-500">
                  <QueueChip
                    label={pendingInvites > 0 || pendingLeaveCount > 0 || onboardingNeedsAttention > 0 ? "Action needed" : "Up to date"}
                    tone={pendingInvites > 0 || pendingLeaveCount > 0 || onboardingNeedsAttention > 0 ? "warning" : "success"}
                  />
                  <span>{latestQueueUpdate ? timeAgo(latestQueueUpdate) : "No recent queue activity"}</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/employees"
                  className="inline-flex rounded-full bg-ink-900 px-4 py-2 text-[13px] font-medium text-paper transition hover:bg-ink-700"
                >
                  Invite employee
                </Link>
                <Link
                  href="/onboarding"
                  className="inline-flex rounded-full border border-ink-300 px-4 py-2 text-[13px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900"
                >
                  Review onboarding
                </Link>
                <Link
                  href="/leaves"
                  className="inline-flex rounded-full border border-ink-300 px-4 py-2 text-[13px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900"
                >
                  Review leave requests
                </Link>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <article className="rounded-lg border border-ink-300/70 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[12px] text-ink-500">Pending invites</p>
                      <p className="mt-2 text-[24px] tracking-tight">{pendingInvites}</p>
                    </div>
                    <QueueChip label={pendingInvites > 0 ? "Needs follow-up" : "Clear"} tone={pendingInvites > 0 ? "warning" : "success"} />
                  </div>
                  <div className="mt-4 space-y-3">
                    {pendingInviteEmployees.length > 0 ? (
                      pendingInviteEmployees.map((employee) => (
                        <div key={employee.id} className="rounded-md border border-ink-200 bg-ink-50/60 px-3 py-2">
                          <p className="text-[13px] font-medium text-ink-900">{employee.full_name}</p>
                          <p className="text-[12px] text-ink-500">Invite pending since {formatDate(employee.updated_at)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[13px] text-ink-500">No team members are waiting on an invite right now.</p>
                    )}
                  </div>
                  <Link
                    href="/employees"
                    className="mt-4 inline-flex rounded-full bg-ink-900 px-3 py-1 text-[12px] font-medium text-paper transition hover:bg-ink-700"
                  >
                    Open employee queue
                  </Link>
                </article>

                <article className="rounded-lg border border-ink-300/70 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[12px] text-ink-500">Pending leave approvals</p>
                      <p className="mt-2 text-[24px] tracking-tight">{pendingLeaveCount}</p>
                    </div>
                    <QueueChip label={pendingLeaveCount > 0 ? "Waiting" : "Clear"} tone={pendingLeaveCount > 0 ? "info" : "success"} />
                  </div>
                  <div className="mt-4 space-y-3">
                    {pendingLeaves.slice(0, 3).map((leave) => (
                      <div key={leave.id} className="rounded-md border border-ink-200 bg-ink-50/60 px-3 py-2">
                        <p className="text-[13px] font-medium text-ink-900">{leave.employee_full_name}</p>
                        <p className="text-[12px] text-ink-500">
                          {formatDate(leave.start_date)} to {formatDate(leave.end_date)} · requested {formatDate(leave.created_at)}
                        </p>
                      </div>
                    ))}
                    {pendingLeaves.length === 0 ? (
                      <p className="text-[13px] text-ink-500">No leave approvals are waiting for you.</p>
                    ) : null}
                  </div>
                  <Link
                    href="/leaves"
                    className="mt-4 inline-flex rounded-full bg-ink-900 px-3 py-1 text-[12px] font-medium text-paper transition hover:bg-ink-700"
                  >
                    Open leave queue
                  </Link>
                </article>

                <article className="rounded-lg border border-ink-300/70 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[12px] text-ink-500">Incomplete onboarding</p>
                      <p className="mt-2 text-[24px] tracking-tight">{onboardingNeedsAttention}</p>
                    </div>
                    <QueueChip label={onboardingNeedsAttention > 0 ? "In progress" : "Clear"} tone={onboardingNeedsAttention > 0 ? "warning" : "success"} />
                  </div>
                  <div className="mt-4 space-y-3">
                    {onboardingAttentionItems.length > 0 ? (
                      onboardingAttentionItems.map((task) => (
                        <div key={task.id} className="rounded-md border border-ink-200 bg-ink-50/60 px-3 py-2">
                          <p className="text-[13px] font-medium text-ink-900">{task.title}</p>
                          <p className="text-[12px] text-ink-500">
                            {employeeMap.get(task.employee_id) ?? "Employee"} · added {formatDate(task.created_at)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[13px] text-ink-500">No onboarding tasks are stalled right now.</p>
                    )}
                  </div>
                  <Link
                    href="/onboarding"
                    className="mt-4 inline-flex rounded-full bg-ink-900 px-3 py-1 text-[12px] font-medium text-paper transition hover:bg-ink-700"
                  >
                    Open onboarding queue
                  </Link>
                </article>
              </div>
            </section>
          ) : null}
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
