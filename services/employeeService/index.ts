/**
 * Employee service — server-side only.
 *
 * Contract:
 *  - every function takes an explicit `Actor` and re-validates authorization
 *  - employee-scope reads use the org-chart field whitelist
 *  - compensation lives in a separate, admin-only path (see docs/rbac-rules.md)
 *  - audit-logged on every destructive mutation
 *
 * Employee CRUD and tenant-scoped access checks are implemented here.
 * Keep all authorization and audit behavior server-side.
 */

import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

export const ORG_CHART_FIELDS = [
  "id",
  "full_name",
  "role_title",
  "department",
  "manager_id",
  "status",
] as const;

export type OrgChartEmployee = {
  id: string;
  full_name: string;
  role_title: string;
  department: string;
  manager_id: string | null;
  status: "active" | "on_leave" | "inactive";
};

export type EmployeeFullRecord = OrgChartEmployee & {
  email: string;
  timezone: string;
  grade: string | null;
  setup_status: "incomplete" | "ready" | "active";
  created_at: string;
  updated_at: string;
};

export type PayrollReadinessRecord = EmployeeFullRecord & {
  base_salary: number | null;
  currency: string | null;
  pay_frequency: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_code: string | null;
  readiness_issues: string[];
  ready_for_finance_export: boolean;
};

export async function listEmployeesForAdmin(actor: Actor): Promise<EmployeeFullRecord[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("employees")
    .select(
      "id, tenant_id, full_name, email, role_title, department, timezone, manager_id, status, grade, setup_status, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(`EMPLOYEE_LIST_FAILED: ${error.message}`);
  }

  return ((data ?? []) as EmployeeRow[]).map(toEmployeeFullRecord);
}

type CompensationRow = {
  employee_id: string;
  base_salary: number | null;
  currency: string | null;
};

type EmployeeProfileRow = {
  employee_id: string;
  personal_details: Record<string, unknown> | null;
};

