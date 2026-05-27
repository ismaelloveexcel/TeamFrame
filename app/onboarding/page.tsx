import { requireTenantActor } from "@/middleware/rbac";
import {
  listAllOnboardingTasks,
  listOnboardingTasksForEmployee,
  type OnboardingTask,
} from "@/services/onboardingService";
import { listEmployeesForAdmin } from "@/services/employeeService";
import Link from "next/link";
import { assignOnboardingTaskAction, completeOnboardingTaskAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  assigned: "Task assigned.",
  completed: "Task marked complete.",
};

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that action.",
  NO_TENANT_CONTEXT: "Session error — please sign out and back in.",
  NO_EMPLOYEE_RECORD: "Your account is not linked to an employee profile yet.",
  INVALID_EMPLOYEE_ID: "That employee record is no longer available. Refresh and try again.",
  STALE_WRITE: "That record changed. Refresh and try again.",
  MISSING_EXPECTED_UPDATED_AT: "Missing concurrency marker. Refresh and retry.",
  INVALID_INPUT: "Check your input and try again.",
  ONBOARDING_ASSIGN_FAILED: "Could not assign task.",
  ONBOARDING_COMPLETE_FAILED: "Could not complete task.",
  UNKNOWN: "Unexpected error. Please retry.",
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

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const actor = await requireTenantActor();
  const { status, error } = await searchParams;

  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  if (actor.role === "admin") {
    const [tasks, employees] = await Promise.all([
      listAllOnboardingTasks(actor),
      listEmployeesForAdmin(actor),
    ]);

    const pending = tasks.filter((t) => t.status === "pending");
    const done = tasks.filter((t) => t.status === "completed");
    const employeeMap = new Map(employees.map((e) => [e.id, e.full_name]));

    return (
      <main className="mx-auto max-w-5xl px-6 py-14">
        <nav className="mb-6 flex gap-4 text-[14px] text-ink-500">
          <Link href="/dashboard" className="hover:text-ink-900 transition">Dashboard</Link>
          <Link href="/employees" className="hover:text-ink-900 transition">Employees</Link>
          <span className="text-ink-900 font-medium">Onboarding</span>
          <Link href="/leaves" className="hover:text-ink-900 transition">Leaves</Link>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
          <div className="space-y-2">
            <p className="text-[12px] tracking-[0.14em] text-ink-500">Admin</p>
            <h1 className="text-[34px] leading-tight tracking-tight">Onboarding tasks</h1>
          </div>
        </div>

        {successMessage ? (
          <p className="mt-7 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent">
            {successMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p role="alert" className="mt-7 rounded-lg border border-ink-300/80 bg-white/80 px-4 py-3 text-[14px] text-ink-700">
            {errorMessage}
          </p>
        ) : null}

        <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80 p-5">
          <h2 className="text-[19px] font-medium tracking-tight">Assign task</h2>
          {employees.length === 0 ? (
            <p className="mt-3 text-[14px] text-ink-500">
              No employees yet.{" "}
              <Link href="/employees" className="underline hover:text-ink-900">Add an employee</Link> first.
            </p>
          ) : (
            <form action={assignOnboardingTaskAction} className="mt-4 flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="employee_id" className="text-[12px] text-ink-500">Employee</label>
                <select
                  id="employee_id"
                  name="employee_id"
                  required
                  className="rounded-md border border-ink-300 px-3 py-2 text-[14px] bg-white"
                >
                  <option value="">Select employee…</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} — {e.role_title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                <label htmlFor="title" className="text-[12px] text-ink-500">Task</label>
                <input
                  id="title"
                  name="title"
                  placeholder="e.g. Complete payroll setup"
                  required
                  className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
                />
              </div>
              <button
                type="submit"
                className="rounded-full bg-ink-900 px-5 py-2 text-[14px] font-medium text-paper transition hover:bg-ink-700"
              >
                Assign
              </button>
            </form>
          )}
        </section>

        {pending.length > 0 ? (
          <section className="mt-6 rounded-xl border border-ink-300/70 bg-white/80">
            <div className="border-b border-ink-300/60 px-5 py-4">
              <h2 className="text-[17px] font-medium tracking-tight">Pending — {pending.length}</h2>
            </div>
            <ul className="divide-y divide-ink-300/40">
              {pending.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="space-y-0.5">
                    <p className="text-[15px] text-ink-900">{task.title}</p>
                    <p className="text-[12px] text-ink-500">
                      {employeeMap.get(task.employee_id) ?? task.employee_id} · Assigned {formatDate(task.created_at)}
                    </p>
                  </div>
                  <TaskStatusBadge status={task.status} />
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="mt-6 rounded-xl border border-dashed border-ink-300/80 bg-white/60 p-8 text-center">
            <p className="text-[15px] text-ink-700">No pending tasks.</p>
            <p className="mt-2 text-[14px] text-ink-500">Assign a task above to start tracking onboarding progress.</p>
          </section>
        )}

        {done.length > 0 ? (
          <section className="mt-6 rounded-xl border border-ink-300/70 bg-white/80">
            <div className="border-b border-ink-300/60 px-5 py-4">
              <h2 className="text-[17px] font-medium tracking-tight text-ink-500">Completed — {done.length}</h2>
            </div>
            <ul className="divide-y divide-ink-300/40">
              {done.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-4 px-5 py-4 opacity-60">
                  <div className="space-y-0.5">
                    <p className="text-[15px] text-ink-900 line-through">{task.title}</p>
                    <p className="text-[12px] text-ink-500">
                      {employeeMap.get(task.employee_id) ?? task.employee_id} · Done {task.completed_at ? formatDate(task.completed_at) : "—"}
                    </p>
                  </div>
                  <TaskStatusBadge status={task.status} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    );
  }

  // Employee view
  const myTasks = actor.employeeId
    ? await listOnboardingTasksForEmployee(actor, actor.employeeId)
    : [];

  const pending = myTasks.filter((t) => t.status === "pending");
  const done = myTasks.filter((t) => t.status === "completed");

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <nav className="mb-6 flex gap-4 text-[14px] text-ink-500">
        <Link href="/dashboard" className="hover:text-ink-900 transition">Dashboard</Link>
        <span className="text-ink-900 font-medium">Onboarding</span>
        <Link href="/leaves" className="hover:text-ink-900 transition">Leaves</Link>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Your checklist</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Onboarding</h1>
        </div>
      </div>

      {successMessage ? (
        <p className="mt-7 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p role="alert" className="mt-7 rounded-lg border border-ink-300/80 bg-white/80 px-4 py-3 text-[14px] text-ink-700">
          {errorMessage}
        </p>
      ) : null}

      {!actor.employeeId ? (
        <section className="mt-8 rounded-xl border border-dashed border-ink-300/80 bg-white/60 p-8 text-center">
          <p className="text-[15px] text-ink-700">Your account is not linked to an employee profile.</p>
          <p className="mt-2 text-[14px] text-ink-500">Ask your admin to add you as an employee.</p>
        </section>
      ) : pending.length === 0 && done.length === 0 ? (
        <section className="mt-8 rounded-xl border border-dashed border-ink-300/80 bg-white/60 p-8 text-center">
          <p className="text-[15px] text-ink-700">No tasks assigned yet.</p>
          <p className="mt-2 text-[14px] text-ink-500">Your admin will assign onboarding tasks here.</p>
        </section>
      ) : (
        <>
          {pending.length > 0 ? (
            <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80">
              <div className="border-b border-ink-300/60 px-5 py-4">
                <h2 className="text-[17px] font-medium tracking-tight">To do — {pending.length}</h2>
              </div>
              <ul className="divide-y divide-ink-300/40">
                {pending.map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="space-y-0.5">
                      <p className="text-[15px] text-ink-900">{task.title}</p>
                      <p className="text-[12px] text-ink-500">Assigned {formatDate(task.created_at)}</p>
                    </div>
                    <form action={completeOnboardingTaskAction}>
                      <input type="hidden" name="task_id" value={task.id} />
                      <input type="hidden" name="expected_updated_at" value={task.updated_at} />
                      <button
                        type="submit"
                        className="rounded-full bg-ink-900 px-4 py-1.5 text-[13px] font-medium text-paper transition hover:bg-ink-700"
                      >
                        Mark done
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {done.length > 0 ? (
            <section className="mt-6 rounded-xl border border-ink-300/70 bg-white/80">
              <div className="border-b border-ink-300/60 px-5 py-4">
                <h2 className="text-[17px] font-medium tracking-tight text-ink-500">Completed — {done.length}</h2>
              </div>
              <ul className="divide-y divide-ink-300/40">
                {done.map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-4 px-5 py-4 opacity-60">
                    <div className="space-y-0.5">
                      <p className="text-[15px] text-ink-900 line-through">{task.title}</p>
                      <p className="text-[12px] text-ink-500">
                        Done {task.completed_at ? formatDate(task.completed_at) : "—"}
                      </p>
                    </div>
                    <TaskStatusBadge status={task.status} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
