/**
 * Onboarding service — server-side only.
 *
 * Scope lock (see docs/drift-guard.md):
 *  - assign task, complete task, list tasks
 *  - NO templates, NO due dates, NO notifications, NO multi-step workflows
 */

import "server-only";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { track } from "@/lib/telemetry/track";

export type OnboardingTaskStatus = "pending" | "completed";

export type OnboardingTask = {
  id: string;
  employee_id: string;
  title: string;
  status: OnboardingTaskStatus;
  assigned_by: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type OnboardingTaskRow = OnboardingTask & { tenant_id: string };

const ACTIVATION_WORKFLOW_EVENTS = [
  "first_employee_added",
  "first_onboarding_assigned",
  "first_onboarding_completed",
  "first_leave_requested",
  "first_leave_approved",
] as const;

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== "admin") throw new Error("FORBIDDEN");
}

async function writeAudit(actor: Actor, actionType: string, targetId?: string): Promise<void> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: actor.authUserId,
    action_type: actionType,
    target_id: targetId ?? null,
  } as never);
  if (error) {
    console.error("AUDIT_LOG_WRITE_FAILED", {
      domain: "onboarding",
      action_type: actionType,
      tenant_id: tenantId,
      target_id: targetId ?? null,
      message: error.message,
    });
  }
}

export async function maybeFireActivationCompleted(tenantId: string, userId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("analytics_events")
    .select("event_name")
    .eq("tenant_id", tenantId)
    .in("event_name", ACTIVATION_WORKFLOW_EVENTS as unknown as string[]);

  const firedNames = new Set((data ?? []).map((r: { event_name: string }) => r.event_name));
  const allFired = ACTIVATION_WORKFLOW_EVENTS.every((e) => firedNames.has(e));
  if (allFired) {
    await track({
      tenantId,
      userId,
      eventName: "activation_completed",
      properties: {},
    });
  }
}

export async function listOnboardingTasksForEmployee(
  actor: Actor,
  employeeId: string,
): Promise<OnboardingTask[]> {
  const tenantId = requireTenant(actor);
  if (actor.role !== "admin" && actor.employeeId !== employeeId) {
    throw new Error("FORBIDDEN");
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("onboarding_tasks")
    .select("id, tenant_id, employee_id, title, status, assigned_by, completed_at, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`ONBOARDING_LIST_FAILED: ${error.message}`);
  return ((data ?? []) as OnboardingTaskRow[]).map(({ tenant_id: _t, ...row }) => row);
}

export async function listAllOnboardingTasks(actor: Actor): Promise<OnboardingTask[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("onboarding_tasks")
    .select("id, tenant_id, employee_id, title, status, assigned_by, completed_at, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`ONBOARDING_LIST_ALL_FAILED: ${error.message}`);
  return ((data ?? []) as OnboardingTaskRow[]).map(({ tenant_id: _t, ...row }) => row);
}

export async function assignOnboardingTask(
  actor: Actor,
  input: { employeeId: string; title: string },
): Promise<OnboardingTask> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("onboarding_tasks")
    .insert({
      tenant_id: tenantId,
      employee_id: input.employeeId,
      title: input.title.trim(),
      status: "pending",
      assigned_by: actor.authUserId,
    } as never)
    .select("id, tenant_id, employee_id, title, status, assigned_by, completed_at, created_at, updated_at")
    .single();

  if (error) throw new Error(`ONBOARDING_ASSIGN_FAILED: ${error.message}`);

  const created = data as OnboardingTaskRow;
  await writeAudit(actor, "onboarding.assigned", created.id);

  // Fire first_onboarding_assigned once per tenant
  const countResult = await supabase
    .from("onboarding_tasks")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if ((countResult.count ?? 0) === 1) {
    await track({ tenantId, userId: actor.authUserId, eventName: "first_onboarding_assigned", properties: { task_id: created.id } });
    await maybeFireActivationCompleted(tenantId, actor.authUserId);
  }

  const { tenant_id: _t, ...row } = created;
  return row;
}

export async function completeOnboardingTask(
  actor: Actor,
  taskId: string,
  expectedUpdatedAt: string,
): Promise<OnboardingTask> {
  const tenantId = requireTenant(actor);
  if (!expectedUpdatedAt) throw new Error("MISSING_EXPECTED_UPDATED_AT");

  const supabase = createServiceRoleClient();

  // Employees can only complete their own tasks; admins can complete any
  let query = supabase
    .from("onboarding_tasks")
    .update({ status: "completed", completed_at: new Date().toISOString() } as never)
    .eq("tenant_id", tenantId)
    .eq("id", taskId)
    .eq("updated_at", expectedUpdatedAt)
    .eq("status", "pending");

  if (actor.role !== "admin" && actor.employeeId) {
    query = query.eq("employee_id", actor.employeeId);
  }

  const { data, error } = await query
    .select("id, tenant_id, employee_id, title, status, assigned_by, completed_at, created_at, updated_at")
    .maybeSingle();

  if (error) throw new Error(`ONBOARDING_COMPLETE_FAILED: ${error.message}`);
  if (!data) throw new Error("STALE_WRITE");

  const updated = data as OnboardingTaskRow;
  await writeAudit(actor, "onboarding.completed", taskId);

  // Fire first_onboarding_completed once per tenant
  const countResult = await supabase
    .from("onboarding_tasks")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "completed");
  if ((countResult.count ?? 0) === 1) {
    await track({ tenantId, userId: actor.authUserId, eventName: "first_onboarding_completed", properties: { task_id: taskId } });
    await maybeFireActivationCompleted(tenantId, actor.authUserId);
  }

  const { tenant_id: _t, ...row } = updated;
  return row;
}
