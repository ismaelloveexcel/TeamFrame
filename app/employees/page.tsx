import { requireTenantActor } from "@/middleware/rbac";
import { OrgChart } from "@/components/OrgChart";
import { listOrgChart, listPayrollReadinessForAdmin } from "@/services/employeeService";
import {
  listRecentExportHistory,
  syncWorkspaceValidationProgress,
} from "@/services/validationService";
import { createEmployeeAction, updateEmployeeAction, archiveEmployeeAction } from "./actions";
import { ExportCsvButton } from "./ExportCsvButton";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  created: "Data record created.",
  updated: "Data record updated.",
  archived: "Data record archived.",
};

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that action.",
  CANNOT_DELETE_SELF: "You cannot archive your own account.",
  NOT_FOUND: "That employee record could not be found.",
  STALE_WRITE: "That record changed. Refresh and try again.",
  MISSING_EXPECTED_UPDATED_AT: "Missing concurrency marker. Refresh and retry.",
  NO_PATCH_FIELDS: "No editable fields were provided.",
  EMPLOYEE_CREATE_FAILED: "Could not create employee.",
  EMPLOYEE_UPDATE_FAILED: "Could not update employee.",
  EMPLOYEE_DELETE_FAILED: "Could not archive employee.",
  INVALID_INPUT: "Input validation failed.",
  UNKNOWN: "Unexpected error. Please retry.",
};

const RECORD_STATUS_COPY: Record<string, string> = {
  active: "Ready to run",
  on_leave: "Needs attention",
  inactive: "Inactive",
};

