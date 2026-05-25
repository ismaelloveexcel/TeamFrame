import { requireTenantActor } from "@/middleware/rbac";
import { OrgChart } from "@/components/OrgChart";
import { listEmployeesForAdmin, listOrgChart } from "@/services/employeeService";
import Link from "next/link";
import { createEmployeeAction, updateEmployeeAction, archiveEmployeeAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  created: "Employee created.",
  updated: "Employee updated.",
  archived: "Employee archived.",
};

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that action.",
  STALE_WRITE: "That record changed. Refresh and try again.",
  MISSING_EXPECTED_UPDATED_AT: "Missing concurrency marker. Refresh and retry.",
  NO_PATCH_FIELDS: "No editable fields were provided.",
  EMPLOYEE_CREATE_FAILED: "Could not create employee.",
  EMPLOYEE_UPDATE_FAILED: "Could not update employee.",
  EMPLOYEE_DELETE_FAILED: "Could not archive employee.",
  INVALID_INPUT: "Input validation failed.",
  UNKNOWN: "Unexpected error. Please retry.",
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const actor = await requireTenantActor();
  const { status, error } = await searchParams;

  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  if (actor.role !== "admin") {
    const employees = await listOrgChart(actor);
    return (
      <main className="mx-auto max-w-5xl px-6 py-14">
        <nav className="mb-6 flex gap-4 text-[14px] text-ink-500">
          <span className="text-ink-900 font-medium">Employees</span>
          <Link href="/org-chart" className="hover:text-ink-900 transition">Org chart</Link>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
          <div className="space-y-2">
            <p className="text-[12px] tracking-[0.14em] text-ink-500">Directory</p>
            <h1 className="text-[34px] leading-tight tracking-tight">People map</h1>
          </div>
          <p className="text-[12px] text-ink-500">Published 22 May 2026 · 14:02 UTC</p>
        </div>
        <p className="mt-7 max-w-prose text-[15px] text-ink-700">
          Team structure with role, department, and reporting lines.
        </p>
        <section className="mt-9">
          <OrgChart employees={employees} />
        </section>
      </main>
    );
  }

  const employees = await listEmployeesForAdmin(actor);

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <nav className="mb-6 flex gap-4 text-[14px] text-ink-500">
        <span className="text-ink-900 font-medium">Employees</span>
        <Link href="/org-chart" className="hover:text-ink-900 transition">Org chart</Link>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Admin queue</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Employee pipeline</h1>
        </div>
        <p className="text-[12px] text-ink-500">Published 22 May 2026 · 14:02 UTC</p>
      </div>

      <p className="mt-7 max-w-2xl text-[15px] text-ink-700">
        Prioritized staffing surface for profile updates, status decisions, and archival actions.
      </p>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Total profiles</p>
          <p className="mt-2 text-[24px] tracking-tight">{employees.length}</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Active</p>
          <p className="mt-2 text-[24px] tracking-tight">
            {employees.filter((employee) => employee.status === "active").length}
          </p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">On leave</p>
          <p className="mt-2 text-[24px] tracking-tight">
            {employees.filter((employee) => employee.status === "on_leave").length}
          </p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Inactive</p>
          <p className="mt-2 text-[24px] tracking-tight">
            {employees.filter((employee) => employee.status === "inactive").length}
          </p>
        </article>
      </section>

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

      <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80 p-5">
        <h2 className="text-[19px] font-medium tracking-tight">Add employee</h2>
        <form action={createEmployeeAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            name="full_name"
            placeholder="Full name"
            required
            className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
          />
          <input
            name="email"
            type="email"
            placeholder="work@company.com"
            required
            className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
          />
          <input
            name="role_title"
            placeholder="Role title"
            required
            className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
          />
          <input
            name="department"
            placeholder="Department"
            required
            className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
          />
          <input
            name="timezone"
            placeholder="Timezone (e.g. UTC)"
            defaultValue="UTC"
            required
            className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
          />
          <button
            type="submit"
            className="rounded-md bg-ink-900 px-4 py-2 text-[14px] font-medium text-paper"
          >
            Create employee
          </button>
        </form>
      </section>

      <section className="mt-8 space-y-4">
        {employees.length === 0 ? (
          <div className="rounded-xl border border-ink-300/70 bg-white/80 px-5 py-6 text-[14px] text-ink-500">
            No employees yet.
          </div>
        ) : (
          employees.map((employee) => (
            <article key={employee.id} className="rounded-xl border border-ink-300/70 bg-white/80 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[19px] font-medium tracking-tight">{employee.full_name}</h3>
                  <p className="text-[13px] text-ink-500">{employee.email}</p>
                </div>
                <span className="text-[12px] tracking-[0.12em] text-ink-500">
                  {employee.status.replace("_", " ")}
                </span>
              </div>

              <form action={updateEmployeeAction} className="mt-4 grid gap-3 md:grid-cols-4">
                <input type="hidden" name="employee_id" value={employee.id} />
                <input type="hidden" name="expected_updated_at" value={employee.updated_at} />
                <input
                  name="role_title"
                  defaultValue={employee.role_title}
                  className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
                />
                <input
                  name="department"
                  defaultValue={employee.department}
                  className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
                />
                <select
                  name="status"
                  defaultValue={employee.status}
                  className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
                >
                  <option value="active">active</option>
                  <option value="on_leave">on_leave</option>
                  <option value="inactive">inactive</option>
                </select>
                <button
                  type="submit"
                  className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
                >
                  Save
                </button>
              </form>

              <form action={archiveEmployeeAction} className="mt-3">
                <input type="hidden" name="employee_id" value={employee.id} />
                <input type="hidden" name="expected_updated_at" value={employee.updated_at} />
                <button
                  type="submit"
                  className="text-[13px] text-ink-700 underline decoration-ink-300 underline-offset-4"
                >
                  Archive employee
                </button>
              </form>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
