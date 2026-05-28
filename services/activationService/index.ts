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
  timestamp: string;
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
    .select("action_type, target_id, timestamp")
    .eq("tenant_id", tenantId)
    .in("action_type", actionTypes as unknown as string[])
    .order("timestamp", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(`AUDIT_ACTIVITY_LIST_FAILED: ${error.message}`);
  }

  return (data ?? []) as AuditActivityRow[];
}
