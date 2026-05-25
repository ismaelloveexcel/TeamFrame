# TeamFrame

> **A lightweight HR structure system for startups with 6–25 employees.**
>
> Core promise: **we install a working HR structure system in 48–72 hours.**

This README is **the enforcement contract for TeamFrame V1**. If a feature, dependency, or decision conflicts with this document, the README wins until the README is changed.

---

## Currently shipped (truth)

As of the latest commit on `main`, the running app provides:

- **Auth** — Supabase magic-link sign-in (`/auth`, `/auth/callback`, `/auth/check-email`, `/auth/logout`).
- **Dashboard** (`/dashboard`) — real employee counts (total / active / on leave / inactive) with an honest empty state when no employees exist.
- **Employees** (`/employees`) — admins can create / update / archive; non-admins see a read-only org-chart view.
- **Org chart** (`/org-chart`) — whitelist-only employee-scope view.
- **Tenant safety** — server-side role resolution via `requireTenantActor`, every service call takes an explicit `Actor`, RLS on every table.

Everything in the next section ("What TeamFrame is") describes the V1 *target surface*. Items not in the list above are **not yet in the UI**.

---

## What TeamFrame is (V1 target)

The product targets exactly these things:

- **Employee directory** — who's on the team _(shipped)_
- **Org visibility** — a simple org chart _(shipped)_
- **Onboarding document hub** — upload, download, grouped export _(schema + service scaffolded; no UI yet)_
- **Minimal leave tracking** — request, approve, reject _(schema + service scaffolded; no UI yet)_

Nothing more.

Company announcements are **parked**: not in V1 sprint scope. The `company_updates.sql` schema file remains in `/schemas` as a future hook but has no service, no UI, and no roadmap commitment until activation telemetry justifies it.

---

## What TeamFrame is NOT (explicit non-goals)

TeamFrame is **not** any of the following. Do not add them.

- payroll
- benefits
- accounting / tax / compliance engines
- analytics dashboards / HR metrics / engagement scoring
- AI HR advisor / chatbot / copilot
- employee scoring, ranking, personality inference
- hiring pipelines / ATS
- onboarding **workflows** (tasks, reminders, checklists, automation states)
- reminders / notifications engine
- approvals engine, e-signatures, document versioning, retention engines
- performance reviews, compensation benchmarking
- integrations marketplace, Zapier/webhooks ecosystem
- workflow orchestration, automation platform
- plugin / extension systems
- enterprise admin systems, custom RBAC beyond `admin` / `employee`

If a feature resembles **enterprise HRIS**, **workflow automation**, or **AI assistant platform** behavior — it is **V2** and must be rejected.

---

## Anti-drift rules

1. **No new module unless it's already in the allow list above.**
2. **No AI surface in V1.** The previous `/lib/ai` scaffold was removed; reintroducing AI requires an explicit V2 decision.
3. **No new role** beyond `admin` and `employee`.
4. **No new background subsystem** (queue, scheduler, worker, event bus) in V1.
5. **No premature scalability work** (multi-region, sharding, microservices).
6. **No client-side authorization** as a security boundary.
7. **No service-role key** in any code path reachable from the browser.

Detailed bans live in [`docs/drift-guard.md`](docs/drift-guard.md).

---

## Architecture flow

```
Frontend
  → API Routes / Server Actions
    → RBAC Middleware
      → Service Layer
        → Database
```

- The frontend never talks to Supabase with elevated privileges.
- API Routes / Server Actions parse + validate input, then call the service layer.
- RBAC middleware resolves the session and role, server-side, every time.
- The service layer accepts an explicit `Actor` and re-validates authorization.
- The database is reached only by the service layer.

Full detail: [`docs/architecture.md`](docs/architecture.md).

---

## Repository structure

```
/app
  /dashboard          # live counts (real data) + empty state
  /employees          # directory + admin CRUD + actions
  /org-chart          # read-only org view
  /auth               # magic-link sign-in + callback + logout

/lib
  /db                 # Supabase server + browser clients, env access
  /rbac               # role types + resolver

/components
  /OrgChart           # the only component used by /app today

/services
  /employeeService    # shipped; explicit Actor on every call
  /documentService    # scaffolded, not yet surfaced in UI
  /leaveService       # scaffolded, not yet surfaced in UI

/middleware
  auth.ts             # session resolution
  rbac.ts             # role guards (requireRole, requireTenantActor)

/schemas
  employees.sql, employee_profiles.sql, compensation.sql, documents.sql,
  leaves.sql, company_updates.sql, audit_logs.sql

/docs
  architecture.md, drift-guard.md, rbac-rules.md, auth-rules.md,
  ai-boundaries.md, bootstrap-prompt.md, 14-day-sprint-tracker.md
```

---

## Tech stack (locked for V1)

- **Frontend**: Next.js App Router + TypeScript + TailwindCSS
- **Backend**: Supabase Postgres + Supabase Storage + Supabase Auth
- **Deployment**: Vercel

No AI provider in V1. No alternate auth provider. No alternate DB. Switching any of these is V2.

---

## Setup instructions

### 1. Prerequisites
- Node.js 20+
- A Supabase project (Postgres + Storage + Auth)

### 2. Clone and install
```bash
git clone <repo-url>
cd TeamFrame
npm install
```

### 3. Configure environment
Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SITE_URL` *(local dev default: `http://localhost:3030`)*
- `SUPABASE_SERVICE_ROLE_KEY` *(server-only — never expose)*
- `SUPABASE_DB_URL` *(server-only — used by database setup scripts)*

### 4. Apply database and storage setup
```bash
npm run db:apply
npm run storage:setup
```

