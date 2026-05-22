/**
 * LeaveList — minimal leave display.
 *
 * Scope lock: request / approve / reject only.
 * Forbidden: accrual balances, calendar widgets, escalation status, charts.
 */

import type { LeaveRecord } from "@/services/leaveService";

export function LeaveList({ leaves }: { leaves: LeaveRecord[] }) {
  if (leaves.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-ink-300)] bg-white px-5 py-6 text-[14px] text-[var(--color-ink-500)]">
        No leave requests.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-ink-300)] rounded-lg border border-[var(--color-ink-300)] bg-white">
      {leaves.map((l) => (
        <li key={l.id} className="flex items-center justify-between px-5 py-4">
          <div className="space-y-0.5">
            <p className="text-[14px]">
              {l.start_date} → {l.end_date}
            </p>
            <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--color-ink-500)]">
              {l.status}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
