---
audit: phase-2-readiness
audited_sha: e7b3b28201791a40baf3c3d6557655d086099cab
audited_at: 2026-05-29T17:33:33Z
auditor: subagent
verdict: GREEN
status: CLOSED
closed_at: 2026-05-30T00:00:00Z
closed_sha: 754b1edb
---

# Phase 2 Readiness Audit — TeamFrame

> **STATUS: CLOSED / COMPLETED (2026-05-30).** All four follow-up Moves
> shipped to `main` at `754b1ed`. The audit verdict remains GREEN and no
> outstanding blockers, importants, or audit-tracked moves remain. See
> [§11 Closure](#11-closure) for the per-move PR map and final state.

Read-only review of TeamFrame at SHA `e7b3b28`. Scope: determine whether the
codebase is operationally ready for Phase 2 feature expansion without
accumulating hidden reliability debt.

## 1. Executive Summary

Phase 1 (1A → 1D) closed cleanly. Tenancy isolation is JWT-only
(`schemas/tenancy_rls_v2.sql:28-39`), observability is mandatory on every
critical mutation and enforced by `scripts/guard-telemetry.mjs:1-200`, the
public health contract is byte-frozen via
`scripts/guard-health-contract.mjs:1-110`, and CI completes in roughly 102 s on
average (5-run median). All guards pass, `tsc --noEmit` is clean in 11 s cold
median, and the smoke loop is idempotent. No blockers were found. The system
is operationally fit to expand into Phase 2 feature work.

**Verdict: GREEN.** Originally triggered by rubric *"0 blockers, ≤3 importants"*
(3 importants logged in §3). A 4th important (IMPORTANT-4: telemetry-probe
N+1) was added post-merge as an erratum — see §9.1 and §10 Move 4. Verdict
unchanged: no blockers, scaling impact bounded by cache, fix tracked.

## 2. Strengths

- Tenant isolation hardened to JWT-only with email-fallback explicitly
  rejected and replaced with deny-by-default
  (`schemas/tenancy_rls_v2.sql:28-39`, `tenancy_rls_v2.sql:48-52`).
- Public health response contract is mechanically frozen — comments stripped
  before pattern check, helper output asserted exactly, both `ok` and
  `degraded` paths verified
  (`scripts/guard-health-contract.mjs:30-110`,
  `lib/health/contract.mjs:1-23`).
- Telemetry coverage is allowlist-enforced: every critical action must call
  `logAction(` *and* `captureActionError(` or CI fails
  (`scripts/guard-telemetry.mjs:14-60`,
  `app/employees/actions.ts:71-130`,
  `app/onboarding/actions.ts:29-90`).
- Sentry wiring is verified by anchored regex on `instrumentation.ts`
  (`scripts/guard-instrumentation.mjs:1-60`) — captures regress if either
  runtime import is removed.
- PII scrubbing is depth-bounded and never-throws
  (`lib/telemetry/scrub.ts:1-90`, `lib/telemetry/logger.ts:1-120`,
  `lib/telemetry/sentry.ts:1-60`).
- Public health endpoint uses constant-time secret compare with byte-length
  pre-check that defends against non-ASCII secret crashes
  (`app/api/health/route.ts:30-55`).
- Per-subsystem 2 s timeout, overall 2.5 s race ceiling, `allSettled` on
  probes, explicit `.catch(() => {})` to prevent unhandled rejections losing
  the race (`app/api/health/route.ts:55-110`).
- Edge middleware redirects unauthenticated requests on every protected
  prefix and logs `AUTH_MIDDLEWARE_ENV_MISSING` if env vars are absent at the
  edge (`middleware.ts:1-80`).
- `MissingTenantContextError` preserves the `NO_TENANT_CONTEXT` prefix so
  downstream `getErrorCode()` mapping in actions stays stable
  (`middleware/rbac.ts:55-90`,
  `app/onboarding/actions.ts:20-26`).
- Single source of truth for env vars; service role key is `server-only`
  importable and crashes on missing key
  (`lib/db/env.ts:1-36`).
- Identity resolution self-heals: links `employees.auth_user_id` on first
  successful login and promotes `setup_status` to `active`
  (`lib/rbac/roles.ts:90-130`).
- Service role client is singleton-cached, not re-instantiated per request,
  with session persistence and auto-refresh disabled
  (`lib/db/supabaseServer.ts:42-60`).
- CI is partitioned cleanly (`quality → guards`, `quality → smoke`) with
  concurrency cancel-in-progress and conservative timeouts
  (`.github/workflows/ci.yml:1-100`).
- Smoke test is end-to-end and idempotent — safe to re-run with no cleanup
  (`scripts/smoke-core-loop.mjs:1-200`).

## 3. Critical Risks

No blockers. Four importants (IMPORTANT-4 added post-merge — see §9.1):

### IMPORTANT-1: Tenancy filter discipline is review-enforced, not test-enforced

The architecture uses `createServiceRoleClient()` from every service-layer
function (`services/employeeService/index.ts:133`,
`services/leaveService/index.ts:61, 85, 109, 145, 188`,
`services/onboardingService/index.ts:50, 70, 118, 134, 152, 192`,
`services/documentService/index.ts:46, 84, 111, 175, 207`,
`services/activationService/index.ts:55, 75, 95, 113, 134`). Tenancy is
enforced by the service layer manually calling `requireTenant(actor)` and
adding `.eq("tenant_id", tenantId)` to every query
(`services/leaveService/index.ts:33-35, 60-67, 81-92`). RLS in
`schemas/tenancy_rls_v2.sql` is defense in depth, but service-role bypasses
it. A single forgotten `.eq("tenant_id", …)` in a new service function would
silently leak cross-tenant rows. There is no static check for this — only
human review of PRs. Recommended Phase 2 safeguard: a structural test or
guard that scans `services/**/index.ts` for `.from(` calls and asserts an
accompanying `.eq("tenant_id"` on the same chain.

### IMPORTANT-2: `findAuthUserIdByEmail` paginates up to 1000 auth users on the invite path

`findAuthUserIdByEmail` in `services/employeeService/index.ts:434-460` loops
`supabase.auth.admin.listUsers` up to 10 pages × 100 users (= 1000 max) to
resolve duplicate-invite collisions. At Phase 1 scale (6–25 employees) this
is irrelevant; at Phase 2 scale of a few hundred users per tenant it remains
acceptable; past ~1000 users it silently stops finding pre-existing auth
records and the invite flow would mis-classify them as new. Recommended:
either raise the page cap with a runtime guard, or replace with a server-side
`.from("auth.users").eq("email", …)` index lookup once scale crosses a
defined threshold.

### IMPORTANT-3: No automated test framework beyond guards and smoke

`package.json:6-28` declares no `test` script and no `jest` / `vitest` /
`playwright` dependency. Coverage is provided by `npm run guards` (structural
asserts) and `npm run smoke:core-loop` (end-to-end happy path). For Phase 1
this is proportional. Phase 2 feature work that touches the tenancy filter
discipline noted in IMPORTANT-1, or the RLS contract in
`schemas/tenancy_rls_v2.sql`, will benefit from a thin assertion harness —
e.g. negative tests asserting `supabase.from(...).eq("tenant_id", X).select`
returns no rows for tenant `Y`.

### IMPORTANT-4: Telemetry-capability probe is N+1 (added post-merge)

`services/employeeService/index.ts:127-160` —
`detectEmployeeTelemetryCapabilities` runs
`await supabase.from("employees").select(column).limit(1)` inside
`for (const column of EMPLOYEE_TELEMETRY_COLUMNS)`. One round-trip per
telemetry column on every cache miss. `listEmployeesForAdmin` invokes the
probe before listing, so the first admin page load after each cache expiry
pays N round-trips. Bounded by the cache TTL and the column allowlist, but
still an avoidable serial hot path. Fix tracked as §10 Move 4 (parallelize
with `Promise.all`, or replace with single `information_schema.columns`
query).

## 4. Tech Debt

- `services/employeeService/index.ts:60-180` carries a runtime "limited
  telemetry" cache that probes for missing columns at request time
  (`detectEmployeeTelemetryCapabilities`). Justified historically by schema
  drift fear; once Phase 1 schemas are considered frozen the probe path can
  be deleted and the columns assumed present (the schema files
  `schemas/employees.sql` ship them).
- `lib/rbac/roles.ts:90-100` writes back `employees.auth_user_id` and
  `setup_status='active'` inside the identity-resolution hot path. Correct
  but couples identity resolution to two writes per first-login request. Not
  urgent.
- `services/leaveService/index.ts:54-75` writeAudit is fire-and-forget
  by default (`required=false`) with `console.error` on failure. Acceptable
  for non-critical events; should be reviewed if audit trail becomes a
  compliance requirement.
- `lib/db/supabaseServer.ts:42-60` service-role client cache is a module
  singleton — fine on serverless Node runtimes; will need re-validation if
  Phase 2 introduces long-lived edge workers that share processes across
  tenants.

## 5. Scary-But-Fine

- Public `GET /api/health` uses `createServiceRoleClient` from an
  unauthenticated endpoint (`app/api/health/route.ts:57, 74, 87`).
  Intentional — the probe needs admin powers to test `auth.admin.listUsers`,
  storage bucket listing, and a HEAD query. Contained to read-only probes;
  no user input reaches the queries; output for unauthenticated callers is
  byte-frozen to `{"status":"ok|degraded"}`.
- `lib/rbac/roles.ts:32` calls `createServiceRoleClient()` on every
  authenticated request via `getActor` → `resolveIdentity`. Necessary because
  reading `app_metadata` requires admin privileges. Cached client is
  singleton; query is index-backed (`auth_user_id`, then email).
- `withSentryConfig` is not applied in `next.config.ts`, source maps are not
  uploaded, `tracesSampleRate: 0` — all three are explicitly documented as
  known limitations in `docs/launch/deployment-runbook.md:330-380`.
  Mitigation: explicit `captureActionError` everywhere + guard.
- `services/leaveService/index.ts:163-178` uses optimistic concurrency on
  decide path via `eq("updated_at", expectedUpdatedAt)`. Correct pattern.
- `app/api/health/route.ts:30-50` constant-time secret compare guards
  against timing attacks on `HEALTHCHECK_SECRET`.

## 6. CI/Deployment Review

`.github/workflows/ci.yml` defines three jobs on Node 22:

| Job | Triggers on | Timeout | Steps |
|---|---|---|---|
| `quality` | every push/PR | 10 min | env:check → typecheck → lint → build |
| `guards` | after `quality` | 5 min | `npm run guards` |
| `smoke` | after `quality`, only on `main` or workflow_dispatch | 15 min | `npm run smoke:core-loop` (graceful skip if `SUPABASE_SERVICE_ROLE_KEY_CI` absent) |

Concurrency is `group: ${{ github.workflow }}-${{ github.ref }}` with
`cancel-in-progress: true` — good (no wasted runners on rapid push).
Permissions are `contents: read` — minimal. No `release.yml` exists at the
audited SHA. Deployment is operator-driven via `docs/launch/deployment-runbook.md`
(Vercel CLI or self-hosted, both documented).

5 most recent successful main-branch runs:

| SHA | Duration |
|---|---|
| `e7b3b28` | 102 s |
| `a5b9556` | 110 s |
| `272b767` | 115 s |
| `a93f360` | 72 s |
| `8158bbd` | 83 s |

Median: **102 s ≈ 1.7 min**. Well under the 8 min budget (GREEN per rubric).
Trend: stable, no upward creep across the four phase merges.

## 7. Observability Review

- Every server action calls `logAction()` and (on failure) `captureActionError()`
  with `requestId`, `actor_user_id`, `actor_tenant_id`, `durationMs`
  (`app/employees/actions.ts:71-160`, `app/leaves/actions.ts`,
  `app/onboarding/actions.ts:29-145`).
- Allowlist of 10 mutations enforced
  (`scripts/guard-telemetry.mjs:14-30`); CI fails if a new critical mutation
  is added without instrumentation.
- Logger never throws and sanitises error message (regex strip of
  email/URL/`Bearer` tokens, 500-char cap)
  (`lib/telemetry/logger.ts:32-95`).
- `scrubPII` recurses to depth 5 with a case-insensitive PII key set
  (`lib/telemetry/scrub.ts:1-90`).
- Sentry `beforeSend` strips `event.user` and scrubs `event.extra`
  (`sentry.server.config.ts:1-50`).
- Health subsystem failures emit `HEALTHCHECK_FAIL` console.error before
  shaping the public response (`app/api/health/route.ts:60-110`).
- Structured-log search workflow is documented for both Linux/macOS and
  PowerShell (`docs/launch/deployment-runbook.md:380-430`).

Gaps acknowledged in `docs/launch/deployment-runbook.md:330-380`: no source
maps, no `withSentryConfig`, no APM tracing. All are accepted Phase 1 trade-offs.

## 8. Supabase/RLS Review

- `schemas/tenancy_rls_v2.sql:28-39` redefines
  `current_actor_tenant_id()` to read **only** from
  `auth.jwt() -> 'app_metadata' ->> 'tenant_id'` — no email fallback.
- `schemas/tenancy_rls_v2.sql:48-52` annotates
  `current_actor_email()` as audit-only, with a non-binding policy comment
  forbidding its use for tenant resolution.
- `schemas/tenancy_rls_v2.sql:56-60` adds
  `unique index employees_tenant_email_active_idx on employees (tenant_id, lower(email)) where deleted_at is null`
  to eliminate ambiguity the old fallback relied upon.
- Service-role usage is the only DB-access pattern in application code
  (53 call sites across health, telemetry, RBAC, and 5 services). RLS is
  defense-in-depth; primary tenancy enforcement is the service-layer
  `.eq("tenant_id", actor.tenantId)` discipline (see IMPORTANT-1).
- Identity resolution at `lib/rbac/roles.ts:130-137` warns
  `[TENANT_MISMATCH]` if `employees.tenant_id` disagrees with the JWT claim —
  visibility for the rare misconfiguration case.
- `npm run verify:rls` exists but requires a separate staging Supabase
  project and cannot run in CI without
  `SUPABASE_URL_STAGING`/`SUPABASE_ANON_KEY_STAGING`/
  `SUPABASE_SERVICE_ROLE_KEY_STAGING` (documented in
  `docs/launch/deployment-runbook.md:430-460`).

## 9. Scaling Readiness

### 9.1 N+1 query patterns

**Erratum (2026-05-29, post-merge)**: The original statement that no
`await supabase…` inside `for`/`forEach`/`map` loops exists is **incorrect**.
`detectEmployeeTelemetryCapabilities` in
`services/employeeService/index.ts:127-160` runs `await supabase.from("employees").select(column).limit(1)`
inside `for (const column of EMPLOYEE_TELEMETRY_COLUMNS)` — one round-trip
per telemetry column on every cache miss. `listEmployeesForAdmin` invokes
that probe before listing, so the first admin page load after each cache
expiry pays N round-trips (where N = number of telemetry columns probed).

Impact is bounded — the result is cached and the probe only runs on miss —
but the claim should not have appeared in a readiness audit. Tracked as
IMPORTANT-4 in §10. Mitigations: parallelize with `Promise.all`, or replace
the per-column probe with a single `information_schema.columns` query.

Other multi-query paths: `submitLeaveRequest` → insert + `select count`
(`services/leaveService/index.ts:145-160`), one-time activation trigger,
cheap. Listing functions use `.in(...)` batches
(`services/activationService/index.ts:108-156`).

### 9.2 Pagination

Listing functions in `services/employeeService/index.ts:185-220` and
`services/leaveService/index.ts:104-130` return unbounded result sets scoped
by `tenant_id`. Acceptable at Phase 1 scale (6–25 employees per tenant); a
`.range(0, N)` cap is straightforward when Phase 2 scale crosses ~500 rows.

### 9.3 Single-writer bottlenecks

None detected. No global rate limits, no in-process queues, no module-level
mutexes. The service-role client singleton (`lib/db/supabaseServer.ts:42-60`)
is read-shared and stateless under Supabase's connection pool.

### 9.4 `npm run guards` cold time

3-run median: **3.15 s** (runs: 2.51 s, 3.15 s, 4.14 s). Well within an
interactive-edit budget.

### 9.5 `npx tsc --noEmit` cold time

3-run median (after deleting `tsconfig.tsbuildinfo` between runs):
**11.01 s** (runs: 12.22 s, 11.01 s, 9.61 s). Acceptable for a
Next.js 15 + React 19 + Sentry project.

### 9.6 CI total runtime (main, last 5 successful)

102 s, 110 s, 115 s, 72 s, 83 s → median **102 s ≈ 1.7 min**.

### 9.7 CI trend assessment

Stable. The four Phase 1 milestone merges (1A → 1D) ran between 72 s and
115 s with no upward drift. Budget headroom to the GREEN threshold (8 min)
is roughly 4×. Phase 2 has runway to add a unit-test framework or a
verify-rls integration job without breaching budget.

## 10. Next 3 Moves

**Anti-drift:** Safeguard / cleanup / hardening only. No feature work. Each
PR ≤ 300 lines of code excluding documentation. Apply strictly in order.

### Move 1 — Add a structural guard for tenancy filter discipline

**STATUS: ✅ DONE** — shipped via PRs [#64](https://github.com/ismaelloveexcel/TeamFrame/pull/64) (initial guard) and [#65](https://github.com/ismaelloveexcel/TeamFrame/pull/65) (tightening: statement-bounded window + per-function allowlist).

Add `scripts/guard-tenancy-filter.mjs` and wire it into
`npm run guards`. Walk `services/**/index.ts`, find each `.from("<table>")`
chain, and assert the same chain contains `.eq("tenant_id"`. Allowlist
intentional exceptions (e.g. `companies` lookups keyed by id). This closes
the IMPORTANT-1 review-only gap with a few hundred lines of JS plus a
documented allowlist. PR scope: 1 new script + 1 package.json entry + 1
docs paragraph.

### Move 2 — Cap `findAuthUserIdByEmail` and emit a warning when the cap is hit

**STATUS: ✅ DONE** — shipped via PRs [#66](https://github.com/ismaelloveexcel/TeamFrame/pull/66) (initial warn) and [#67](https://github.com/ismaelloveexcel/TeamFrame/pull/67) (warn-level + derive maxScanned).

In `services/employeeService/index.ts:434-460`, log
`EMPLOYEE_INVITE_LISTUSERS_CAP_HIT` (with tenantId, attempted page count)
when the 10-page loop exits without a match. This makes IMPORTANT-2 visible
in logs before it becomes a Phase 2 correctness bug. PR scope: ~15 line
change + smoke test note.

### Move 3 — Introduce `vitest` and one negative-tenancy test

**STATUS: ✅ DONE** — shipped via PR [#68](https://github.com/ismaelloveexcel/TeamFrame/pull/68) (filter-applied test), PR [#75](https://github.com/ismaelloveexcel/TeamFrame/pull/75) (cross-tenant data-isolation), and the npm-test-in-CI wiring (closes [#77](https://github.com/ismaelloveexcel/TeamFrame/issues/77)). What landed: `vitest@^4.1.7` devDependency, `vitest.config.ts`, `tests/tenancy-isolation.test.ts` (asserts `.eq("tenant_id", actor.tenantId)` is called exactly once on `listLeavesForEmployee`), `tests/cross-tenant-isolation.test.ts` (filtering fake Supabase builder over a mixed TENANT_A/TENANT_B dataset, four assertions covering both `listLeavesForEmployee` and `listPendingLeavesWithEmployee` from each tenant), and a `Test (vitest)` step added to the Gate Chain (Strict) workflow so the suite cannot silently rot. Engines bumped to `>=20.19.0` for Vite 8.

Mutation-tested locally before merging #75: removing the `.eq("tenant_id", tenantId)` lines causes the new tests to fail loudly with the TENANT_B row leaking into the TENANT_A result.

Add `vitest` as a dev dependency, a `test` script, and one negative-path
test that imports a service function with `tenantId = X` and asserts it
returns zero rows for data in tenant `Y` (using the smoke-loop's staging
client). This creates the harness needed for Phase 2 safety tests without
committing to any feature behaviour. PR scope: 1 dev-dep + 1 `vitest.config.ts`
+ 1 test file + 1 CI job stub.

### Move 4 (added post-audit) — Fix `detectEmployeeTelemetryCapabilities` N+1

**STATUS: ✅ DONE** — shipped via PR [#69](https://github.com/ismaelloveexcel/TeamFrame/pull/69). Collapsed the 5-iteration per-column probe loop into a single multi-column `.select(...).eq("tenant_id", sentinel).limit(0)`. With a retry-on-missing-column path for the degenerate all-missing case (max 5 round-trips, matches legacy worst case) and a restored `isSchemaMissingColumnError` gate to avoid misclassifying RLS/permission errors. Production case: 1 round-trip per cache miss. Allowlist exemption removed — `scripts/guard-tenancy-filter.mjs` `ALLOWLIST` is now empty.

`services/employeeService/index.ts:127-160` issues one
`await supabase.from("employees").select(column).limit(1)` per telemetry
column inside a `for` loop on every cache miss. Replace with either (a)
`Promise.all` over the same probes (preserves error attribution per column),
or (b) a single `information_schema.columns` query keyed by
`table_name = 'employees'` and the column allowlist. Option (b) is cheaper
and more correct but requires service-role schema-introspection privilege.
PR scope: ~30 line change + cache invariant unchanged.

---

### Unverified items

- `services/onboardingService/index.ts` was inferred from grep call-site
  positions (lines 50, 70, 118, 134, 152, 192) rather than read line-by-line
  in this audit window; the IMPORTANT-1 tenancy-discipline assertion assumes
  each call-site is followed by `.eq("tenant_id", …)` consistent with the
  pattern in `leaveService` and `activationService` that *was* read.
- `.github/workflows/release.yml` was not found at the audited SHA. Treated
  as absent — release is operator-driven per
  `docs/launch/deployment-runbook.md`.
- `npm run smoke:core-loop` was not executed during this audit (would
  require live Supabase credentials and writes); the script was read
  statically (`scripts/smoke-core-loop.mjs:1-200`) and asserted idempotent
  by inspection.
- `tsconfig.tsbuildinfo` deletion was performed three times during the cold
  `tsc` measurements; no other file system state was modified by this audit.

## 11. Closure

**Closed:** 2026-05-30. **Final audited state:** `main` at `754b1ed`.

| Move | Description | PR(s) | Status |
|---|---|---|---|
| 1 | Structural guard for tenancy-filter discipline | [#64](https://github.com/ismaelloveexcel/TeamFrame/pull/64), [#65](https://github.com/ismaelloveexcel/TeamFrame/pull/65) | ✅ |
| 2 | Pagination-cap warning on `findAuthUserIdByEmail` | [#66](https://github.com/ismaelloveexcel/TeamFrame/pull/66), [#67](https://github.com/ismaelloveexcel/TeamFrame/pull/67) | ✅ |
| 3 | Vitest harness + negative-tenancy regression test | [#68](https://github.com/ismaelloveexcel/TeamFrame/pull/68), [#75](https://github.com/ismaelloveexcel/TeamFrame/pull/75) | ✅ |
| 4 | Collapse telemetry-capability probe (eliminate N+1) | [#69](https://github.com/ismaelloveexcel/TeamFrame/pull/69) | ✅ |

**IMPORTANT-1 → IMPORTANT-4:** all resolved. The `guard-tenancy-filter`
allowlist is empty as of `754b1ed`; every `.from(...)` chain in
`services/**/index.ts` is mechanically asserted to carry a tenant filter.

**Known non-blocking follow-ups (tracked outside the audit):**

- [#70](https://github.com/ismaelloveexcel/TeamFrame/issues/70) — guard-tenancy-filter parser does not stop at depth-0 commas (`Promise.all([...])` blind spot).
- ~~[#72](https://github.com/ismaelloveexcel/TeamFrame/issues/72)~~ — *Closed* by PR [#75](https://github.com/ismaelloveexcel/TeamFrame/pull/75). Cross-tenant data-isolation test landed.
- ~~[#77](https://github.com/ismaelloveexcel/TeamFrame/issues/77)~~ — *Closed* by the same PR that closes this loop: `npm test` is now part of the Gate Chain (Strict) workflow.

The remaining open follow-up (#70) is not an audit blocker.

**Verdict at closure:** GREEN — unchanged from the original audit. The
codebase remains operationally fit for Phase 2 feature expansion.
