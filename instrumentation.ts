/**
 * Next.js 15 instrumentation hook.
 *
 * Loaded automatically by Next at runtime per
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Without this file, the `sentry.{server,edge}.config.ts` modules are never
 * imported and `Sentry.init()` never executes — leaving capture wrappers as
 * silent no-ops. Client-side init is loaded via the framework's automatic
 * `sentry.client.config.ts` discovery.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
