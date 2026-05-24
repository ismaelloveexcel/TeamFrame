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

const ORG_STATUS_COPY: Record<string, string> = {
  active: "Ready to run",
  on_leave: "Needs attention",
  inactive: "Inactive",
};

const ORG_STATUS_TONE: Record<string, "ready" | "attention" | "inactive"> = {
  active: "ready",
  on_leave: "attention",
  inactive: "inactive",
};

export function OrgChart({ employees }: { employees: OrgChartEmployee[] }) {
  if (employees.length === 0) {
    return (
      <div className="tf-panel px-5 py-6 text-[14px] text-[var(--color-ink-500)]">
        No data records yet. Add the first employee record to review reporting lines.
      </div>
    );
  }

  return (
    <ul className="tf-panel divide-y divide-[var(--color-ink-300)] bg-white">
      {employees.map((e) => (
        <li key={e.id} className="flex items-center justify-between px-5 py-4">
          <div className="space-y-0.5">
            <p className="text-[15px] tracking-tight">{e.full_name}</p>
            <p className="text-[13px] text-[var(--color-ink-500)]">
              {e.role_title} · {e.department}
            </p>
          </div>
          <span
            className="tf-status-badge"
            aria-label={`Status: ${e.status}`}
            data-tone={ORG_STATUS_TONE[e.status] ?? "neutral"}
          >
            {ORG_STATUS_COPY[e.status] ?? e.status.replace("_", " ")}
          </span>
        </li>
      ))}
    </ul>
  );
}
