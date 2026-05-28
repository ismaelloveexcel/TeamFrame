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
import { env } from "@/lib/db/env";
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
  invite_attempt_count: number;
  invite_last_attempt_at: string | null;
  invite_last_sent_at: string | null;
  invite_last_error: string | null;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ActivationLinkResult = {
  activationLink: string;
};

const EMPLOYEE_TELEMETRY_COLUMNS = [
  "invite_attempt_count",
  "invite_last_attempt_at",
  "invite_last_sent_at",
  "invite_last_error",
  "activated_at",
] as const;

type EmployeeTelemetryColumn = (typeof EMPLOYEE_TELEMETRY_COLUMNS)[number];

type EmployeeTelemetryCapabilities = {
  checkedAt: string;
  missingColumns: EmployeeTelemetryColumn[];
  limitedMode: boolean;
};

let employeeTelemetryCapabilitiesCache:
  | {
      value: EmployeeTelemetryCapabilities;
      expiresAt: number;
    }
  | null = null;

const EMPLOYEE_TELEMETRY_CACHE_TTL_MS = 5 * 60 * 1000;

function isColumnMissingMessage(message: string, column: EmployeeTelemetryColumn): boolean {
  const lower = message.toLowerCase();
  return lower.includes("does not exist") && lower.includes(column);
}

function extractMissingTelemetryColumns(message: string): EmployeeTelemetryColumn[] {
  const lower = message.toLowerCase();
  return EMPLOYEE_TELEMETRY_COLUMNS.filter((column) => lower.includes(column));
}

function cacheEmployeeTelemetryCapabilities(value: EmployeeTelemetryCapabilities): EmployeeTelemetryCapabilities {
  employeeTelemetryCapabilitiesCache = {
    value,
    expiresAt: Date.now() + EMPLOYEE_TELEMETRY_CACHE_TTL_MS,
  };
  return value;
}

function noteMissingTelemetryColumns(columns: EmployeeTelemetryColumn[], reason: string): void {
  if (columns.length === 0) return;
  const existing = employeeTelemetryCapabilitiesCache?.value.missingColumns ?? [];
  const merged = Array.from(new Set([...existing, ...columns])) as EmployeeTelemetryColumn[];
  cacheEmployeeTelemetryCapabilities({
    checkedAt: new Date().toISOString(),
    missingColumns: merged,
    limitedMode: merged.length > 0,
  });

  console.warn("EMPLOYEE_SCHEMA_CAPABILITY_WARN", {
    mode: "limited_telemetry",
    reason,
    missing_columns: merged,
  });
}

async function detectEmployeeTelemetryCapabilities(): Promise<EmployeeTelemetryCapabilities> {
  const now = Date.now();
  if (employeeTelemetryCapabilitiesCache && employeeTelemetryCapabilitiesCache.expiresAt > now) {
    return employeeTelemetryCapabilitiesCache.value;
  }

  const supabase = createServiceRoleClient();
  const missingColumns: EmployeeTelemetryColumn[] = [];

  for (const column of EMPLOYEE_TELEMETRY_COLUMNS) {
    const { error } = await supabase
      .from("employees")
      .select(column)
      .limit(1);

    if (!error) {
      continue;
    }

    if (isColumnMissingMessage(error.message, column)) {
      missingColumns.push(column);
      continue;
    }

    // Unknown schema/probe errors should degrade safely instead of crashing page requests.
    missingColumns.push(column);
    console.warn("EMPLOYEE_SCHEMA_CAPABILITY_WARN", {
      mode: "limited_telemetry",
      reason: "probe_error",
      column,
      message: error.message,
    });
  }

  const capabilities = cacheEmployeeTelemetryCapabilities({
    checkedAt: new Date().toISOString(),
    missingColumns,
    limitedMode: missingColumns.length > 0,
  });

  if (capabilities.limitedMode) {
    console.warn("EMPLOYEE_SCHEMA_CAPABILITY_WARN", {
      mode: "limited_telemetry",
      reason: "columns_missing",
      missing_columns: capabilities.missingColumns,
      checked_at: capabilities.checkedAt,
    });
  }

  return capabilities;
}

export async function getEmployeeTelemetryCapabilities(actor: Actor): Promise<EmployeeTelemetryCapabilities> {
  requireAdmin(actor);
  return detectEmployeeTelemetryCapabilities();
}