`db:apply` applies the SQL files in `/schemas` in the correct order. It is
idempotent and safe to re-run. `storage:setup` creates the private `documents`
bucket with the V1 file-type and size limits.

### 5. Lock Supabase auth to magic-link-only
```bash
npm run auth:lock
```
Without a Supabase Management API token this prints a 30-second manual checklist (3 toggles in the dashboard). With one set in `SUPABASE_ACCESS_TOKEN`, it patches the project config automatically.

Also set the Supabase **Magic Link** email template to:

```text
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink
```

For local development, `{{ .SiteURL }}` resolves to `http://localhost:3030`
when the Supabase Site URL is configured to match `SITE_URL`.

### 6. Seed the bootstrap admin
```bash
npm run seed:admin -- you@yourcompany.com "Your Name" "Founder" "Leadership" "UTC"
```
This invites the user via magic link, stamps `app_metadata.role = "admin"`, and creates the matching `employees` row. Re-running is safe.

### 7. Run
```bash
npm run dev
```
Open `http://localhost:3030/auth`, enter the same email, click the link in your inbox, and you'll land on `/dashboard` as an authenticated admin.

---

## Branch protection rules

- `main` — production-ready only. No direct pushes. PR + at least one review.
- `develop` — integration branch.
- `feature/*` — isolated feature work (`feature/auth`, `feature/rbac`, `feature/org-chart`, etc.).

Required GitHub protections for `main`:
- pull request review required
- direct pushes blocked
- required status checks: `Gate Chain (Strict)`
- linear history preferred

Detailed branch protection setup: [`.github/branch-protection.md`](.github/branch-protection.md).

---

## Coding principles

- **Simplicity is a product feature.** Optimize for fast onboarding, not extensibility.
- **Explicit over abstract.** Prefer hand-written guards to clever frameworks.
- **One feature, one justification.** Every new feature must defend itself against the 72-hour setup promise.
- **No premature scalability.** Build for 10 customers. The 11th customer is a happy problem.
- **Reuse existing entities.** New tables are an escalation, not a default.

Sanity check before any feature (also in [`docs/drift-guard.md`](docs/drift-guard.md)):

1. Does this move setup closer to or further from 72-hour readiness?
2. Does this reuse existing entities/tables?
3. Does this introduce workflow automation, HR-ops logic, analytics, or AI scope creep?
4. Can it ship without a new subsystem?

If any answer trends toward complexity, the feature is **V2**.

---

## Security principles

- **Magic-link-only authentication.** No passwords, no OAuth providers, no MFA in V1. See [`docs/auth-rules.md`](docs/auth-rules.md).
- **Server-side RBAC is mandatory.** Client checks are UX hints only.
- **Two roles only**: `admin`, `employee`. See [`docs/rbac-rules.md`](docs/rbac-rules.md).
- **Service-role key is server-only.** Importing `/lib/db/supabaseServer` from a client component is a review block.
- **Compensation is admin-only.** It must never appear in org-chart or employee-scope queries.
- **Audit on every sensitive admin action**: employee delete, compensation change, document delete, leave decision, bulk export.
- **HTTPS only.** Storage encrypted at rest via Supabase defaults.
- **Manual employee delete** is supported (soft-delete via `deleted_at`).

Deferred to V2 (intentionally): compliance dashboards, consent management UI, audit-log dashboards, automated data-export UI.

---

## AI limitations

AI is **not part of V1**. The previous `/lib/ai` scaffold (`generateBio`, `generateContract`) was removed during Phase 1 surface cleanup because it was never wired to any UI. Re-introducing AI requires:

- an explicit V2 product decision,
- a server-only module in `/lib/ai`,
- and updates to [`docs/ai-boundaries.md`](docs/ai-boundaries.md).

Any AI helper, if reintroduced, must still:

- live server-side only,
- never query the database directly,
- never receive an unscoped employee record,
- never access compensation,
- never act as an HR advisor / chatbot,
- never score, rank, or compare employees,
- never be invoked from client-side code.

Full historical boundary spec: [`docs/ai-boundaries.md`](docs/ai-boundaries.md).

---

## Implementation priorities

Build in this order. Do not parallelize past these steps.

1. **Supabase setup** — apply schemas, create storage bucket, seed admin role _(shipped)_
2. **Auth + RBAC** — Supabase Auth sign-in, server-side role resolution, middleware guards _(shipped)_
3. **Employee CRUD** — create/read/update/soft-delete _(shipped)_
4. **Org chart** — whitelist-only employee-scope view _(shipped)_
5. **Document upload system** — upload, download, grouped export (ZIP/PDF) _(not yet)_
6. **Leave requests** — submit, approve, reject _(not yet)_
7. **Instrumentation** — internal `analytics_events` table + server-only `track()` helper for the 8 activation events _(in progress — see `docs/14-day-sprint-tracker.md`)_
8. **Hardening + permissions** — audit-log coverage, RBAC end-to-end review, soft-delete sweeps _(in progress — see `docs/14-day-sprint-tracker.md`)_

Do **not** add V2 features before step 8 is complete. Company announcements and AI helpers are parked until post-V1.

---

## Compliance baseline (V1)

Required at launch:
- Privacy Policy
- Terms of Service
- Data Processing Agreement (DPA)
- HTTPS only
- Encrypted storage via Supabase defaults
- Server-side RBAC enforcement
- Manual employee delete

Deferred to V2: compliance dashboards, consent management UI, audit-log dashboards, automated data export UI, compliance automation.

---

## Final rule

TeamFrame V1 is intentionally constrained. The goal is:

- fast launch
- real customer usage
- operational simplicity
- founder-managed support
- low-maintenance infrastructure

This repository is an **enforcement contract against scope creep**.

**Protect simplicity at all costs.**
