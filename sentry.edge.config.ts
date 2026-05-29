/**
 * Sentry edge-runtime initialisation.
 *
 * Loaded by Next.js for middleware and edge Route Handlers via
 * instrumentation.ts.
 *
 * Rules for this weekend:
 *  - DSN-gated: dormant when SENTRY_DSN is absent
 *  - zero performance tracing
 *  - PII stripped via beforeSend (parity with server/client configs)
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";
import { scrubPII } from "@/lib/telemetry/scrub";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,

    tracesSampleRate: 0,

    beforeSend(event) {
      delete event.user;

      if (event.extra && typeof event.extra === "object") {
        event.extra = scrubPII(event.extra as Record<string, unknown>);
      }

      return event;
    },
  });
}
