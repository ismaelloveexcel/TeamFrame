/**
 * Leave service — server-side only.
 *
 * Scope lock (see docs/drift-guard.md):
 *  - submit, approve, reject
 *  - NO accrual engine, NO policy automation, NO calendar integrations,
 *    NO balances dashboard, NO escalations.
 */

import "server-only";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { track } from "@/lib/telemetry/track";

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

async function writeAudit(actor: Actor, actionType: string, targetId?: string): Promise<void> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: actor.authUserId,
    action_type: actionType,
    target_id: targetId ?? null,
  } as never);
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

export async function listPendingLeaves(actor: Actor): Promise<LeaveRecord[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("leaves")
    .select("id, tenant_id, employee_id, start_date, end_date, status, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`LEAVE_LIST_PENDING_FAILED: ${error.message}`);
  }

  return ((data ?? []) as LeaveRow[]).map(({ tenant_id: _tenantId, ...row }) => row);
}

export async function submitLeaveRequest(
  actor: Actor,
  input: { startDate: string; endDate: string },
): Promise<LeaveRecord> {
  const tenantId = requireTenant(actor);
  const employeeId = requireLinkedEmployee(actor);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("leaves")
    .insert({
      tenant_id: tenantId,
      employee_id: employeeId,
      start_date: input.startDate,
      end_date: input.endDate,
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
    .eq("updated_at", expectedUpdatedAt)
    .select("id, tenant_id, employee_id, start_date, end_date, status, created_at, updated_at")
    .maybeSingle();

  if (error) {
    throw new Error(`LEAVE_DECISION_FAILED: ${error.message}`);
  }
  if (!data) {
    throw new Error("STALE_WRITE");
  }

  await writeAudit(actor, decision === "approved" ? "leave.approved" : "leave.rejected", leaveId);

  // Fire first_leave_approved once per tenant
  if (decision === "approved") {
    const countResult = await supabase
      .from("leaves")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "approved");
    if ((countResult.count ?? 0) === 1) {
      await track({ tenantId, userId: actor.authUserId, eventName: "first_leave_approved", properties: { leave_id: leaveId } });
    }
  }

  const { tenant_id: _tenantId, ...row } = data as LeaveRow;
  return row;
}
