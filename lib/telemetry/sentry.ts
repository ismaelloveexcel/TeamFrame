/**
 * TeamFrame — Sentry capture wrapper
 *
 * Thin wrapper around Sentry.captureException that:
 *  - adds structured scope tags (action, tenant_id, user_id)
 *  - strips PII from the extra context before sending
 *  - never throws — Sentry failure must not break user flows
 *
 * Works on both client and server (no "server-only" import).
 * DSN-gating is handled at Sentry.init() time; if DSN is absent
 * the SDK is dormant and captureException is a no-op.
 */

import * as Sentry from "@sentry/nextjs";
import { scrubPII } from "./scrub";

export function captureActionError(
  actionName: string,
  err: unknown,
  ctx?: Record<string, unknown>,
): void {
  try {
    const safeCtx = ctx ? scrubPII(ctx) : {};

    Sentry.withScope((scope) => {
      scope.setTag("action", actionName);

      if (typeof safeCtx.actor_user_id === "string") {
        scope.setTag("user_id", safeCtx.actor_user_id);
      }
      if (typeof safeCtx.actor_tenant_id === "string") {
        scope.setTag("tenant_id", safeCtx.actor_tenant_id);
      }

      // Pass remaining context keys as extra, with PII already stripped.
      const { actor_user_id, actor_tenant_id, ...extra } = safeCtx;
      void actor_user_id;
      void actor_tenant_id;
      if (Object.keys(extra).length > 0) {
        scope.setExtras(extra);
      }

      Sentry.captureException(err);
    });
  } catch {
    // Never throw.
  }
}
