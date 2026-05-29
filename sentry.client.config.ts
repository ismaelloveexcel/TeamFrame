/**
 * Sentry client-side initialisation.
 *
 * Rules for this weekend:
 *  - DSN-gated: dormant when NEXT_PUBLIC_SENTRY_DSN is absent
 *  - zero performance tracing (tracesSampleRate: 0)
 *  - zero session replay (replaysSessionSampleRate: 0)
 *  - PII stripped from every event via beforeSend
 *  - next.config.ts is NOT wrapped with withSentryConfig (deferred)
 *  - source map upload is NOT configured (deferred)
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";
import { scrubPII } from "@/lib/telemetry/scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,

    // Disable performance tracing — not needed this sprint.
    tracesSampleRate: 0,

    // Disable session replay — not needed this sprint.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Strip PII from every outbound event.
    beforeSend(event) {
      // Remove auto-populated user context which may contain email.
      delete event.user;

      if (event.extra && typeof event.extra === "object") {
        event.extra = scrubPII(event.extra as Record<string, unknown>);
      }

      return event;
    },
  });
}
