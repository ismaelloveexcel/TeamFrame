/**
 * LeaveList — minimal leave display.
 *
 * Scope lock: request / approve / reject only.
 * Forbidden: accrual balances, calendar widgets, escalation status, charts.
 */

import type { LeaveRecord } from "@/services/leaveService";

const LEAVE_STATUS_COPY: Record<string, string> = {
  pending: "Needs attention",
  approved: "Ready to run",
  rejected: "Rejected",
};

const LEAVE_STATUS_TONE: Record<string, "attention" | "ready" | "inactive"> = {
  pending: "attention",
  approved: "ready",
  rejected: "inactive",
};

export function LeaveList({ leaves }: { leaves: LeaveRecord[] }) {
  if (leaves.length === 0) {
    return (
      <div className="tf-panel px-5 py-6 text-[14px] text-[var(--color-ink-500)]">
        No status changes are waiting review. Any leave updates that affect the next payroll batch will appear here.
      </div>
    );
  }

  return (
    <ul className="tf-panel divide-y divide-[var(--color-ink-300)] bg-white">
      {leaves.map((l) => (
        <li key={l.id} className="flex items-center justify-between px-5 py-4">
          <div className="space-y-0.5">
            <p className="text-[14px]">
              {l.start_date} → {l.end_date}
            </p>
            <p className="text-[12px] text-[var(--color-ink-500)]">Status change window</p>
          </div>
          <p className="tf-status-badge" data-tone={LEAVE_STATUS_TONE[l.status] ?? "neutral"}>
            {LEAVE_STATUS_COPY[l.status] ?? l.status.replace("_", " ")}
          </p>
        </li>
      ))}
    </ul>
  );
}
