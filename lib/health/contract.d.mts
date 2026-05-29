/**
 * Type declarations for ./contract.mjs
 *
 * The implementation is a plain ESM module (.mjs) so the Node guard script
 * (scripts/guard-health-contract.mjs) can import it without a build step or
 * TS loader. These declarations let the TypeScript route handler import the
 * same module with full type-safety.
 */
export declare function buildPublicHealthPayload(
  status: "ok" | "degraded",
): { status: "ok" | "degraded" };