function readStringField(
  details: Record<string, unknown> | null,
  fieldNames: string[],
): string | null {
  if (!details) return null;
  for (const fieldName of fieldNames) {
    const value = details[fieldName];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function buildReadinessIssues(input: {
  employee: EmployeeFullRecord;
  baseSalary: number | null;
  currency: string | null;
  payFrequency: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankCode: string | null;
}): string[] {
  const issues: string[] = [];

  if (input.employee.status === "inactive") {
    issues.push("Inactive employee included in export scope");
  }
  if (input.employee.setup_status === "incomplete") {
    issues.push("Setup incomplete");
  }
  if (input.baseSalary === null || Number.isNaN(input.baseSalary)) {
    issues.push("Missing salary");
  }
  if (!input.currency) {
    issues.push("Missing currency");
  }
  if (!input.payFrequency) {
    issues.push("Missing pay frequency");
  }
  if (!input.bankName) {
    issues.push("Missing bank details (bank name)");
  }
  if (!input.bankAccount) {
    issues.push("Missing bank details (bank account)");
  }
  if (!input.bankCode) {
    issues.push("Missing bank details (bank code)");
  }

  return issues;
}

export async function listPayrollReadinessForAdmin(
  actor: Actor,
): Promise<PayrollReadinessRecord[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const employees = await listEmployeesForAdmin(actor);

  if (employees.length === 0) {
    return [];
  }

  const employeeIds = employees.map((employee) => employee.id);
  const supabase = createServiceRoleClient();

  const [{ data: compensationData, error: compensationError }, { data: profileData, error: profileError }] =
    await Promise.all([
      supabase
        .from("compensation")
        .select("employee_id, base_salary, currency")
        .eq("tenant_id", tenantId)
        .in("employee_id", employeeIds),
      supabase
        .from("employee_profiles")
        .select("employee_id, personal_details")
        .eq("tenant_id", tenantId)
        .in("employee_id", employeeIds),
    ]);

  if (compensationError) {
    throw new Error(`PAYROLL_READINESS_COMPENSATION_FETCH_FAILED: ${compensationError.message}`);
  }
  if (profileError) {
    throw new Error(`PAYROLL_READINESS_PROFILE_FETCH_FAILED: ${profileError.message}`);
  }

  const compensationByEmployeeId = new Map<string, CompensationRow>();
  for (const row of (compensationData ?? []) as CompensationRow[]) {
    compensationByEmployeeId.set(row.employee_id, row);
  }

  const profileByEmployeeId = new Map<string, EmployeeProfileRow>();
  for (const row of (profileData ?? []) as EmployeeProfileRow[]) {
    profileByEmployeeId.set(row.employee_id, row);
  }

  return employees.map((employee) => {
    const compensation = compensationByEmployeeId.get(employee.id);
    const profile = profileByEmployeeId.get(employee.id);
    const details = profile?.personal_details ?? null;

    const baseSalary = compensation?.base_salary ?? null;
    const currency = compensation?.currency?.trim() ?? null;
    const payFrequency = readStringField(details, ["pay_frequency", "payFrequency"]);
    const bankName = readStringField(details, ["bank_name", "bankName"]);
    const bankAccount = readStringField(details, ["bank_account", "bankAccount"]);
    const bankCode = readStringField(details, ["bank_code", "bankCode"]);

    const readinessIssues = buildReadinessIssues({
      employee,
      baseSalary,
      currency,
      payFrequency,
      bankName,
      bankAccount,
      bankCode,
    });

    return {
      ...employee,
      base_salary: baseSalary,
      currency,
      pay_frequency: payFrequency,
      bank_name: bankName,
      bank_account: bankAccount,
      bank_code: bankCode,
      readiness_issues: readinessIssues,
      ready_for_finance_export: readinessIssues.length === 0,
    };
  });
}

const CreateEmployeeSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email(),
  role_title: z.string().trim().min(1).max(200),
  department: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(100),
  manager_id: z.string().uuid().nullable().optional(),
  grade: z.string().trim().max(100).nullable().optional(),
  status: z.enum(["active", "on_leave", "inactive"]).optional(),
  setup_status: z.enum(["incomplete", "ready", "active"]).optional(),
});

const UpdateEmployeeSchema = z.object({
  full_name: z.string().trim().min(1).max(200).optional(),
  role_title: z.string().trim().min(1).max(200).optional(),
  department: z.string().trim().min(1).max(120).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  manager_id: z.string().uuid().nullable().optional(),
  grade: z.string().trim().max(100).nullable().optional(),
  status: z.enum(["active", "on_leave", "inactive"]).optional(),
  setup_status: z.enum(["incomplete", "ready", "active"]).optional(),
});

type EmployeeRow = EmployeeFullRecord & {
  tenant_id: string;
};

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) {
    throw new Error("NO_TENANT_CONTEXT");
  }
  return actor.tenantId;
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== "admin") {
    throw new Error("FORBIDDEN");
  }
}

function toOrgChartEmployee(row: EmployeeRow): OrgChartEmployee {
  return {
    id: row.id,
    full_name: row.full_name,
    role_title: row.role_title,
    department: row.department,
    manager_id: row.manager_id,
    status: row.status,
  };
}

function toEmployeeFullRecord(row: EmployeeRow): EmployeeFullRecord {
  return {
    id: row.id,
    full_name: row.full_name,
    role_title: row.role_title,
    department: row.department,
    manager_id: row.manager_id,
    status: row.status,
    email: row.email,
    timezone: row.timezone,
    grade: row.grade,
    setup_status: row.setup_status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function rowExistsForTenant(
  actor: Actor,
  employeeId: string,
): Promise<boolean> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`EMPLOYEE_LOOKUP_FAILED: ${error.message}`);
  }

  return Boolean(data);
}

