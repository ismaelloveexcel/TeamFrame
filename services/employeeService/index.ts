/**
 * Employee service — server-side only.
 *
 * Contract:
 *  - every function takes an explicit `Actor` and re-validates authorization
 *  - employee-scope reads use the org-chart field whitelist
 *  - compensation lives in a separate, admin-only path (see docs/rbac-rules.md)
 *  - audit-logged on every destructive mutation
 *
 * No business logic in this stub yet — these are the locked signatures the
 * services layer will fulfill in step 3 of the build plan (Employee CRUD).
 */

import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { track } from "@/lib/telemetry/track";
import { maybeFireActivationCompleted } from "@/services/onboardingService";

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

type InviteResult = "invited" | "linked" | "conflict" | "failed";

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

function getAuthErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "";
  }
  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === "string" ? maybeCode.toLowerCase() : "";
}

function isAlreadyExistsAuthError(error: unknown): boolean {
  const code = getAuthErrorCode(error);
  if (code.includes("already_exists") || code.includes("exists")) {
    return true;
  }

  const message =
    error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message.toLowerCase()
      : "";

  return message.includes("already exists") || message.includes("already_registered");
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const normalizedEmail = email.toLowerCase();

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      console.error("EMPLOYEE_INVITE_LIST_USERS_FAILED", error.message);
      return null;
    }

    const users = data?.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (match?.id) {
      return match.id;
    }

    if (users.length < 100) {
      return null;
    }
  }

  return null;
}

async function setEmployeeAuthMetadata(userId: string, tenantId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !userData?.user) {
    console.error("EMPLOYEE_INVITE_GET_USER_FAILED", userError?.message ?? "USER_NOT_FOUND");
    return;
  }

  const currentAppMetadata =
    userData.user.app_metadata && typeof userData.user.app_metadata === "object"
      ? (userData.user.app_metadata as Record<string, unknown>)
      : {};

  const currentTenantId =
    typeof currentAppMetadata.tenant_id === "string" ? currentAppMetadata.tenant_id : "";

  if (currentTenantId && currentTenantId !== tenantId) {
    console.error("EMPLOYEE_INVITE_TENANT_CONFLICT", {
      userId,
      existingTenantId: currentTenantId,
      incomingTenantId: tenantId,
    });
    throw new Error("EMPLOYEE_INVITE_TENANT_CONFLICT");
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...currentAppMetadata,
      role: "employee",
      tenant_id: tenantId,
    },
  });

  if (updateError) {
    console.error("EMPLOYEE_INVITE_METADATA_UPDATE_FAILED", updateError.message);
    throw new Error("EMPLOYEE_INVITE_FAILED");
  }
}

async function inviteEmployeeAuthUser(email: string, tenantId: string): Promise<InviteResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      role: "employee",
      tenant_id: tenantId,
    },
    redirectTo: `${process.env.SITE_URL}/auth/callback`,
  });

  if (error) {
    if (!isAlreadyExistsAuthError(error)) {
      console.error("EMPLOYEE_INVITE_FAILED", error.message);
      return "failed";
    }

    const existingUserId = await findAuthUserIdByEmail(email);
    if (existingUserId) {
      try {
        await setEmployeeAuthMetadata(existingUserId, tenantId);
        return "linked";
      } catch (inviteError) {
        if (inviteError instanceof Error && inviteError.message === "EMPLOYEE_INVITE_TENANT_CONFLICT") {
          return "conflict";
        }
        return "failed";
      }
    }
    return "failed";
  }

  if (data?.user?.id) {
    try {
      await setEmployeeAuthMetadata(data.user.id, tenantId);
      return "linked";
    } catch (inviteError) {
      if (inviteError instanceof Error && inviteError.message === "EMPLOYEE_INVITE_TENANT_CONFLICT") {
        return "conflict";
      }
      return "failed";
    }
  }

  return "invited";
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