export async function listEmployeesForAdmin(actor: Actor): Promise<EmployeeFullRecord[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const capabilities = await detectEmployeeTelemetryCapabilities();
  const baseSelect =
    "id, tenant_id, full_name, email, role_title, department, timezone, manager_id, status, grade, setup_status, created_at, updated_at";
  const telemetrySelect =
    "invite_attempt_count, invite_last_attempt_at, invite_last_sent_at, invite_last_error, activated_at";
  const selectColumns = capabilities.limitedMode ? baseSelect : `${baseSelect}, ${telemetrySelect}`;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("employees")
    .select(selectColumns)
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

type InviteFailureCategory =
  | "rate_limit"
  | "redirect_mismatch"
  | "provider_config"
  | "user_lookup_failed"
  | "metadata_failed"
  | "auth_api_failed"
  | "unknown";

type InviteResult = {
  status: "invited" | "linked" | "conflict" | "failed";
  category?: InviteFailureCategory;
  message?: string;
  code?: string;
  statusCode?: number;
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
  const maybeTelemetry = row as EmployeeRow & {
    invite_attempt_count?: number;
    invite_last_attempt_at?: string | null;
    invite_last_sent_at?: string | null;
    invite_last_error?: string | null;
    activated_at?: string | null;
  };

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
    invite_attempt_count: maybeTelemetry.invite_attempt_count ?? 0,
    invite_last_attempt_at: maybeTelemetry.invite_last_attempt_at ?? null,
    invite_last_sent_at: maybeTelemetry.invite_last_sent_at ?? null,
    invite_last_error: maybeTelemetry.invite_last_error ?? null,
    activated_at: maybeTelemetry.activated_at ?? null,
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

function getAuthErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const maybeStatus = (error as { status?: unknown }).status;
  return typeof maybeStatus === "number" ? maybeStatus : null;
}

function getAuthErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "";
  }
  const maybeMessage = (error as { message?: unknown }).message;
  return typeof maybeMessage === "string" ? maybeMessage : "";
}

function classifyInviteFailure(error: unknown): InviteFailureCategory {
  const code = getAuthErrorCode(error);
  const message = getAuthErrorMessage(error).toLowerCase();
  const status = getAuthErrorStatus(error);

  if (code.includes("rate") || message.includes("rate limit") || status === 429) {
    return "rate_limit";
  }
  if (
    message.includes("redirect") ||
    message.includes("redirect_to") ||
    message.includes("not allowed")
  ) {
    return "redirect_mismatch";
  }
  if (
    message.includes("smtp") ||
    message.includes("email provider") ||
    message.includes("sending confirmation email") ||
    message.includes("email not confirmed")
  ) {
    return "provider_config";
  }
  if (message.includes("metadata") || message.includes("app_metadata")) {
    return "metadata_failed";
  }
  if (code || message) {
    return "auth_api_failed";
  }
  return "unknown";
}

function mapInviteFailureToErrorCode(category: InviteFailureCategory): string {
  if (category === "rate_limit") return "EMPLOYEE_INVITE_RATE_LIMIT";
  if (category === "redirect_mismatch") return "EMPLOYEE_INVITE_REDIRECT_MISMATCH";
  if (category === "provider_config") return "EMPLOYEE_INVITE_PROVIDER_CONFIG";
  if (category === "user_lookup_failed") return "EMPLOYEE_INVITE_USER_LOOKUP_FAILED";
  if (category === "metadata_failed") return "EMPLOYEE_INVITE_METADATA_FAILED";
  return "EMPLOYEE_INVITE_FAILED";
}

function isInviteTelemetryColumnMissing(message: string): boolean {
  return (
    message.includes("invite_attempt_count") ||
    message.includes("invite_last_attempt_at") ||
    message.includes("invite_last_sent_at") ||
    message.includes("invite_last_error") ||
    message.includes("activated_at")
  );
}

function logInviteDiagnostic(payload: {
  operation: "create" | "reinvite";
  tenantId: string;
  employeeId?: string;
  email: string;
  result: InviteResult["status"];
  category?: InviteFailureCategory;
  code?: string;
  statusCode?: number;
  message?: string;
}) {
  const entry = {
    operation: payload.operation,
    tenant_id: payload.tenantId,
    employee_id: payload.employeeId ?? null,
    email: payload.email,
    result: payload.result,
    category: payload.category ?? null,
    auth_code: payload.code ?? null,
    auth_status: payload.statusCode ?? null,
    auth_message: payload.message ?? null,
  };

  if (payload.result === "failed" || payload.result === "conflict") {
    console.error("EMPLOYEE_INVITE_DIAGNOSTIC", entry);
    return;
  }
  if (process.env.NODE_ENV === "development") {
    console.info("EMPLOYEE_INVITE_DIAGNOSTIC", entry);
  }
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
    throw new Error(`EMPLOYEE_INVITE_GET_USER_FAILED: ${userError?.message ?? "USER_NOT_FOUND"}`);
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
    throw new Error(`EMPLOYEE_INVITE_METADATA_UPDATE_FAILED: ${updateError.message}`);
  }
}