async function writeAudit(
  actor: Actor,
  actionType: string,
  targetId?: string,
): Promise<void> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: actor.authUserId,
    action_type: actionType,
    target_id: targetId ?? null,
  } as never);
}

export async function listOrgChart(actor: Actor): Promise<OrgChartEmployee[]> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, role_title, department, manager_id, status, tenant_id")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(`EMPLOYEE_LIST_FAILED: ${error.message}`);
  }

  return ((data ?? []) as EmployeeRow[]).map(toOrgChartEmployee);
}

export async function getEmployee(
  actor: Actor,
  employeeId: string,
): Promise<EmployeeFullRecord> {
  const tenantId = requireTenant(actor);
  if (actor.role !== "admin" && actor.employeeId !== employeeId) {
    throw new Error("FORBIDDEN");
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("employees")
    .select(
      "id, tenant_id, full_name, email, role_title, department, timezone, manager_id, status, grade, setup_status, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`EMPLOYEE_FETCH_FAILED: ${error.message}`);
  }
  if (!data) {
    throw new Error("NOT_FOUND");
  }

  return toEmployeeFullRecord(data as EmployeeRow);
}

export async function createEmployee(actor: Actor, input: unknown): Promise<EmployeeFullRecord> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const parsed = CreateEmployeeSchema.parse(input);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("employees")
    .insert({
      tenant_id: tenantId,
      full_name: parsed.full_name,
      email: parsed.email,
      role_title: parsed.role_title,
      department: parsed.department,
      timezone: parsed.timezone,
      manager_id: parsed.manager_id ?? null,
      grade: parsed.grade ?? null,
      status: parsed.status ?? "active",
      setup_status: parsed.setup_status ?? "incomplete",
    } as never)
    .select(
      "id, tenant_id, full_name, email, role_title, department, timezone, manager_id, status, grade, setup_status, created_at, updated_at",
    )
    .single();

  if (error) {
    throw new Error(`EMPLOYEE_CREATE_FAILED: ${error.message}`);
  }

  const created = data as unknown as EmployeeRow;

  await writeAudit(actor, "employee.created", created.id);

  return toEmployeeFullRecord(created);
}

export async function updateEmployee(
  actor: Actor,
  employeeId: string,
  patch: unknown,
  expectedUpdatedAt: string,
): Promise<EmployeeFullRecord> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const parsed = UpdateEmployeeSchema.parse(patch);

  if (Object.keys(parsed).length === 0) {
    throw new Error("NO_PATCH_FIELDS");
  }
  if (!expectedUpdatedAt) {
    throw new Error("MISSING_EXPECTED_UPDATED_AT");
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("employees")
    .update(parsed as never)
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .eq("updated_at", expectedUpdatedAt)
    .is("deleted_at", null)
    .select(
      "id, tenant_id, full_name, email, role_title, department, timezone, manager_id, status, grade, setup_status, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`EMPLOYEE_UPDATE_FAILED: ${error.message}`);
  }
  if (!data) {
    const exists = await rowExistsForTenant(actor, employeeId);
    throw new Error(exists ? "STALE_WRITE" : "NOT_FOUND");
  }

  await writeAudit(actor, "employee.updated", employeeId);

  return toEmployeeFullRecord(data as EmployeeRow);
}

export async function softDeleteEmployee(
  actor: Actor,
  employeeId: string,
  expectedUpdatedAt: string,
): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);

  if (actor.employeeId === employeeId) {
    throw new Error("CANNOT_DELETE_SELF");
  }
  if (!expectedUpdatedAt) {
    throw new Error("MISSING_EXPECTED_UPDATED_AT");
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("employees")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .eq("updated_at", expectedUpdatedAt)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`EMPLOYEE_DELETE_FAILED: ${error.message}`);
  }

  const exists = await rowExistsForTenant(actor, employeeId);
  if (exists) {
    throw new Error("STALE_WRITE");
  }

  await writeAudit(actor, "employee.archived", employeeId);
}
