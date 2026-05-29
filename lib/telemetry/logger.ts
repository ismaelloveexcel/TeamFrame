/**
 * TeamFrame — structured server-side action logger
 *
 * Emits a single-line JSON entry per server action call. In development,
 * pretty-prints with a tagged prefix for readability.
 *
 * Rules (mirrors lib/telemetry/track.ts):
 *  - server-only (never imported into a client component)
 *  - never throws — logger failure must not break user flows
 *  - calls scrubPII before emit to prevent log-level PII leakage
 *  - does NOT replace audit_logs table (that is the system of record)
 */

import "server-only";
import { scrubPII } from "./scrub";

export interface LogActionInput {
  action: string;
  actorUserId: string | null;
  actorTenantId: string | null;
  durationMs: number;
  outcome: "ok" | "fail";
  error?: unknown;
  requestId?: string;
}

function sanitiseErrorMessage(msg: string): string {
  // Strip anything that looks like an email, URL, or token.
  return msg
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]")
    .replace(/https?:\/\/[^\s]+/g, "[REDACTED_URL]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .slice(0, 500); // cap length — no unbounded strings in logs
}

export function logAction(input: LogActionInput): void {
  try {
    const requestId = input.requestId ?? crypto.randomUUID();

    const base: Record<string, unknown> = {
      ts: new Date().toISOString(),
      action: input.action,
      outcome: input.outcome,
      actor_user_id: input.actorUserId,
      actor_tenant_id: input.actorTenantId,
      duration_ms: input.durationMs,
      request_id: requestId,
    };

    if (input.outcome === "fail" && input.error !== undefined) {
      const err =
        input.error instanceof Error
          ? input.error
          : new Error(String(input.error));

      base.tagged_prefix = "[ACTION_FAIL]";
      base.error_name = err.name;
      base.error_message_sanitised = sanitiseErrorMessage(err.message);
    }

    const scrubbed = scrubPII(base);

    if (process.env.NODE_ENV === "development") {
      const prefix =
        typeof scrubbed.tagged_prefix === "string"
          ? scrubbed.tagged_prefix
          : "[ACTION_OK]";
      console.log(prefix, JSON.stringify(scrubbed, null, 2));
    } else {
      console.log(JSON.stringify(scrubbed));
    }
  } catch {
    // Never throw — telemetry failure must not break user flows.
  }
}
