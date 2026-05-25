import { requireTenantActor } from "@/middleware/rbac";
import {
  listLeavesForEmployee,
  listPendingLeaves,
  type LeaveRecord,
} from "@/services/leaveService";
import Link from "next/link";
import { submitLeaveAction, decideLeaveAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  submitted: "Leave request submitted.",
  decided: "Decision recorded.",
};

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that action.",
  NO_EMPLOYEE_RECORD: "Your account is not linked to an employee profile yet. Ask your admin.",
  NO_TENANT_CONTEXT: "Session error — please sign out and back in.",
  STALE_WRITE: "That record changed. Refresh and try again.",
  MISSING_EXPECTED_UPDATED_AT: "Missing concurrency marker. Refresh and retry.",
  INVALID_INPUT: "Check the dates and try again.",
  LEAVE_SUBMIT_FAILED: "Could not submit leave request.",
  LEAVE_DECISION_FAILED: "Could not record decision.",
  UNKNOWN: "Unexpected error. Please retry.",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: LeaveRecord["status"] }) {
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

export default async function LeavesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const actor = await requireTenantActor();
  const { status, error } = await searchParams;

  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  if (actor.role === "admin") {
    const pending = await listPendingLeaves(actor);

    return (
      <main className="mx-auto max-w-5xl px-6 py-14">
        <nav className="mb-6 flex gap-4 text-[14px] text-ink-500">
          <Link href="/dashboard" className="hover:text-ink-900 transition">
            Dashboard
          </Link>
          <Link href="/employees" className="hover:text-ink-900 transition">
            Employees
          </Link>
          <span className="text-ink-900 font-medium">Leaves</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
          <div className="space-y-2">
            <p className="text-[12px] tracking-[0.14em] text-ink-500">Admin queue</p>
            <h1 className="text-[34px] leading-tight tracking-tight">Leave requests</h1>
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

        {pending.length === 0 ? (
          <section className="mt-10 rounded-xl border border-dashed border-ink-300/80 bg-white/60 p-8 text-center">
            <p className="text-[16px] text-ink-700">No pending leave requests.</p>
            <p className="mt-2 text-[14px] text-ink-500">
              New requests from employees will appear here for your review.
            </p>
          </section>
        ) : (
          <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80">
            <div className="border-b border-ink-300/60 px-5 py-4">
              <h2 className="text-[17px] font-medium tracking-tight">
                Pending — {pending.length}
              </h2>
            </div>
            <ul className="divide-y divide-ink-300/40">
              {pending.map((leave) => (
                <li key={leave.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-[13px] text-ink-500 font-mono">
                      {leave.employee_id}
                    </p>
                    <p className="text-[15px] text-ink-900">
                      {formatDate(leave.start_date)} → {formatDate(leave.end_date)}
                    </p>
                    <p className="text-[12px] text-ink-500">
                      Submitted {formatDate(leave.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={decideLeaveAction}>
                      <input type="hidden" name="leave_id" value={leave.id} />
                      <input
                        type="hidden"
                        name="expected_updated_at"
                        value={leave.updated_at}
                      />
                      <input type="hidden" name="decision" value="approved" />
                      <button
                        type="submit"
                        className="rounded-full bg-ink-900 px-4 py-1.5 text-[13px] font-medium text-paper transition hover:bg-ink-700"
                      >
                        Approve
                      </button>
                    </form>
                    <form action={decideLeaveAction}>
                      <input type="hidden" name="leave_id" value={leave.id} />
                      <input
                        type="hidden"
                        name="expected_updated_at"
                        value={leave.updated_at}
                      />
                      <input type="hidden" name="decision" value="rejected" />
                      <button
                        type="submit"
                        className="rounded-full border border-ink-300 px-4 py-1.5 text-[13px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900"
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    );
  }

  // Employee view
  const myLeaves = actor.employeeId
    ? await listLeavesForEmployee(actor, actor.employeeId)
    : [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <nav className="mb-6 flex gap-4 text-[14px] text-ink-500">
        <Link href="/dashboard" className="hover:text-ink-900 transition">
          Dashboard
        </Link>
        <Link href="/employees" className="hover:text-ink-900 transition">
          Employees
        </Link>
        <span className="text-ink-900 font-medium">Leaves</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Self-service</p>
          <h1 className="text-[34px] leading-tight tracking-tight">My leave</h1>
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

      {actor.employeeId ? (
        <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80 p-5">
          <h2 className="text-[19px] font-medium tracking-tight">Request leave</h2>
          <form action={submitLeaveAction} className="mt-4 flex flex-wrap items-end gap-3">
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
            <button
              type="submit"
              className="rounded-full bg-ink-900 px-5 py-2 text-[14px] font-medium text-paper transition hover:bg-ink-700"
            >
              Submit request
            </button>
          </form>
        </section>
      ) : (
        <section className="mt-8 rounded-xl border border-dashed border-ink-300/80 bg-white/60 p-8 text-center">
          <p className="text-[15px] text-ink-700">
            Your account is not linked to an employee profile.
          </p>
          <p className="mt-2 text-[14px] text-ink-500">
            Ask your admin to add you as an employee.
          </p>
        </section>
      )}

      {myLeaves.length > 0 ? (
        <section className="mt-6 rounded-xl border border-ink-300/70 bg-white/80">
          <div className="border-b border-ink-300/60 px-5 py-4">
            <h2 className="text-[17px] font-medium tracking-tight">History</h2>
          </div>
          <ul className="divide-y divide-ink-300/40">
            {myLeaves.map((leave) => (
              <li key={leave.id} className="flex items-center justify-between px-5 py-4">
                <div className="space-y-0.5">
                  <p className="text-[15px] text-ink-900">
                    {formatDate(leave.start_date)} → {formatDate(leave.end_date)}
                  </p>
                  <p className="text-[12px] text-ink-500">
                    Submitted {formatDate(leave.created_at)}
                  </p>
                </div>
                <StatusBadge status={leave.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : actor.employeeId ? (
        <p className="mt-6 text-[14px] text-ink-500">No leave requests yet.</p>
      ) : null}
    </main>
  );
}
