# TeamFrame Environment Parity

## Overview

TeamFrame maintains two Supabase environments:

| Environment | Purpose | Writes allowed from scripts |
|---|---|---|
| **Existing project** (`NEXT_PUBLIC_SUPABASE_URL`) | Production-equivalent. Treat as production until formally separated. | Read-only from parity/verification scripts |
| **Staging** (`SUPABASE_URL_STAGING`) | Isolated test environment. Full schema parity with production. Migration test bed. | All staging scripts |

---

## Staging project setup

### 1. Create the staging Supabase project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New project**
3. Name: `teamframe-staging`
4. Region: match your existing project region
5. Database password: generate a strong password and save it — you'll need it for the connection string
6. Wait for the project to become active (~1–2 minutes)

### 2. Collect credentials

From the staging project dashboard:

- **URL**: Project Settings → API → Project URL → `https://XXXX.supabase.co`
- **Anon key**: Project Settings → API → `anon public`
- **Service role key**: Project Settings → API → `service_role`
- **DB connection string**: Project Settings → Database → Connection string → URI mode
  - Format: `postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres`

### 3. Populate `.env.staging`

Copy `.env.staging.example` to `.env.staging` and fill in the values from step 2.

```
cp .env.staging.example .env.staging
# Edit .env.staging with real values
```

`.env.staging` is git-ignored. Never commit it.

### 4. Apply schemas to staging

```bash
npm run db:apply:staging
```

This applies all schemas (including `tenancy_rls_v2.sql`) to staging only.

### 5. Verify parity

```bash
npm run verify:parity
```

Must exit 0. Output shows RLS enabled state and policy counts for all tenant tables.

---

## Guard pattern (HR5) — mandatory in all staging scripts

Every script that writes to staging must assert at startup that staging and the existing project are different:

```js
if (!process.env.SUPABASE_URL_STAGING) {
  throw new Error("[PARITY_FAIL] SUPABASE_URL_STAGING missing");
}
if (process.env.SUPABASE_URL_STAGING === process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("[PARITY_FAIL] SUPABASE_URL_STAGING must differ from NEXT_PUBLIC_SUPABASE_URL");
}
```

If the guard fails, the script exits immediately with a non-zero code. **Never skip this check.**

---

## How to switch between environments

- All `*:staging` scripts (`db:apply:staging`, `db:reset:staging`, `verify:parity`, `verify:rls`) read from `.env.staging`.
- The main app and existing scripts read from `.env.local`.
- Never mix the two env files. The HR5 guard is the last line of defence.

---

## How to never accidentally write to the existing project

1. The HR5 guard is present in every staging script.
2. The existing project's `SUPABASE_DB_URL` is **not** referenced in any staging script.
3. `verify:parity` treats the existing project as read-only (no writes in `queryDb`).
4. If you write a new staging script, copy the HR5 guard block from any existing staging script verbatim.

---

## Resetting staging to a clean state

```bash
ALLOW_DESTRUCTIVE_RESET=true npm run db:reset:staging
```

This drops all public-schema tables in staging and reapplies all schemas. Auth users and storage buckets are unaffected.

---

## Project references

| | Existing project | Staging |
|---|---|---|
| Dashboard URL | *(see Supabase dashboard — do not commit)* | *(fill in after creation)* |
| Env var (URL) | `NEXT_PUBLIC_SUPABASE_URL` | `SUPABASE_URL_STAGING` |
| Env var (anon key) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `SUPABASE_ANON_KEY_STAGING` |
| Env var (service role) | `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY_STAGING` |
| Env var (DB URL) | `SUPABASE_DB_URL` | `SUPABASE_DB_URL_STAGING` |
| Schemas applied | `tenancy_rls.sql` (v1) | `tenancy_rls.sql` + `tenancy_rls_v2.sql` |
| v2 migration status | **Pending orchestrator review** | Applied |
