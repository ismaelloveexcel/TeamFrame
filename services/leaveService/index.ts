/**
 * Leave service — server-side only.
 *
 * Scope lock (see docs/drift-guard.md):
 *  - submit, approve, reject
 *  - NO accrual engine, NO policy automation, NO calendar integrations,
 *    NO balances dashboard, NO escalations.
 */

import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { track } from "@/lib/telemetry/track";
import { maybeFireActivationCompleted } from "@/services/onboardingService";

export type LeaveStatus = "pending" | "approved" | "rejected";

export type LeaveRecord = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: LeaveStatus;
  created_at: string;
  updated_at: string;
};

type LeaveRow = LeaveRecord & {
  tenant_id: string;
};

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== "admin") throw new Error("FORBIDDEN");
}

function requireLinkedEmployee(actor: Actor): string {
  if (!actor.employeeId) throw new Error("NO_EMPLOYEE_RECORD");
  return actor.employeeId;
}

const SubmitLeaveSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((d) => d.endDate >= d.startDate, { message: "INVALID_INPUT" });

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

export async function listLeavesForEmployee(
  actor: Actor,
  employeeId: string,
): Promise<LeaveRecord[]> {
  const tenantId = requireTenant(actor);
  if (actor.role !== "admin" && actor.employeeId !== employeeId) {
    throw new Error("FORBIDDEN");
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("leaves")
    .select("id, tenant_id, employee_id, start_date, end_date, status, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`LEAVE_LIST_FAILED: ${error.message}`);
  }

  return ((data ?? []) as LeaveRow[]).map(({ tenant_id: _tenantId, ...row }) => row);
}

export type PendingLeaveWithEmployee = LeaveRecord & {
  employee_full_name: string;
  employee_role_title: string;
};

export async function listPendingLeavesWithEmployee(actor: Actor): Promise<PendingLeaveWithEmployee[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("leaves")
    .select("id, tenant_id, employee_id, start_date, end_date, status, created_at, updated_at, employees(full_name, role_title)")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`LEAVE_LIST_PENDING_FAILED: ${error.message}`);
  }

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    employee_id: row.employee_id,
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    employee_full_name: row.employees?.full_name ?? "(unknown)",
    employee_role_title: row.employees?.role_title ?? "(unknown)",
  }));
}

export async function submitLeaveRequest(
  actor: Actor,
  input: { startDate: string; endDate: string },
): Promise<LeaveRecord> {
  const tenantId = requireTenant(actor);
  const employeeId = requireLinkedEmployee(actor);
  const parsed = SubmitLeaveSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("INVALID_INPUT");
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("leaves")
    .insert({
      tenant_id: tenantId,
      employee_id: employeeId,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      status: "pending",
    } as never)
    .select("id, tenant_id, employee_id, start_date, end_date, status, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(`LEAVE_SUBMIT_FAILED: ${error.message}`);
  }

  const created = data as LeaveRow;
  await writeAudit(actor, "leave.submitted", created.id);

  // Fire first_leave_requested once per tenant
  const countResult = await supabase
    .from("leaves")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if ((countResult.count ?? 0) === 1) {
    await track({ tenantId, userId: actor.authUserId, eventName: "first_leave_requested", properties: { leave_id: created.id } });
  }

  const { tenant_id: _tenantId, ...row } = created;
  return row;
}

export async function decideLeaveRequest(
  actor: Actor,
  leaveId: string,
  decision: "approved" | "rejected",
  expectedUpdatedAt: string,
): Promise<LeaveRecord> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  if (!expectedUpdatedAt) throw new Error("MISSING_EXPECTED_UPDATED_AT");

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("leaves")
    .update({ status: decision } as never)
    .eq("tenant_id", tenantId)
    .eq("id", leaveId)
    .eq("status", "pending")
    .eq("updated_at", expectedUpdatedAt)
    .select("id, tenant_id, employee_id, start_date, end_date, status, created_at, updated_at")
    .maybeSingle();

  if (error) {
    throw new Error(`LEAVE_DECISION_FAILED: ${error.message}`);
  }
  if (!data) {
    throw new Error("STALE_WRITE");
  }

  await writeAudit(
    actor,
    decision === "approved" ? "leave.approved" : "leave.rejected",
    leaveId,
    true,
  );

  // Fire first_leave_approved once per tenant
  if (decision === "approved") {
    const countResult = await supabase
      .from("leaves")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "approved");
    if ((countResult.count ?? 0) === 1) {
      await track({ tenantId, userId: actor.authUserId, eventName: "first_leave_approved", properties: { leave_id: leaveId } });
      await maybeFireActivationCompleted(tenantId, actor.authUserId);
    }
  }

  const { tenant_id: _tenantId, ...row } = data as LeaveRow;
  return row;
}