async function rowStateForTenant(
  actor: Actor,
  employeeId: string,
): Promise<"active" | "deleted" | "missing"> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, deleted_at")
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .maybeSingle();

  if (error) {
    throw new Error(`EMPLOYEE_LOOKUP_FAILED: ${error.message}`);
  }
  const row = data as { id: string; deleted_at: string | null } | null;
  if (!row) return "missing";
  return row.deleted_at ? "deleted" : "active";
}

async function setEmployeeSetupStatus(
  tenantId: string,
  employeeId: string,
  setupStatus: "incomplete" | "ready" | "active",
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("employees")
    .update({ setup_status: setupStatus } as never)
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .is("deleted_at", null);
  if (error) {
    throw new Error(`EMPLOYEE_SETUP_STATUS_UPDATE_FAILED: ${error.message}`);
  }
}

async function writeAudit(
  actor: Actor,
  actionType: string,
  targetId?: string,
  required = false,
): Promise<void> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: actor.authUserId,
    action_type: actionType,
    target_id: targetId ?? null,
  } as never);
  if (error) {
    if (required) {
      throw new Error(`AUDIT_LOG_FAILED: ${error.message}`);
    }
    console.error("AUDIT_LOG_WRITE_FAILED", error.message);
  }
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

  const inviteResult = await inviteEmployeeAuthUser(created.email, tenantId);
  if (inviteResult === "linked" || inviteResult === "invited") {
    await setEmployeeSetupStatus(tenantId, created.id, "ready");
    created.setup_status = "ready";
  } else {
    await setEmployeeSetupStatus(tenantId, created.id, "incomplete");
    created.setup_status = "incomplete";
  }

  await writeAudit(actor, "employee.created", created.id, true);

  if (inviteResult === "conflict") {
    throw new Error("EMPLOYEE_INVITE_TENANT_CONFLICT");
  }
  if (inviteResult === "failed") {
    throw new Error("EMPLOYEE_INVITE_FAILED");
  }

  // Fire activation event if this is the tenant's first employee.
  // The 'first_*' partial unique index also guards against duplicates.
  const { count } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);
  if (count === 1) {
    await track({
      tenantId,
      userId: actor.authUserId,
      eventName: "first_employee_added",
      properties: { employee_id: created.id },
    });
    await maybeFireActivationCompleted(tenantId, actor.authUserId);
  }

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

  await writeAudit(actor, "employee.updated", employeeId, true);

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
  const { data, error } = await supabase
    .from("employees")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .eq("updated_at", expectedUpdatedAt)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`EMPLOYEE_DELETE_FAILED: ${error.message}`);
  }

  if (!data) {
    const state = await rowStateForTenant(actor, employeeId);
    if (state === "active") {
      throw new Error("STALE_WRITE");
    }
    throw new Error("NOT_FOUND");
  }

  const exists = await rowExistsForTenant(actor, employeeId);
  if (exists) {
    throw new Error("STALE_WRITE");
  }

  await writeAudit(actor, "employee.archived", employeeId, true);
}

export async function reinviteEmployee(actor: Actor, employeeId: string): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, email")
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`EMPLOYEE_FETCH_FAILED: ${error.message}`);
  }
  const employee = data as { id: string; email: string } | null;
  if (!employee) {
    throw new Error("NOT_FOUND");
  }

  const inviteResult = await inviteEmployeeAuthUser(employee.email, tenantId);
  if (inviteResult === "linked" || inviteResult === "invited") {
    await setEmployeeSetupStatus(tenantId, employeeId, "ready");
    await writeAudit(actor, "employee.reinvited", employeeId, true);
    return;
  }

  await setEmployeeSetupStatus(tenantId, employeeId, "incomplete");
  if (inviteResult === "conflict") {
    throw new Error("EMPLOYEE_INVITE_TENANT_CONFLICT");
  }
  throw new Error("EMPLOYEE_INVITE_FAILED");
}