async function inviteEmployeeAuthUser(email: string, tenantId: string): Promise<InviteResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      role: "employee",
      tenant_id: tenantId,
    },
    redirectTo: `${env.siteUrl}/auth/callback`,
  });

  if (error) {
    if (!isAlreadyExistsAuthError(error)) {
      return {
        status: "failed",
        category: classifyInviteFailure(error),
        message: getAuthErrorMessage(error),
        code: getAuthErrorCode(error),
        statusCode: getAuthErrorStatus(error) ?? undefined,
      };
    }

    const existingUserId = await findAuthUserIdByEmail(email);
    if (existingUserId) {
      try {
        await setEmployeeAuthMetadata(existingUserId, tenantId);
        return { status: "linked" };
      } catch (inviteError) {
        if (inviteError instanceof Error && inviteError.message === "EMPLOYEE_INVITE_TENANT_CONFLICT") {
          return { status: "conflict", category: "metadata_failed" };
        }
        return {
          status: "failed",
          category: classifyInviteFailure(inviteError),
          message: getAuthErrorMessage(inviteError),
          code: getAuthErrorCode(inviteError),
          statusCode: getAuthErrorStatus(inviteError) ?? undefined,
        };
      }
    }
    return {
      status: "failed",
      category: "user_lookup_failed",
      message: "Could not locate an existing auth user for invite retry",
    };
  }

  if (data?.user?.id) {
    try {
      await setEmployeeAuthMetadata(data.user.id, tenantId);
      return { status: "linked" };
    } catch (inviteError) {
      if (inviteError instanceof Error && inviteError.message === "EMPLOYEE_INVITE_TENANT_CONFLICT") {
        return { status: "conflict", category: "metadata_failed" };
      }
      return {
        status: "failed",
        category: classifyInviteFailure(inviteError),
        message: getAuthErrorMessage(inviteError),
        code: getAuthErrorCode(inviteError),
        statusCode: getAuthErrorStatus(inviteError) ?? undefined,
      };
    }
  }

  return { status: "invited" };
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

