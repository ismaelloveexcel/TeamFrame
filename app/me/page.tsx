import Link from "next/link";
import { requireTenantActor } from "@/middleware/rbac";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import {
  listOnboardingTasksForEmployee,
  type OnboardingTask,
} from "@/services/onboardingService";
import { listLeavesForEmployee, type LeaveRecord } from "@/services/leaveService";
import { completeOnboardingTaskAction } from "../onboarding/actions";
import { submitLeaveAction } from "../leaves/actions";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  completed: "Onboarding task completed.",
  submitted: "Leave request submitted.",
  session_recovered: "Your session was already active. The stale sign-in link was ignored.",
};

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that action.",
  NO_EMPLOYEE_RECORD: "Your account is not linked to an employee profile yet.",
  NO_TENANT_CONTEXT: "Session error — please sign out and back in.",
  STALE_WRITE: "This item changed. Refresh and try again.",
  MISSING_EXPECTED_UPDATED_AT: "This action is out of date. Refresh and retry.",
  INVALID_INPUT: "Check your input and try again.",
  ONBOARDING_COMPLETE_FAILED: "Could not complete the task.",
  LEAVE_SUBMIT_FAILED: "Could not submit the leave request.",
  UNKNOWN: "Something went wrong. Refresh and try again.",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TaskStatusBadge({ status }: { status: OnboardingTask["status"] }) {
  return status === "completed" ? (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
      Done
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
      Pending
    </span>
  );
}

