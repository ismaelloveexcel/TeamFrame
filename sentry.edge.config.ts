/**
 * Sentry edge-runtime initialisation.
 *
 * Loaded by Next.js for middleware and edge Route Handlers.
 * Edge runtime has a restricted API surface — keep this file minimal.
 *
 * Rules for this weekend:
 *  - DSN-gated: dormant when SENTRY_DSN is absent
 *  - zero performance tracing
 *  - no beforeSend scrub in edge (scrub.ts uses Set which is fine in edge,
 *    but we err on the side of caution and omit user context only)
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,

    tracesSampleRate: 0,

    beforeSend(event) {
      // Remove auto-populated user context.
      delete event.user;
      return event;
    },
  });
}
