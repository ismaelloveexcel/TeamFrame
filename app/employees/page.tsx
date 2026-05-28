import { requireTenantActor } from "@/middleware/rbac";
import { OrgChart } from "@/components/OrgChart";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { listEmployeesForAdmin, listOrgChart } from "@/services/employeeService";
import Link from "next/link";
import { CopyInviteEmailButton } from "./CopyInviteEmailButton";
import {
  createEmployeeAction,
  generateActivationLinkAction,
  updateEmployeeAction,
  archiveEmployeeAction,
  reinviteEmployeeAction,
} from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  created: "Employee created.",
  updated: "Employee updated.",
  archived: "Employee archived.",
  reinvited: "Invite link sent. The employee should use the newest email only.",
  activation_link_ready: "Activation link generated.",
};

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that action.",
  NOT_FOUND: "That employee could not be found.",
  STALE_WRITE: "This record changed. Refresh and try again.",
  MISSING_EXPECTED_UPDATED_AT: "This action is out of date. Refresh and retry.",
  NO_PATCH_FIELDS: "No editable fields were provided.",
  EMPLOYEE_CREATE_FAILED: "Could not create employee.",
  EMPLOYEE_UPDATE_FAILED: "Could not update employee.",
  EMPLOYEE_DELETE_FAILED: "Could not archive employee.",
  EMPLOYEE_INVITE_TENANT_CONFLICT: "Invite blocked: this email is already linked to another company.",
  EMPLOYEE_INVITE_FAILED: "Employee saved, but invite delivery failed. Try Re-send invite.",
  EMPLOYEE_INVITE_RATE_LIMIT: "Invite rate limit reached. Wait briefly, then try Re-send invite.",
  EMPLOYEE_INVITE_REDIRECT_MISMATCH: "Invite blocked by redirect configuration. Check SITE_URL and Supabase redirect allow-list.",
  EMPLOYEE_INVITE_PROVIDER_CONFIG: "Invite provider is not fully configured. Ask an admin to check Supabase email settings.",
  EMPLOYEE_INVITE_USER_LOOKUP_FAILED: "Invite could not be linked to an existing auth user. Re-send invite.",
  EMPLOYEE_INVITE_METADATA_FAILED: "Invite was sent but metadata sync failed. Re-send invite.",
  EMPLOYEE_ACTIVATION_LINK_FAILED: "Could not generate an activation link. Re-send invite and retry.",
  EMPLOYEE_ALREADY_ACTIVE: "This employee is already activated.",
  AUDIT_LOG_FAILED: "Could not record required audit trail. No change was applied.",
  INVALID_INPUT: "Input validation failed.",
  UNKNOWN: "Something went wrong. Refresh and try again.",
};

