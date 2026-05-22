/**
 * OrgChart — non-sensitive employee-scope view.
 *
 * Renders only the org-chart whitelist (see docs/rbac-rules.md):
 *  id, full_name, role_title, department, manager_id, status, photo_url.
 *
 * Compensation, personal_details, and document references MUST NEVER reach
 * this component. The server is responsible for honoring the whitelist.
 */

import type { OrgChartEmployee } from "@/services/employeeService";

export function OrgChart({ employees }: { employees: OrgChartEmployee[] }) {
  if (employees.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-ink-300)] bg-white px-5 py-6 text-[14px] text-[var(--color-ink-500)]">
        No one is on the team yet. Add your first employee to see the chart.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-ink-300)] rounded-lg border border-[var(--color-ink-300)] bg-white">
      {employees.map((e) => (
        <li key={e.id} className="flex items-center justify-between px-5 py-4">
          <div className="space-y-0.5">
            <p className="text-[15px] tracking-tight">{e.full_name}</p>
            <p className="text-[13px] text-[var(--color-ink-500)]">
              {e.role_title} · {e.department}
            </p>
          </div>
          <span
            className="text-[12px] uppercase tracking-[0.14em] text-[var(--color-ink-500)]"
            aria-label={`Status: ${e.status}`}
          >
            {e.status.replace("_", " ")}
          </span>
        </li>
      ))}
    </ul>
  );
}