function LeaveStatusBadge({ status }: { status: LeaveRecord["status"] }) {
  const styles: Record<LeaveRecord["status"], string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function progressMessage(progress: number, pendingCount: number): string {
  if (progress === 100 && pendingCount === 0) return "Everything for day one is complete.";
  if (progress >= 70) return "You are nearly done with your first-day setup.";
  if (progress > 0) return "Keep going. A few setup items are still open.";
  return "Start with the first task below and work through the list in order.";
}

function nextActionCopy(nextTask: OnboardingTask | null, hasProfile: boolean): string {
  if (!hasProfile) return "Ask your admin to finish linking your profile so your checklist can start.";
  if (nextTask) return `Start with: ${nextTask.title}`;
  return "You are caught up. Check leave requests or wait for your next assigned task.";
}

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const actor = await requireTenantActor();
  const { status, error } = await searchParams;

  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  const [myTasks, myLeaves] = actor.employeeId
    ? await Promise.all([
        listOnboardingTasksForEmployee(actor, actor.employeeId),
        listLeavesForEmployee(actor, actor.employeeId),
      ])
    : [[], []];

  const pendingTasks = myTasks.filter((task) => task.status === "pending");
  const completedTasks = myTasks.filter((task) => task.status === "completed");
  const leavePending = myLeaves.filter((leave) => leave.status === "pending").length;
  const leaveApproved = myLeaves.filter((leave) => leave.status === "approved").length;
  const leaveRejected = myLeaves.filter((leave) => leave.status === "rejected").length;
  const latestLeave = myLeaves[0] ?? null;
  const onboardingProgress = myTasks.length > 0 ? Math.round((completedTasks.length / myTasks.length) * 100) : 0;
  const nextTask = pendingTasks[0] ?? null;
  const isFullySetUp = actor.employeeId && onboardingProgress === 100 && pendingTasks.length === 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <nav className="mb-6 flex flex-wrap gap-4 text-[14px] text-ink-500">
        <Link href="/dashboard" className="hover:text-ink-900 transition">
          Dashboard
        </Link>
        <span className="text-ink-900 font-medium">My space</span>
        <Link href="/onboarding" className="hover:text-ink-900 transition">
          Onboarding
        </Link>
        <Link href="/leaves" className="hover:text-ink-900 transition">
          Leaves
        </Link>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Self-service</p>
          <h1 className="text-[34px] leading-tight tracking-tight">My work</h1>
          <p className="text-[14px] text-ink-500">
            Complete onboarding tasks and manage leave without touching the admin dashboard.
          </p>
        </div>
      </div>

      {successMessage ? (
        <p className="mt-7 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          role="alert"
          className="mt-7 rounded-lg border border-ink-300/80 bg-white/80 px-4 py-3 text-[14px] text-ink-700"
        >
          {errorMessage}
        </p>
      ) : null}

      {!actor.employeeId ? (
        <section className="mt-8 rounded-xl border border-dashed border-ink-300/80 bg-white/60 p-8 text-center">
          <p className="text-[15px] text-ink-700">Your account is not linked to an employee profile.</p>
          <p className="mt-2 text-[14px] text-ink-500">Ask your admin to add you as an employee first.</p>
        </section>
      ) : (
        <>
          <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[12px] tracking-[0.14em] text-ink-500">Start here</p>
                <h2 className="text-[24px] leading-tight tracking-tight text-ink-900">
                  {isFullySetUp ? "You are ready to go" : "Your first-day setup"}
                </h2>
                <p className="max-w-2xl text-[14px] text-ink-500">
                  {progressMessage(onboardingProgress, pendingTasks.length)}
                </p>
              </div>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-[12px] font-medium ${
                  isFullySetUp
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {isFullySetUp ? "Setup complete" : "Action needed"}
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
                <p className="text-[12px] text-ink-500">Profile setup</p>
                <p className="mt-2 text-[20px] tracking-tight text-ink-900">Ready</p>
                <p className="mt-1 text-[13px] text-ink-500">Your account is linked and ready for onboarding tasks.</p>
              </article>
              <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
                <p className="text-[12px] text-ink-500">Open onboarding tasks</p>
                <p className="mt-2 text-[20px] tracking-tight text-ink-900">{pendingTasks.length}</p>
                <p className="mt-1 text-[13px] text-ink-500">{nextActionCopy(nextTask, Boolean(actor.employeeId))}</p>
              </article>
              <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
                <p className="text-[12px] text-ink-500">Progress</p>
                <p className="mt-2 text-[20px] tracking-tight text-ink-900">{onboardingProgress}%</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-200">
                  <div
                    className="h-full rounded-full bg-ink-900 transition-all"
                    style={{ width: `${onboardingProgress}%` }}
                  />
                </div>
              </article>
            </div>

            {isFullySetUp ? (
              <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] text-emerald-700">
                Nice work. You have completed your first-day checklist and can now use TeamFrame normally.
              </p>
            ) : null}
          </section>

          <section className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-ink-300/70 bg-white/80 p-5">
              <p className="text-[12px] tracking-[0.14em] text-ink-500">Onboarding progress</p>
              <p className="mt-2 text-[28px] font-medium tabular-nums text-ink-900">
                {completedTasks.length}/{myTasks.length || 0}
              </p>
              <p className="mt-1 text-[14px] text-ink-500">{onboardingProgress}% complete</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink-200">
                <div
                  className="h-full rounded-full bg-ink-900 transition-all"
                  style={{ width: `${onboardingProgress}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-ink-300/70 bg-white/80 p-5">
              <p className="text-[12px] tracking-[0.14em] text-ink-500">Leave summary</p>
              <p className="mt-2 text-[28px] font-medium tabular-nums text-ink-900">
                {leavePending}
              </p>
              <p className="mt-1 text-[14px] text-ink-500">Pending requests</p>
              <p className="mt-3 text-[13px] text-ink-500 tabular-nums">
                {leaveApproved} approved · {leaveRejected} rejected
              </p>
            </div>

            <div className="rounded-xl border border-ink-300/70 bg-white/80 p-5">
              <p className="text-[12px] tracking-[0.14em] text-ink-500">Next step</p>
              <p className="mt-2 text-[20px] font-medium tracking-tight text-ink-900">
                {nextTask ? nextTask.title : "No open tasks"}
              </p>
              <p className="mt-1 text-[14px] text-ink-500">
                {nextTask ? "Complete it from this page to keep moving." : "You are caught up on onboarding."}
              </p>
              {latestLeave ? (
                <p className="mt-3 text-[13px] text-ink-500">
                  Latest leave: {latestLeave.status} · {formatDate(latestLeave.created_at)}
                </p>
              ) : null}
            </div>
          </section>

          <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[19px] font-medium tracking-tight">My onboarding tasks</h2>
                <p className="mt-1 text-[14px] text-ink-500">Complete the items assigned to your profile.</p>
              </div>
              <p className="text-[13px] text-ink-500 tabular-nums">
                {completedTasks.length} done · {pendingTasks.length} pending
              </p>
            </div>

            {myTasks.length === 0 ? (
              <p className="mt-4 text-[14px] text-ink-500">Your checklist is empty right now. New tasks will appear here when your manager assigns them.</p>
            ) : (
              <ul className="mt-4 divide-y divide-ink-300/40 rounded-xl border border-ink-300/60">
                {myTasks.map((task) => (
                  <li key={task.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                    <div className="space-y-0.5">
                      <p className="text-[15px] text-ink-900">{task.title}</p>
                      <p className="text-[12px] text-ink-500">
                        {task.status === "completed"
                          ? `Completed ${task.completed_at ? formatDate(task.completed_at) : ""}`.trim()
                          : `Assigned ${formatDate(task.created_at)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <TaskStatusBadge status={task.status} />
                      {task.status === "pending" ? (
                          <form action={completeOnboardingTaskAction}>
                            <input type="hidden" name="task_id" value={task.id} />
                            <input type="hidden" name="expected_updated_at" value={task.updated_at} />
                            <input type="hidden" name="return_to" value="/me" />
                            <PendingSubmitButton
                              idleLabel="Mark complete"
                              pendingLabel="Saving..."
                              className="rounded-full bg-ink-900 px-4 py-1.5 text-[13px] font-medium text-paper transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:bg-ink-300"
                            />
                          </form>
                        ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80 p-5">
            <h2 className="text-[19px] font-medium tracking-tight">Request leave</h2>
            <p className="mt-1 text-[14px] text-ink-500">Submit a request and track its status here.</p>
            <form action={submitLeaveAction} className="mt-4 flex flex-wrap items-end gap-3">
                <input type="hidden" name="return_to" value="/me" />
              <div className="flex flex-col gap-1">
                <label htmlFor="start_date" className="text-[12px] text-ink-500">
                  From
                </label>
                <input
                  id="start_date"
                  name="start_date"
                  type="date"
                  required
                  className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="end_date" className="text-[12px] text-ink-500">
                  To
                </label>
                <input
                  id="end_date"
                  name="end_date"
                  type="date"
                  required
                  className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
                />
              </div>
              <PendingSubmitButton
                idleLabel="Submit request"
                pendingLabel="Submitting..."
                className="rounded-full bg-ink-900 px-5 py-2 text-[14px] font-medium text-paper transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:bg-ink-300"
              />
            </form>
          </section>

          <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80">
            <div className="border-b border-ink-300/60 px-5 py-4">
              <h2 className="text-[17px] font-medium tracking-tight">My leave requests</h2>
            </div>
            {myLeaves.length === 0 ? (
              <div className="px-5 py-8 text-center text-[14px] text-ink-500">
                No leave requests yet. When you book time away, updates will appear here automatically.
              </div>
            ) : (
              <ul className="divide-y divide-ink-300/40">
                {myLeaves.map((leave) => (
                  <li key={leave.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="space-y-0.5">
                      <p className="text-[15px] text-ink-900">
                        {formatDate(leave.start_date)} → {formatDate(leave.end_date)}
                      </p>
                      <p className="text-[12px] text-ink-500">Submitted {formatDate(leave.created_at)}</p>
                    </div>
                    <LeaveStatusBadge status={leave.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}