function isInviteExpired(lastSentAt: string | null): boolean {
  if (!lastSentAt) return false;
  const ageMs = Date.now() - new Date(lastSentAt).getTime();
  return ageMs > 1000 * 60 * 60 * 24 * 2;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; employee?: string; activation_link?: string }>;
}) {
  const actor = await requireTenantActor();
  const { status, error, employee: employeeParam, activation_link: activationLink } = await searchParams;

  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  if (actor.role !== "admin") {
    const employees = await listOrgChart(actor);
    return (
      <main className="mx-auto max-w-5xl px-6 py-14">
        <nav className="mb-6 flex gap-4 text-[14px] text-ink-500">
          <Link href="/me" className="hover:text-ink-900 transition">My space</Link>
          <span className="text-ink-900 font-medium">Employees</span>
          <Link href="/org-chart" className="hover:text-ink-900 transition">Org chart</Link>
          <Link href="/onboarding" className="hover:text-ink-900 transition">Onboarding</Link>
          <Link href="/leaves" className="hover:text-ink-900 transition">Leaves</Link>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
          <div className="space-y-2">
            <p className="text-[12px] tracking-[0.14em] text-ink-500">Directory</p>
            <h1 className="text-[34px] leading-tight tracking-tight">People map</h1>
          </div>
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
  const invitePending = employees.filter((e) => e.status !== "inactive" && e.setup_status === "incomplete").length;
  const inviteSent = employees.filter((e) => e.status !== "inactive" && e.setup_status === "ready").length;
  const inviteActivated = employees.filter((e) => e.setup_status === "active").length;
  const archived = employees.filter((e) => e.status === "inactive").length;

  function inviteState(employeeRecord: (typeof employees)[number]): {
    label: "pending" | "awaiting" | "activated" | "archived" | "failed" | "expired";
    tone: string;
    help: string;
  } {
    if (employeeRecord.status === "inactive") {
      return {
        label: "archived",
        tone: "border-ink-300 bg-ink-100 text-ink-700",
        help: "This profile is archived and hidden from active workflows.",
      };
    }
    if (employeeRecord.setup_status === "active") {
      return {
        label: "activated",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
        help: employeeRecord.activated_at
          ? `Activated on ${formatDateTime(employeeRecord.activated_at)}.`
          : "Invite accepted and employee can access TeamFrame.",
      };
    }
    if (employeeRecord.invite_last_error) {
      return {
        label: "failed",
        tone: "border-red-200 bg-red-50 text-red-700",
        help: `Last invite error: ${employeeRecord.invite_last_error}. Use Re-send invite or generate a new activation link.`,
      };
    }
    if (isInviteExpired(employeeRecord.invite_last_sent_at)) {
      return {
        label: "expired",
        tone: "border-amber-200 bg-amber-50 text-amber-700",
        help: "Last invite may have expired. Re-send or generate a fresh activation link.",
      };
    }
    if (employeeRecord.setup_status === "ready") {
      return {
        label: "awaiting",
        tone: "border-sky-200 bg-sky-50 text-sky-700",
        help: "Invite sent and waiting for first login.",
      };
    }
    return {
      label: "pending",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      help: "No successful invite yet. Send or generate an activation link from this card.",
    };
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <nav className="mb-6 flex gap-4 text-[14px] text-ink-500">
        <span className="text-ink-900 font-medium">Employees</span>
        <Link href="/org-chart" className="hover:text-ink-900 transition">Org chart</Link>
        <Link href="/onboarding" className="hover:text-ink-900 transition">Onboarding</Link>
        <Link href="/leaves" className="hover:text-ink-900 transition">Leaves</Link>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Admin queue</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Employee pipeline</h1>
        </div>
      </div>

      <p className="mt-7 max-w-2xl text-[15px] text-ink-700">
        Add teammates, track invite progress, and keep onboarding moving from one place.
      </p>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Invite pending</p>
          <p className="mt-2 text-[24px] tracking-tight">{invitePending}</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Invite sent</p>
          <p className="mt-2 text-[24px] tracking-tight">{inviteSent}</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Signed in and active</p>
          <p className="mt-2 text-[24px] tracking-tight">{inviteActivated}</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Archived profiles</p>
          <p className="mt-2 text-[24px] tracking-tight">{archived}</p>
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
          <PendingSubmitButton
            idleLabel="Create employee"
            pendingLabel="Creating..."
            className="rounded-md bg-ink-900 px-4 py-2 text-[14px] font-medium text-paper disabled:cursor-not-allowed disabled:bg-ink-300"
          />
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
              {status === "reinvited" && employeeParam === employee.id ? (
                <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
                  Invite re-sent to this employee.
                </p>
              ) : null}
              {status === "activation_link_ready" && employeeParam === employee.id && activationLink ? (
                <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
                  <p>Activation link generated for this employee.</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <a
                      href={activationLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] underline decoration-emerald-300 underline-offset-4"
                    >
                      Open activation link
                    </a>
                    <CopyInviteEmailButton
                      email={activationLink}
                      copyValue={activationLink}
                      idleLabel="Copy activation link"
                      copiedLabel="Activation link copied"
                    />
                  </div>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[19px] font-medium tracking-tight">{employee.full_name}</h3>
                  <p className="text-[13px] text-ink-500">{employee.email}</p>
                  {(() => {
                    const state = inviteState(employee);
                    return (
                      <>
                        <p className="mt-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] ${state.tone}`}>
                            {state.label}
                          </span>
                        </p>
                        <p className="mt-1 text-[12px] text-ink-500">{state.help}</p>
                      </>
                    );
                  })()}
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
                <PendingSubmitButton
                  idleLabel="Save"
                  pendingLabel="Saving..."
                  className="rounded-md bg-ink-900 px-3 py-2 text-[14px] font-medium text-paper transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:bg-ink-300"
                />
              </form>

              <div className="mt-3 rounded-md border border-ink-200 bg-ink-50/50 px-3 py-2 text-[12px] text-ink-600">
                <p>Invite attempts: {employee.invite_attempt_count}</p>
                <p>Last attempt: {formatDateTime(employee.invite_last_attempt_at)}</p>
                <p>Last sent: {formatDateTime(employee.invite_last_sent_at)}</p>
                <p>Activation: {formatDateTime(employee.activated_at)}</p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-4">
                <CopyInviteEmailButton email={employee.email} />
                {employee.setup_status !== "active" && employee.status !== "inactive" ? (
                  <>
                    <form action={reinviteEmployeeAction}>
                      <input type="hidden" name="employee_id" value={employee.id} />
                      <PendingSubmitButton
                        idleLabel="Re-send invite"
                        pendingLabel="Sending..."
                        className="rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-200 disabled:text-ink-400"
                      />
                    </form>
                    <form action={generateActivationLinkAction}>
                      <input type="hidden" name="employee_id" value={employee.id} />
                      <PendingSubmitButton
                        idleLabel="Generate activation link"
                        pendingLabel="Generating..."
                        className="rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-200 disabled:text-ink-400"
                      />
                    </form>
                  </>
                ) : null}
                <form action={archiveEmployeeAction}>
                  <input type="hidden" name="employee_id" value={employee.id} />
                  <input type="hidden" name="expected_updated_at" value={employee.updated_at} />
                  <PendingSubmitButton
                    idleLabel="Archive employee"
                    pendingLabel="Archiving..."
                    className="rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-200 disabled:text-ink-400"
                  />
                </form>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
