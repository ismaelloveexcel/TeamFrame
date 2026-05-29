/**
 * Sentry server-side initialisation.
 *
 * Loaded by Next.js for all server-side rendering (RSC, Route Handlers,
 * Server Actions).
 *
 * Rules for this weekend:
 *  - DSN-gated: dormant when SENTRY_DSN is absent
 *  - zero performance tracing
 *  - PII stripped via beforeSend
 *  - next.config.ts NOT wrapped (deferred)
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
