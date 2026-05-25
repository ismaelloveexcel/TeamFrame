/**
 * TeamFrame — telemetry / activation events
 *
 * Internal, server-only funnel instrumentation. Writes to the
 * `analytics_events` table via the service-role client.
 *
 * Rules:
 *  - server-only (never imported into a client component)
 *  - never throws — telemetry failure must not break user flows
 *  - emitted only from successful server mutations (never from the client)
 *  - `first_*` events are guarded by a partial unique index in the schema,
 *    so duplicate inserts are silently ignored at the DB layer.
 *
 * No third-party analytics. No queues. No async bus.
 */

import "server-only";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

export const ACTIVATION_EVENTS = [
  "company_created",
  "first_employee_added",
  "first_onboarding_assigned",
  "first_onboarding_completed",
  "first_leave_requested",
  "first_leave_approved",
  "session_started",
  "activation_completed",
] as const;

export type ActivationEvent = (typeof ACTIVATION_EVENTS)[number];

export type TrackInput = {
  tenantId: string | null;
  userId: string | null;
  eventName: ActivationEvent;
  properties?: Record<string, unknown>;
};

export async function track(input: TrackInput): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("analytics_events").insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      event_name: input.eventName,
      event_properties: input.properties ?? {},
    } as never);

    if (error) {
      // Unique-violation on 'first_*' events is expected and not an error
      // worth surfacing; everything else is logged but never thrown.
      const code = (error as { code?: string }).code;
      if (code === "23505") return;
      console.warn(`[track] insert failed for ${input.eventName}: ${error.message}`);
    }
  } catch (err) {
    console.warn(`[track] threw for ${input.eventName}:`, err);
  }
}
