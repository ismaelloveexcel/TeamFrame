/**
 * TeamFrame — public /api/health response contract helper.
 *
 * Shared between the route handler and scripts/guard-health-contract.mjs.
 * Kept as plain ESM (.mjs) so it can be imported directly by both the
 * TypeScript route (via Next's bundler resolution) and the Node guard
 * script (via standard ESM resolution) without a build step or new
 * dependency.
 *
 * CONTRACT — unauthenticated GET /api/health response body MUST equal exactly:
 *   {"status":"ok"}       (HTTP 200)
 *   {"status":"degraded"} (HTTP 503)
 *
 * Any change to the shape returned by this function is a public-API change.
 */

/**
 * @param {"ok" | "degraded"} status
 * @returns {{ status: "ok" | "degraded" }}
 */
export function buildPublicHealthPayload(status) {
  return { status };
}
