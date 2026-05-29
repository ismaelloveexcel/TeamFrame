# Observability — TeamFrame

**Phase:** 1B — Reliability Foundation  
**Status:** Scaffolded — Sentry dormant until DSN provisioned

---

## Architecture

Three observability layers:

| Layer | Mechanism | Purpose | System of record? |
|---|---|---|---|
| Structured logger | `lib/telemetry/logger.ts` | Machine-readable server action audit trail | No — CloudWatch/Datadog ingests these |
| Sentry | `@sentry/nextjs` + `lib/telemetry/sentry.ts` | Exception capture, alert routing | No — Sentry is the alert bus |
| Audit log | `audit_logs` Supabase table | Immutable compliance record | **Yes** |

The logger does NOT replace the `audit_logs` table. The audit table is the system of record for compliance. The logger is operational telemetry.

---

## Environment Variables

### Required for Sentry to activate

| Variable | Side | Description |
|---|---|---|
| `SENTRY_DSN` | Server | Sentry project DSN. Omit to keep Sentry dormant. |
| `NEXT_PUBLIC_SENTRY_DSN` | Client | Same DSN value — required separately because Next.js only exposes `NEXT_PUBLIC_*` to the browser. |

### Required for `/api/health` authenticated detail

| Variable | Side | Description |
|---|---|---|
| `HEALTHCHECK_SECRET` | Server | Secret header value for `X-Healthcheck-Key`. Generate: `openssl rand -hex 32` |

---

## Sentry Provisioning (per environment)

### 1. Create a Sentry project

1. Go to [sentry.io](https://sentry.io) → New Project → Next.js
2. Note the DSN (looks like `https://<key>@<org>.ingest.sentry.io/<project-id>`)

### 2. Add the DSN to each environment

**Local dev (`.env.local`):**
```
SENTRY_DSN=https://...
NEXT_PUBLIC_SENTRY_DSN=https://...
```

**Staging / Production:**  
Add both variables to your hosting provider's environment settings (Vercel / Railway / etc.).

**CI (`.github/workflows/ci.yml` secrets):**  
Add `SENTRY_DSN` as a repository secret if you want CI builds to report errors to Sentry.  
The `quality` job does not require Sentry to pass — it is optional.

### 3. Verify a test event

Start the dev server with the DSN set, then trigger the global error boundary:
```bash
# Open browser dev console and run:
window.__triggerSentryTest = () => { throw new Error("Sentry test event"); };
window.__triggerSentryTest();
```

Alternatively, call a server action with invalid input to trigger a `logAction` + `captureActionError` call.

Check Sentry Issues dashboard for the event within ~30 seconds.

### 4. Configure alert rules (manual step after DSN provisioned)

In Sentry → Alerts → Create Alert:
- **Metric alert**: `count(errors) > 5 in 5 minutes` → notify on-call Slack channel
- **Issue alert**: Any new issue → notify `#teamframe-errors`

> Without DSN: Sentry is fully dormant — `captureActionError` is a no-op. The app boots and operates normally.

---

## Structured Logger Format

Each action emits one JSON line (or pretty-print in development).

**Success example:**
```json
{
  "ts": "2025-01-15T10:22:33.451Z",
  "action": "updateEmployee",
  "outcome": "ok",
  "actor_user_id": "a1b2c3d4-...",
  "actor_tenant_id": "t1t2t3t4-...",
  "duration_ms": 87,
  "request_id": "r9r8r7r6-..."
}
```

**Failure example:**
```json
{
  "ts": "2025-01-15T10:22:34.210Z",
  "action": "decideLeave",
  "outcome": "fail",
  "actor_user_id": "a1b2c3d4-...",
  "actor_tenant_id": "t1t2t3t4-...",
  "duration_ms": 12,
  "request_id": "r9r8r7r6-...",
  "tagged_prefix": "[ACTION_FAIL]",
  "error_name": "Error",
  "error_message_sanitised": "FORBIDDEN"
}
```

**PII scrubbing:** `email`, `name`, `phone`, `address`, `token`, `magic_link`, `password`, `ip`, `user_agent`, `body` keys are replaced with `[REDACTED]` before any log emit or Sentry send.

---

## Health Endpoint

`GET /api/health`

| Request | Response |
|---|---|
| No / wrong `X-Healthcheck-Key` header | `{ "status": "ok" \| "degraded" }` — 200 or 503 |
| Correct `X-Healthcheck-Key` | `{ "status", "subsystems": { "db", "storage" }, "timestamp" }` — 200 or 503 |

Subsystem timeouts: 2 s each. Overall ceiling: 2.5 s.  
Auth subsystem probe is intentionally deferred — no probe means no false confidence in auth health.

---

## Retention Note

- **Logger output** (`console.log` JSON): ephemeral unless captured by your hosting provider's log drain (Vercel Log Drains, Railway logs, etc.). Not a compliance record.
- **`audit_logs` table**: persistent, RLS-protected, system of record for all mutations. Never truncate without legal review.
- **Sentry events**: retention controlled by your Sentry plan (default 90 days).
