/**
 * EmployeeProfile — single-employee detail view.
 *
 * Authorization is enforced by the server before this component renders.
 * The server decides which fields are present in `employee` (self vs admin
 * scope). Do not add client-side filtering as a security boundary.
 */

import type { EmployeeFullRecord } from "@/services/employeeService";

const EMPLOYEE_STATUS_COPY: Record<string, string> = {
  active: "Ready to run",
  on_leave: "Needs attention",
  inactive: "Inactive",
};

export type EmployeeProfileProps = {
  employee: EmployeeFullRecord;
  bio?: string;
};

export function EmployeeProfile({ employee, bio }: EmployeeProfileProps) {
  return (
    <article className="space-y-8">
      <header className="space-y-1">
        <p className="text-[12px] uppercase tracking-[0.18em] text-[var(--color-ink-500)]">
          Data record
        </p>
        <h1 className="text-[32px] leading-tight tracking-tight">{employee.full_name}</h1>
        <p className="text-[15px] text-[var(--color-ink-700)]">{employee.role_title} · {employee.department}</p>
      </header>

      {bio ? (
        <p className="max-w-prose text-[15px] leading-relaxed text-[var(--color-ink-700)]">
          {bio}
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-y-3 text-[14px]">
        <dt className="text-[var(--color-ink-500)]">Work email</dt>
        <dd>{employee.email}</dd>
        <dt className="text-[var(--color-ink-500)]">Timezone</dt>
        <dd>{employee.timezone}</dd>
        <dt className="text-[var(--color-ink-500)]">Record status</dt>
        <dd>{EMPLOYEE_STATUS_COPY[employee.status] ?? employee.status.replace("_", " ")}</dd>
        <dt className="text-[var(--color-ink-500)]">Record readiness</dt>
        <dd>{employee.setup_status.replace("_", " ")}</dd>
      </dl>
    </article>
  );
}