function formatDateTime(value: string | null): string {
  if (!value) return "Not yet";
  return new Date(value).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

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
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
          <div className="space-y-2">
            <p className="text-[12px] tracking-[0.14em] text-ink-500">Reporting view</p>
            <h1 className="text-[34px] leading-tight tracking-tight">Payroll reporting lines</h1>
          </div>
          <p className="text-[12px] text-ink-500">Reference only · no payroll execution</p>
        </div>
        <p className="mt-7 max-w-prose text-[15px] text-ink-700">
          Reference designation, department, and record status before finance export review.
        </p>
        <section className="mt-9">
          <OrgChart employees={employees} />
        </section>
      </main>
    );
  }

  const employees = await listPayrollReadinessForAdmin(actor);
  const readyToRunCount = employees.filter((employee) => employee.ready_for_finance_export).length;
  const blockedCount = employees.length - readyToRunCount;
  const missingBankDetailsCount = employees.filter(
    (employee) =>
      !employee.bank_name || !employee.bank_account || !employee.bank_code,
  ).length;
  const missingSalaryFieldsCount = employees.filter(
    (employee) => employee.base_salary === null || !employee.currency,
  ).length;
  const inactiveCount = employees.filter((employee) => employee.status === "inactive").length;

  let validationState: Awaited<ReturnType<typeof syncWorkspaceValidationProgress>> | null = null;
  let exportHistory: Awaited<ReturnType<typeof listRecentExportHistory>> = [];
  let telemetryUnavailable = false;

  try {
    validationState = await syncWorkspaceValidationProgress(actor, {
      totalRecords: employees.length,
      readyRecords: readyToRunCount,
      unresolvedIssues: blockedCount,
    });
    exportHistory = await listRecentExportHistory(actor, 6);
  } catch {
    telemetryUnavailable = true;
  }

  const exportRows = employees.map((employee) => ({
    employee_name: employee.full_name,
    work_email: employee.email,
    designation: employee.role_title,
    department: employee.department,
    base_salary: employee.base_salary === null ? "" : employee.base_salary.toFixed(2),
    currency: employee.currency ?? "",
    pay_frequency: employee.pay_frequency ?? "",
    bank_name: employee.bank_name ?? "",
    bank_account: employee.bank_account ?? "",
    bank_code: employee.bank_code ?? "",
    employment_status: employee.status,
    export_readiness: employee.ready_for_finance_export ? "Ready for finance export" : "Export blocked",
    readiness_notes: employee.readiness_issues.join("; "),
  }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Payroll inputs</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Employee data records</h1>
        </div>
        <p className="text-[12px] text-ink-500">Finance-ready export packet workspace</p>
      </div>

      <p className="mt-7 max-w-2xl text-[15px] text-ink-700">
        Keep payroll inputs current, review record status, and prepare a clean finance export packet.
      </p>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="tf-kpi">
          <p className="text-[12px] text-ink-500">Data records</p>
          <p className="mt-2 text-[24px] tracking-tight">{employees.length}</p>
        </article>
        <article className="tf-kpi">
          <p className="text-[12px] text-ink-500">Ready to run</p>
          <p className="mt-2 text-[24px] tracking-tight">{readyToRunCount}</p>
        </article>
        <article className="tf-kpi">
          <p className="text-[12px] text-ink-500">Export blocked</p>
          <p className="mt-2 text-[24px] tracking-tight">{blockedCount}</p>
        </article>
        <article className="tf-kpi">
          <p className="text-[12px] text-ink-500">Missing bank details</p>
          <p className="mt-2 text-[24px] tracking-tight">{missingBankDetailsCount}</p>
        </article>
        <article className="tf-kpi">
          <p className="text-[12px] text-ink-500">Missing salary fields</p>
          <p className="mt-2 text-[24px] tracking-tight">{missingSalaryFieldsCount}</p>
        </article>
      </section>

      <section className="tf-panel mt-8 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-medium tracking-tight">Readiness validation</h2>
            <p className="mt-1 max-w-2xl text-[13px] text-ink-500">
              Can finance run payroll from this dataset today? Resolve blocked rows before export handoff.
            </p>
          </div>
          <span className="tf-status-badge" data-tone={blockedCount === 0 ? "ready" : "attention"}>
            {blockedCount === 0 ? "Ready for finance export" : "Needs attention"}
          </span>
        </div>

        <ul className="mt-4 space-y-2 text-[13px] text-ink-700">
          <li className="flex items-center justify-between border-b border-ink-100 pb-2">
            <span>Records blocked from export</span>
            <strong>{blockedCount}</strong>
          </li>
          <li className="flex items-center justify-between border-b border-ink-100 pb-2">
            <span>Rows missing bank details</span>
            <strong>{missingBankDetailsCount}</strong>
          </li>
          <li className="flex items-center justify-between border-b border-ink-100 pb-2">
            <span>Rows missing salary or currency</span>
            <strong>{missingSalaryFieldsCount}</strong>
          </li>
          <li className="flex items-center justify-between">
            <span>Inactive rows in dataset</span>
            <strong>{inactiveCount}</strong>
          </li>
        </ul>
      </section>

      <section className="tf-panel mt-8 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-medium tracking-tight">Finance export</h2>
            <p className="mt-1 max-w-2xl text-[13px] text-ink-500">
              One click before finance runs payroll. Export CSV with spreadsheet-friendly payroll input columns.
            </p>
          </div>
          <span className="tf-status-badge" data-tone="neutral">CSV export</span>
        </div>
        <div className="mt-4">
          <ExportCsvButton rows={exportRows} />
        </div>
        {validationState && validationState.export_count === 0 ? (
          <p className="mt-4 text-[12px] text-ink-500">
            First export path: keep active rows complete, resolve blocked warnings, then export the finance CSV.
          </p>
        ) : null}
      </section>

      <section className="tf-panel mt-8 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-medium tracking-tight">Validation status</h2>
            <p className="mt-1 max-w-2xl text-[13px] text-ink-500">
              Lightweight workspace tracking for onboarding speed, conversion readiness, and repeat export behavior.
            </p>
          </div>
          <span className="tf-status-badge" data-tone="neutral">30-day validation mode</span>
        </div>

        {telemetryUnavailable ? (
          <p className="mt-4 rounded-md border border-ink-300 bg-white/80 px-3 py-2 text-[12px] text-ink-700">
            Validation tracking is temporarily unavailable. Refresh to retry.
          </p>
        ) : validationState ? (
          <ul className="mt-4 space-y-2 text-[13px] text-ink-700">
            <li className="flex items-center justify-between border-b border-ink-100 pb-2">
              <span>Workspace created</span>
              <strong>{formatDateTime(validationState.workspace_created_at)}</strong>
            </li>
            <li className="flex items-center justify-between border-b border-ink-100 pb-2">
              <span>Trial status</span>
              <strong>{validationState.trial_status}</strong>
            </li>
            <li className="flex items-center justify-between border-b border-ink-100 pb-2">
              <span>Plan label</span>
              <strong>{validationState.plan_label}</strong>
            </li>
            <li className="flex items-center justify-between border-b border-ink-100 pb-2">
              <span>Activation state</span>
              <strong>{validationState.activation_state}</strong>
            </li>
            <li className="flex items-center justify-between border-b border-ink-100 pb-2">
              <span>Onboarding completion</span>
              <strong>{validationState.onboarding_completion_state}</strong>
            </li>
            <li className="flex items-center justify-between border-b border-ink-100 pb-2">
              <span>First import completed</span>
              <strong>{formatDateTime(validationState.first_import_completed_at)}</strong>
            </li>
            <li className="flex items-center justify-between border-b border-ink-100 pb-2">
              <span>First payroll-ready validation</span>
              <strong>{formatDateTime(validationState.first_payroll_ready_validation_at)}</strong>
            </li>
            <li className="flex items-center justify-between border-b border-ink-100 pb-2">
              <span>First export generated</span>
              <strong>{formatDateTime(validationState.first_export_generated_at)}</strong>
            </li>
            <li className="flex items-center justify-between border-b border-ink-100 pb-2">
              <span>Total exports</span>
              <strong>{validationState.export_count}</strong>
            </li>
            <li className="flex items-center justify-between border-b border-ink-100 pb-2">
              <span>Unresolved readiness issues</span>
              <strong>{validationState.unresolved_readiness_issues}</strong>
            </li>
            <li className="flex items-center justify-between">
              <span>Last active</span>
              <strong>{formatDateTime(validationState.last_active_at)}</strong>
            </li>
          </ul>
        ) : null}
      </section>

      <section className="tf-panel mt-8 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-medium tracking-tight">Export history</h2>
            <p className="mt-1 max-w-2xl text-[13px] text-ink-500">
              Recent export events with readiness context at handoff time.
            </p>
          </div>
          <span className="tf-status-badge" data-tone="neutral">Informational only</span>
        </div>

        {exportHistory.length === 0 ? (
          <p className="mt-4 text-[13px] text-ink-500">No exports yet. Generate your first finance CSV to start tracking.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-[13px] text-ink-700">
              <thead>
                <tr className="border-b border-ink-200 text-[11px] uppercase tracking-[0.16em] text-ink-500">
                  <th className="px-2 py-2">Time</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Rows</th>
                  <th className="px-2 py-2">Readiness</th>
                  <th className="px-2 py-2">Initiator</th>
                </tr>
              </thead>
              <tbody>
                {exportHistory.map((entry) => (
                  <tr key={entry.id} className="border-b border-ink-100">
                    <td className="px-2 py-2">{formatDateTime(entry.created_at)}</td>
                    <td className="px-2 py-2">{entry.export_type}</td>
                    <td className="px-2 py-2">{entry.record_count}</td>
                    <td className="px-2 py-2">
                      {entry.readiness_status === "ready"
                        ? "Ready at export"
                        : `Blocked (${entry.unresolved_issues})`}
                    </td>
                    <td className="px-2 py-2">{entry.actor_email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tf-panel mt-8 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-medium tracking-tight">Finance export fields</h2>
            <p className="mt-1 max-w-2xl text-[13px] text-ink-500">
              Every payroll-ready export packet depends on complete record identity, compensation, and banking fields.
            </p>
          </div>
          <span className="tf-status-badge" data-tone="neutral">Export-first system of truth</span>
        </div>
        <div className="mt-4 grid gap-2 text-[13px] text-ink-700 sm:grid-cols-2 lg:grid-cols-4">
          <p>Employee name</p>
          <p>Designation</p>
          <p>Department</p>
          <p>Salary</p>
          <p>Bank name</p>
          <p>Bank account</p>
          <p>Bank code</p>
          <p>Record status</p>
        </div>
      </section>

      {successMessage ? (
        <p className="mt-7 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent" aria-live="polite">
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

      <section className="tf-panel mt-8 p-5">
        <h2 className="text-[19px] font-medium tracking-tight">Add data record</h2>
        <p className="mt-1 text-[13px] text-ink-500">
          Use finance-facing naming so the record stays clean when it enters the next payroll batch.
        </p>
        <form action={createEmployeeAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            name="full_name"
            placeholder="Employee name"
            required
            autoComplete="name"
            className="tf-input"
          />
          <input
            name="email"
            type="email"
            placeholder="work@company.com"
            required
            autoComplete="email"
            className="tf-input"
          />
          <input
            name="role_title"
            placeholder="Designation"
            required
            className="tf-input"
          />
          <input
            name="department"
            placeholder="Department"
            required
            className="tf-input"
          />
          <input
            name="timezone"
            placeholder="Timezone (e.g. UTC)"
            defaultValue="UTC"
            required
            className="tf-input"
          />
          <button
            type="submit"
            className="tf-button-primary"
          >
            Create data record
          </button>
        </form>
      </section>

      <section className="mt-8 space-y-4">
        {employees.length === 0 ? (
          <div className="tf-panel px-5 py-6 text-[14px] text-ink-500">
            <p>No data records yet. First export path (target under 10 minutes):</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-ink-700">
              <li>Add employee records</li>
              <li>Complete salary, currency, pay frequency, and bank details</li>
              <li>Resolve readiness warnings</li>
              <li>Export CSV for finance handoff</li>
            </ol>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_140px_160px] gap-4 px-2 text-[11px] uppercase tracking-[0.16em] text-ink-500 md:grid">
              <p>Record</p>
              <p>Payroll input</p>
              <p>Status</p>
              <p>Actions</p>
            </div>
            {employees.map((employee) => (
              <article key={employee.id} className="tf-panel p-5">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_140px_160px] md:items-start">
                  <div>
                    <h3 className="text-[18px] font-medium tracking-tight">{employee.full_name}</h3>
                    <p className="mt-1 text-[13px] text-ink-500">{employee.email}</p>
                  </div>

                  <form action={updateEmployeeAction} className="grid gap-3">
                    <input type="hidden" name="employee_id" value={employee.id} />
                    <input type="hidden" name="expected_updated_at" value={employee.updated_at} />
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                      <label className="space-y-1">
                        <span className="text-[11px] uppercase tracking-[0.16em] text-ink-500">Designation</span>
                        <input
                          name="role_title"
                          defaultValue={employee.role_title}
                          className="tf-input"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] uppercase tracking-[0.16em] text-ink-500">Department</span>
                        <input
                          name="department"
                          defaultValue={employee.department}
                          className="tf-input"
                        />
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                      <label className="space-y-1">
                        <span className="text-[11px] uppercase tracking-[0.16em] text-ink-500">Record status</span>
                        <select
                          name="status"
                          defaultValue={employee.status}
                          className="tf-input"
                        >
                          <option value="active">Ready to run</option>
                          <option value="on_leave">Needs attention</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </label>
                      <button
                        type="submit"
                        className="tf-button-secondary"
                      >
                        Save record
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2">
                    <span
                      className="tf-status-badge"
                      data-tone={
                        employee.ready_for_finance_export
                          ? "ready"
                          : employee.status === "inactive"
                            ? "inactive"
                            : "attention"
                      }
                    >
                      {employee.ready_for_finance_export
                        ? "Ready for finance export"
                        : "Export blocked"}
                    </span>
                    <p className="text-[12px] text-ink-500">
                      {RECORD_STATUS_COPY[employee.status] ?? employee.status.replace("_", " ")}
                    </p>
                    {!employee.ready_for_finance_export ? (
                      <ul className="space-y-1 text-[12px] text-[#7a5314]">
                        {employee.readiness_issues.map((issue) => (
                          <li key={`${employee.id}-${issue}`}>• {issue}</li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="text-[12px] text-ink-500">
                      {employee.status === "active"
                        ? "Included in the next payroll batch once finance fields are complete."
                        : employee.status === "on_leave"
                          ? "Review before the next finance export."
                          : "Excluded from current payroll export review."}
                    </p>
                    <p className="text-[12px] text-ink-500">
                      {employee.base_salary === null || !employee.currency
                        ? "Missing salary fields"
                        : `Salary ${employee.base_salary.toFixed(2)} ${employee.currency}`}
                    </p>
                    <p className="text-[12px] text-ink-500">
                      {employee.bank_name && employee.bank_account && employee.bank_code
                        ? "Bank details present"
                        : "Missing bank details"}
                    </p>
                    <p className="text-[12px] text-ink-500">
                      {employee.pay_frequency ? `Pay frequency: ${employee.pay_frequency}` : "Missing pay frequency"}
                    </p>
                  </div>

                  <form action={archiveEmployeeAction} className="md:pt-[23px]">
                    <input type="hidden" name="employee_id" value={employee.id} />
                    <input type="hidden" name="expected_updated_at" value={employee.updated_at} />
                    <button
                      type="submit"
                      className="text-[13px] text-ink-700 underline decoration-ink-300 underline-offset-4"
                    >
                      Archive data record
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
