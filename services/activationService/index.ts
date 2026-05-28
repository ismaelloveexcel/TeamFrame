/**
 * Activation service — server-side only.
 *
 * Reads the tenant's activation funnel events. Centralizes the previously
 * inline `analytics_events` read on the dashboard page so the database is
 * reached only through the service layer (per README architecture contract).
 */

import "server-only";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

export type ActivationEventRow = {
  event_name: string;
  created_at: string;
};

export type AuditActivityRow = {
  action_type: string;
  target_id: string | null;
  actor_user_id: string;
  timestamp: string;
};

export type TimelineEmployeeActor = {
  id: string;
  auth_user_id: string | null;
  full_name: string;
};

export type TimelineLeaveMeta = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "rejected";
};

export type TimelineOnboardingMeta = {
  id: string;
  employee_id: string;
  title: string;
};

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

export async function listActivationEvents(
  actor: Actor,
  eventNames: readonly string[],
): Promise<ActivationEventRow[]> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("analytics_events")
    .select("event_name, created_at")
    .eq("tenant_id", tenantId)
    .in("event_name", eventNames as unknown as string[]);

  if (error) {
    throw new Error(`ACTIVATION_EVENTS_LIST_FAILED: ${error.message}`);
  }

  return (data ?? []) as ActivationEventRow[];
}

export async function listRecentAuditActivity(
  actor: Actor,
  actionTypes: readonly string[],
  limit = 20,
): Promise<AuditActivityRow[]> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const safeLimit = Math.max(1, Math.min(limit, 50));

  const { data, error } = await supabase
    .from("audit_logs")
    .select("action_type, target_id, actor_user_id, timestamp")
    .eq("tenant_id", tenantId)
    .in("action_type", actionTypes as unknown as string[])
    .order("timestamp", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(`AUDIT_ACTIVITY_LIST_FAILED: ${error.message}`);
  }

  return (data ?? []) as AuditActivityRow[];
}

export async function listTimelineEmployeeActors(actor: Actor): Promise<TimelineEmployeeActor[]> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("employees")
    .select("id, auth_user_id, full_name")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`AUDIT_TIMELINE_EMPLOYEE_ACTORS_FAILED: ${error.message}`);
  }

  return (data ?? []) as TimelineEmployeeActor[];
}

export async function listTimelineLeavesByIds(actor: Actor, leaveIds: readonly string[]): Promise<TimelineLeaveMeta[]> {
  const tenantId = requireTenant(actor);
  if (leaveIds.length === 0) return [];

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("leaves")
    .select("id, employee_id, start_date, end_date, status")
    .eq("tenant_id", tenantId)
    .in("id", leaveIds as string[]);

  if (error) {
    throw new Error(`AUDIT_TIMELINE_LEAVES_FAILED: ${error.message}`);
  }

  return (data ?? []) as TimelineLeaveMeta[];
}

export async function listTimelineOnboardingByIds(
  actor: Actor,
  taskIds: readonly string[],
): Promise<TimelineOnboardingMeta[]> {
  const tenantId = requireTenant(actor);
  if (taskIds.length === 0) return [];

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("onboarding_tasks")
    .select("id, employee_id, title")
    .eq("tenant_id", tenantId)
    .in("id", taskIds as string[]);

  if (error) {
    throw new Error(`AUDIT_TIMELINE_ONBOARDING_FAILED: ${error.message}`);
  }

  return (data ?? []) as TimelineOnboardingMeta[];
}