async function recordInviteTelemetry(
  tenantId: string,
  employeeId: string,
  input: {
    succeeded: boolean;
    failureCode?: string;
  },
): Promise<void> {
  const capabilities = await detectEmployeeTelemetryCapabilities();
  if (capabilities.limitedMode) {
    console.warn("EMPLOYEE_INVITE_TELEMETRY_UNAVAILABLE", {
      tenant_id: tenantId,
      employee_id: employeeId,
      reason: "schema_columns_missing",
      missing_columns: capabilities.missingColumns,
    });
    return;
  }

  const supabase = createServiceRoleClient();
  const { data: existing, error: lookupError } = await supabase
    .from("employees")
    .select("invite_attempt_count")
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (lookupError) {
    if (isInviteTelemetryColumnMissing(lookupError.message)) {
      const missing = extractMissingTelemetryColumns(lookupError.message);
      noteMissingTelemetryColumns(
        missing.length > 0 ? missing : [...EMPLOYEE_TELEMETRY_COLUMNS],
        "lookup_missing_column",
      );
      console.warn("EMPLOYEE_INVITE_TELEMETRY_UNAVAILABLE", lookupError.message);
      return;
    }
    throw new Error(`EMPLOYEE_INVITE_TELEMETRY_LOOKUP_FAILED: ${lookupError.message}`);
  }

  const telemetryRow = existing as { invite_attempt_count?: number | null } | null;
  const nextCount =
    typeof telemetryRow?.invite_attempt_count === "number" ? telemetryRow.invite_attempt_count + 1 : 1;
  const timestamp = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("employees")
    .update({
      invite_attempt_count: nextCount,
      invite_last_attempt_at: timestamp,
      invite_last_sent_at: input.succeeded ? timestamp : null,
      invite_last_error: input.succeeded ? null : input.failureCode ?? "EMPLOYEE_INVITE_FAILED",
    } as never)
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .is("deleted_at", null);

  if (updateError) {
    if (isInviteTelemetryColumnMissing(updateError.message)) {
      const missing = extractMissingTelemetryColumns(updateError.message);
      noteMissingTelemetryColumns(
        missing.length > 0 ? missing : [...EMPLOYEE_TELEMETRY_COLUMNS],
        "update_missing_column",
      );
      console.warn("EMPLOYEE_INVITE_TELEMETRY_UNAVAILABLE", updateError.message);
      return;
    }
    throw new Error(`EMPLOYEE_INVITE_TELEMETRY_UPDATE_FAILED: ${updateError.message}`);
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
  if (inviteResult.status === "linked" || inviteResult.status === "invited") {
    await setEmployeeSetupStatus(tenantId, created.id, "ready");
    await recordInviteTelemetry(tenantId, created.id, { succeeded: true });
    created.setup_status = "ready";
    created.invite_last_error = null;
  } else {
    await setEmployeeSetupStatus(tenantId, created.id, "incomplete");
    await recordInviteTelemetry(tenantId, created.id, {
      succeeded: false,
      failureCode: mapInviteFailureToErrorCode(inviteResult.category ?? "unknown"),
    });
    created.setup_status = "incomplete";
    created.invite_last_error = mapInviteFailureToErrorCode(inviteResult.category ?? "unknown");
  }

  logInviteDiagnostic({
    operation: "create",
    tenantId,
    employeeId: created.id,
    email: created.email,
    result: inviteResult.status,
    category: inviteResult.category,
    code: inviteResult.code,
    statusCode: inviteResult.statusCode,
    message: inviteResult.message,
  });

  await writeAudit(actor, "employee.created", created.id, true);
  if (inviteResult.status === "linked" || inviteResult.status === "invited") {
    await writeAudit(actor, "employee.invite_sent", created.id, true);
  }

  if (inviteResult.status === "conflict") {
    throw new Error("EMPLOYEE_INVITE_TENANT_CONFLICT");
  }
  if (inviteResult.status === "failed") {
    throw new Error(mapInviteFailureToErrorCode(inviteResult.category ?? "unknown"));
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
  if (inviteResult.status === "linked" || inviteResult.status === "invited") {
    await setEmployeeSetupStatus(tenantId, employeeId, "ready");
    await recordInviteTelemetry(tenantId, employeeId, { succeeded: true });
    await writeAudit(actor, "employee.reinvited", employeeId, true);
    logInviteDiagnostic({
      operation: "reinvite",
      tenantId,
      employeeId,
      email: employee.email,
      result: inviteResult.status,
      category: inviteResult.category,
      code: inviteResult.code,
      statusCode: inviteResult.statusCode,
      message: inviteResult.message,
    });
    return;
  }

  await setEmployeeSetupStatus(tenantId, employeeId, "incomplete");
  await recordInviteTelemetry(tenantId, employeeId, {
    succeeded: false,
    failureCode: mapInviteFailureToErrorCode(inviteResult.category ?? "unknown"),
  });
  logInviteDiagnostic({
    operation: "reinvite",
    tenantId,
    employeeId,
    email: employee.email,
    result: inviteResult.status,
    category: inviteResult.category,
    code: inviteResult.code,
    statusCode: inviteResult.statusCode,
    message: inviteResult.message,
  });

  if (inviteResult.status === "conflict") {
    throw new Error("EMPLOYEE_INVITE_TENANT_CONFLICT");
  }
  throw new Error(mapInviteFailureToErrorCode(inviteResult.category ?? "unknown"));
}

export async function generateEmployeeActivationLink(
  actor: Actor,
  employeeId: string,
): Promise<ActivationLinkResult> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, email, setup_status")
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`EMPLOYEE_FETCH_FAILED: ${error.message}`);
  }
  const employee = data as { id: string; email: string; setup_status: "incomplete" | "ready" | "active" } | null;
  if (!employee) {
    throw new Error("NOT_FOUND");
  }
  if (employee.setup_status === "active") {
    throw new Error("EMPLOYEE_ALREADY_ACTIVE");
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: employee.email,
    options: {
      redirectTo: `${env.siteUrl}/auth/callback`,
    },
  });

  if (linkError) {
    const category = classifyInviteFailure(linkError);
    logInviteDiagnostic({
      operation: "reinvite",
      tenantId,
      employeeId,
      email: employee.email,
      result: "failed",
      category,
      code: getAuthErrorCode(linkError),
      statusCode: getAuthErrorStatus(linkError) ?? undefined,
      message: getAuthErrorMessage(linkError),
    });
    await recordInviteTelemetry(tenantId, employeeId, {
      succeeded: false,
      failureCode: mapInviteFailureToErrorCode(category),
    });
    throw new Error("EMPLOYEE_ACTIVATION_LINK_FAILED");
  }

  const hashedToken = linkData?.properties?.hashed_token;
  if (!hashedToken) {
    await recordInviteTelemetry(tenantId, employeeId, {
      succeeded: false,
      failureCode: "EMPLOYEE_ACTIVATION_LINK_FAILED",
    });
    throw new Error("EMPLOYEE_ACTIVATION_LINK_FAILED");
  }

  const activationLink = `${env.siteUrl}/auth/callback?token_hash=${hashedToken}&type=magiclink`;
  await recordInviteTelemetry(tenantId, employeeId, { succeeded: true });
  await writeAudit(actor, "employee.activation_link_generated", employeeId, true);

  return { activationLink };
}
