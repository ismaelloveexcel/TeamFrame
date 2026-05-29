# Deployment Runbook — TeamFrame

**Phase:** 1D — Stabilization  
**Status:** Operator-ready

This runbook covers every step required to deploy a working TeamFrame instance: from environment preparation through post-deploy smoke verification. Every command is copy-pasteable. Platform-specific steps are clearly marked.

---

## Table of Contents

1. [Environment Checklist](#1-environment-checklist)
2. [Pre-Deploy Verification](#2-pre-deploy-verification)
3. [Deployment Procedure](#3-deployment-procedure)
4. [Health Verification](#4-health-verification)
5. [Incident Handling](#5-incident-handling)
6. [Known Limitations](#6-known-limitations)

---

## 1. Environment Checklist

### Required Variables — All Environments

| Variable | Runtime | Required? | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | **Yes** | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | **Yes** | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | **Yes** | Service role key — bypasses RLS. Must NEVER be exposed to the browser. |
| `SITE_URL` | Server only | **Yes** | Full origin URL (e.g. `https://teamframe.example.com`). Used in auth redirects. |
| `HEALTHCHECK_SECRET` | Server only | **Yes (prod)** | Secret for `X-Healthcheck-Key` header on `/api/health`. Generate: `openssl rand -hex 32`. May be omitted in local dev. |
| `SENTRY_DSN` | Server only | Optional | Sentry project DSN. Omit to keep Sentry dormant. |
| `NEXT_PUBLIC_SENTRY_DSN` | Client | Optional | Same DSN value — required separately because Next.js only exposes `NEXT_PUBLIC_*` to the browser. Must match `SENTRY_DSN`. |
| `SENTRY_DEBUG` | Server only | Never in prod | Set `"true"` ONLY to verify Sentry init wiring on first deploy. Remove after confirmed. |

### Staging-only Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL_STAGING` | Staging Supabase project URL (separate project from production). Required by `verify-rls`. |
| `SUPABASE_ANON_KEY_STAGING` | Staging anon key |
| `SUPABASE_SERVICE_ROLE_KEY_STAGING` | Staging service role key |

### Staging vs Production Distinctions

| Concern | Staging | Production |
|---|---|---|
| Supabase project | Separate project (different URL + keys) | Production project |
| `SENTRY_DEBUG` | Permitted during onboarding only | Must be absent or empty |
| `HEALTHCHECK_SECRET` | Optional | Required |
| `SITE_URL` | `https://staging.teamframe.example.com` | `https://teamframe.example.com` |
| RLS verification | Run `npm run verify:rls` against staging before promoting | Not applicable |

### Verify All Required Variables Are Set (local)

```bash
npm run env:check
```

Expected output:
```
✓ Environment validation passed for mode 'build'
  Required vars present: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SITE_URL
  ...
```

---

## 2. Pre-Deploy Verification

Run in order. Stop and resolve any failure before continuing.

### Step 1 — Type check

```bash
npm run typecheck
```

Expected: no output, exit 0.

### Step 2 — Lint

```bash
npm run lint
```

Expected: `✔ No ESLint warnings or errors`, exit 0.

### Step 3 — Static guard suite

```bash
npm run guards
```

Expected output:
```
[PASS] guard-instrumentation: all Sentry wiring checks passed
  ✓ instrumentation.ts exists
  ✓ sentry.server.config.ts exists
  ✓ sentry.edge.config.ts exists
  ✓ instrumentation.ts imports "./sentry.server.config"
  ✓ instrumentation.ts imports "./sentry.edge.config"
[PASS] guard-health-contract: public health response contract verified
  ✓ app/api/health/route.ts exists
  ✓ Sentinel comment found (char offset ...)
  ✓ No "subsystems" key in public response section
  ✓ No "timestamp" key in public response section
  ✓ Public JSON object has exactly one key: status
  ✓ Contract regex /^{"status":"(ok|degraded)"}$/ matches:
      "{"status":"ok"}"
      "{"status":"degraded"}"
[PASS] guard-telemetry: all critical mutations have logAction + captureActionError
  ✓ app/employees/actions.ts :: createEmployeeAction
  ...
```

### Step 4 — Build

```bash
npm run build
```

Expected: `✓ Compiled successfully`, exit 0.

---

## 3. Deployment Procedure

### Option A — Vercel (recommended for Next.js)

> **TODO [OPERATOR_TASK]:** Configure Vercel project and link repository before running these commands.

#### First deploy

```bash
# Install Vercel CLI if not already installed
npm install -g vercel

# Link to project (one-time)
vercel link

# Set required environment variables (one-time per env)
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add SITE_URL production
vercel env add HEALTHCHECK_SECRET production
vercel env add SENTRY_DSN production
vercel env add NEXT_PUBLIC_SENTRY_DSN production

# Deploy to production
vercel --prod
```

Expected: `✅  Production: https://teamframe.example.com [2s]`

#### Subsequent deploys (from CI or Git push)

Enable automatic deployments in Vercel dashboard: Settings → Git → Production Branch → `main`.

#### Rollback (Vercel)

```bash
# List recent deployments
vercel ls

# Promote a previous deployment to production
vercel promote <deployment-url>
```

---

### Option B — Self-hosted / Docker

> **TODO [OPERATOR_TASK]:** Provide infrastructure-specific commands (container registry, host, orchestrator) once deployment target is confirmed.

```bash
# Build the Next.js production bundle
npm run build

# Set env vars in your server environment, then start
npm run start
# Server listens on port 3000 by default (override: PORT=<n> npm run start)
```

Ensure the process manager (systemd, PM2, Docker, etc.) restarts on failure.

---

### Verification Steps (post-deploy)

Run the following immediately after any deployment:

```bash
# 1. Public health check — must return {"status":"ok"}
curl -sf https://YOUR_DOMAIN/api/health
# Expected output: {"status":"ok"}

# 2. Authenticated health check — must return subsystem detail
curl -sf -H "X-Healthcheck-Key: YOUR_HEALTHCHECK_SECRET" https://YOUR_DOMAIN/api/health
# Expected output: {"status":"ok","subsystems":{"db":"ok","storage":"ok","auth":"ok"},"timestamp":"..."}

# 3. Auth redirect sanity — must redirect (302 or 307) to /auth
curl -sv https://YOUR_DOMAIN/dashboard 2>&1 | grep -E "< HTTP|Location:"
# Expected: HTTP/2 3xx  +  Location: .../auth
```

---

### Rollback Steps

If post-deploy checks fail:

```bash
# Vercel: instant rollback to previous deployment
vercel rollback

# Self-hosted: redeploy the previous git tag
git checkout <previous-tag>
npm install
npm run build
npm run start
```

---

## 4. Health Verification

### Public endpoint (unauthenticated)

```bash
curl -s https://YOUR_DOMAIN/api/health
```

**Healthy:**
```json
{"status":"ok"}
```

**Degraded (one or more subsystems failing):**
```json
{"status":"degraded"}
```

HTTP status codes: `200` (ok) or `503` (degraded).

The public endpoint never returns subsystem detail — this is by design (no information disclosure).

---

### Authenticated endpoint (subsystem detail)

```bash
curl -s \
  -H "X-Healthcheck-Key: <HEALTHCHECK_SECRET>" \
  https://YOUR_DOMAIN/api/health
```

**Healthy:**
```json
{
  "status": "ok",
  "subsystems": {
    "db": "ok",
    "storage": "ok",
    "auth": "ok"
  },
  "timestamp": "2026-05-29T12:00:00.000Z"
}
```

**Degraded (example: auth subsystem failing):**
```json
{
  "status": "degraded",
  "subsystems": {
    "db": "ok",
    "storage": "ok",
    "auth": "fail"
  },
  "timestamp": "2026-05-29T12:00:01.234Z"
}
```

### Degraded-state interpretation

| Failing subsystem | Likely cause | Impact |
|---|---|---|
| `db` | Supabase DB unreachable or RLS query failed | All data operations fail |
| `storage` | Supabase Storage unreachable or bucket listing failed | Document uploads/downloads fail |
| `auth` | Supabase Auth admin API unreachable or returned error | New logins, invite flows may fail |
| All three (`db + storage + auth`) | Overall response ceiling (2.5 s) exceeded | Supabase project may be unreachable |

---

## 5. Incident Handling

### Ordered investigation flow

1. **Check overall status:** `curl -s https://YOUR_DOMAIN/api/health`
2. **Get subsystem detail:** use authenticated health check (see above)
3. **Search structured logs** for failures (see grep examples below)
4. **Verify Sentry** received the event
5. **Determine rollback trigger** (see rollback criteria below)

---

### Structured log search (JSON logs)

The application emits structured JSON log lines via `lib/telemetry/logger.ts`. All lines include `outcome: "ok" | "fail"`, `action`, `actorUserId`, `durationMs`, `requestId`.

**Find all action failures:**

```bash
# Linux/macOS
grep '"outcome":"fail"' /path/to/app.log | tail -50

# PowerShell
Get-Content app.log | Select-String '"outcome":"fail"' | Select-Object -Last 50
```

**Find failures for a specific action:**

```bash
# Linux/macOS (e.g., submitLeave)
grep '"action":"submitLeave"' /path/to/app.log | grep '"outcome":"fail"'

# PowerShell
Get-Content app.log | Select-String '"action":"submitLeave"' | Select-String '"outcome":"fail"'
```

**Find health check failures:**

```bash
# Linux/macOS
grep 'HEALTHCHECK_FAIL' /path/to/app.log

# PowerShell
Get-Content app.log | Select-String 'HEALTHCHECK_FAIL'
```

**Trace a specific request by requestId:**

```bash
# Linux/macOS
grep '"requestId":"<UUID>"' /path/to/app.log

# PowerShell
Get-Content app.log | Select-String '"requestId":"<UUID>"'
```

---

### Sentry verification workflow

If `SENTRY_DSN` is configured:

1. Open Sentry project → Issues tab
2. Filter by: environment `production`, level `error`
3. Each `captureActionError` call emits an event with:
   - `extra.actor_user_id` (or `null` for pre-auth failures)
   - `extra.actor_tenant_id` (or `null`)
   - `extra.requestId`
   - `event.user` is always stripped (PII-safe)

**Verify Sentry init fired on deploy:**

On first deploy with `SENTRY_DEBUG=true` set temporarily:
```
[SENTRY] init() called runtime=nodejs
[SENTRY] init() called runtime=edge
```

Both lines must appear exactly once in the startup log. Remove `SENTRY_DEBUG` after confirming.

---

### Rollback triggers

Roll back immediately if any of the following are true after deployment:

- `GET /api/health` returns `{"status":"degraded"}` for > 2 minutes after deploy
- Auth subsystem is `fail` and logins are failing
- Structured logs show `"outcome":"fail"` for > 5% of action requests
- Any Sentry event contains `NO_TENANT_CONTEXT` from a request that should have a valid tenant
- TypeScript build fails on the deployed commit

---

## 6. Known Limitations

These items were intentionally deferred from Phases 1A–1D and are documented here for operational awareness.

### Sentry source maps not uploaded

Sentry events will reference minified source positions. Source maps are not uploaded to Sentry during CI. Stack traces will be harder to read.

**Mitigation:** Set `SENTRY_DEBUG=true` temporarily to confirm Sentry init fires. All `captureActionError` calls are present in source.

**TODO [OPERATOR_TASK]:** Wire `SENTRY_AUTH_TOKEN` and `withSentryConfig` in `next.config.ts` during a CI pipeline step to upload source maps on release.

### `withSentryConfig` not applied in `next.config.ts`

Sentry SDK does not wrap the Next.js build config. This means:
- No automatic server component error boundaries
- No automatic API route error capture (only explicit `captureActionError` calls)
- No release tracking via build metadata

**Mitigation:** Explicit `captureActionError` covers all critical mutations (Phase 1C). The guard script `guard-telemetry.mjs` prevents silent regression.

### `SENTRY_DEBUG=true` is not safe for production

The `[SENTRY] init() called runtime=...` log is for wiring verification only. Leaving `SENTRY_DEBUG=true` in production will emit a log line on every cold start / edge boot.

**Mitigation:** Remove from `.env` after confirming wiring. Guard: `SENTRY_DEBUG` is omitted from `validate-env.mjs` required vars — it will not block deploy if absent.

### Auth invite flow known issue (staging)

Newly created employee invites can fail with `EMPLOYEE_INVITE_FAILED` / `/auth?error=callback_failed&reason=expired_link` in some environments. This is a Supabase invite provider configuration issue, not an application regression.

**Resolution:** Validate invite provider configuration and magic-link redirect URL in Supabase dashboard before treating as application bug.

### `openai.chatgpt` VS Code extension conflict

On Windows, the `openai.chatgpt` extension can lock `codex.exe`. This does not affect deployments — document only.

### RLS harness (`verify-rls`) requires staging

`npm run verify:rls` must be run against the staging Supabase project only (enforced by the HR5 guard in the script). It cannot run in CI without a dedicated staging project with `SUPABASE_URL_STAGING` configured.

**TODO [OPERATOR_TASK]:** Add `SUPABASE_URL_STAGING`, `SUPABASE_ANON_KEY_STAGING`, `SUPABASE_SERVICE_ROLE_KEY_STAGING` as GitHub Actions secrets and wire `verify:rls` into release validation.

### Performance tracing disabled

`tracesSampleRate: 0` in all Sentry configs. No APM traces are collected. This is intentional for Phase 1 (cost + complexity control).

---

*Last updated: 2026-05-29 — Phase 1D*
