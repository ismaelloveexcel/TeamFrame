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
