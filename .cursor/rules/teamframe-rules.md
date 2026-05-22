---
description: TeamFrame V1 scope and anti-drift contract. Always apply to this repo.
alwaysApply: true
---

# TeamFrame — Cursor Rules

You are working inside the TeamFrame repository. Treat this file as a **hard contract**, not advice.

## What TeamFrame is
A **lightweight HR structure system for startups with 6–25 employees.**

Core promise: *we install a working HR structure system in 48–72 hours.*

## Allowed V1 modules (this is the entire product)
- employee directory
- org chart / org visibility
- onboarding document hub (upload, download, grouped export)
- minimal leave tracking (request, approve, reject)
- company updates (simple feed)
- two constrained AI helpers in `/lib/ai`:
  - `generateBio(cvText)`
  - `generateContract(employeeData)`

If a request is not covered by this list, it is **V2** and must be refused or scoped down.

## Hard anti-drift bans
Never propose or implement:
- payroll, benefits, accounting, tax
- compliance engines / dashboards / advisory
- analytics dashboards, HR metrics, charts, trend lines, engagement scoring
- AI HR advisor / chatbot / copilot
- employee scoring, ranking, personality inference, performance reviews
- compensation benchmarking
- hiring pipelines / ATS
- onboarding *workflows* (tasks, reminders, checklists, automation states, escalations)
- approvals engine, e-signatures, document versioning / retention engines
- notifications / reminders infrastructure
- Zapier / webhooks / integrations marketplace
- workflow orchestration, automation platforms, DAG engines
- plugin / extension systems
- enterprise admin systems, custom RBAC beyond `admin` / `employee`
- multi-region / sharding / event sourcing / microservices

If a feature resembles **enterprise HRIS**, **workflow automation**, or **AI assistant platform** — reject it.

## Architecture enforcement (non-negotiable)

Request flow:

```
Frontend → API Routes / Server Actions → RBAC Middleware → Service Layer → Database
```

- All authorization is enforced **server-side**.
- Client role checks are UX hints only; they never grant access.
- The Supabase **service role key** is server-only. Never reachable from the browser.
- Compensation must never appear in org-chart or employee-scope queries.

## RBAC contract
- Exactly two roles: `admin`, `employee`. Do not invent more.
- Services accept an explicit `Actor` argument (`{ authUserId, email, employeeId, role }`) and re-check authorization.
- Sensitive admin actions write to `audit_logs`.

## Auth contract (Magic Link only)
- Authentication is Supabase **Magic Link only**. No passwords, no OAuth providers, no MFA in V1.
- No sign-up form. Admins invite new employees; first magic-link login links the auth user to the employee record by email.
- Role is set server-side (Supabase Dashboard or the bootstrap script). Never derived from client input or email domain.
- Disabled in Supabase project settings: password login, open sign-ups, all OAuth providers.

## AI contract
- AI lives only in `/lib/ai`.
- Exactly two server-side functions: `generateBio`, `generateContract`.
- AI **never**: queries the DB, receives unscoped employee records, accesses compensation implicitly, scores/ranks, infers traits, or gives HR/legal/compliance advice.
- Provider: OpenAI only. No multi-provider abstraction in V1.

## Engineering posture
- Build for **10 paying customers**, 6–25 employees each, founder-led support.
- Prefer explicitness over abstraction.
- Avoid framework-heavy patterns.
- No premature scalability. Premature scalability is scope drift.
- Every feature must justify itself against the 72-hour setup promise.

## Sanity check before any new feature
1. Does this move setup closer to or further from 72-hour readiness?
2. Does this reuse existing entities/tables?
3. Does this introduce workflow automation, HR-ops logic, analytics, or AI scope creep?
4. Can it ship without a new subsystem (queue, scheduler, background worker, plugin host)?

If any answer trends toward complexity, treat it as **V2** and stop.

## When in doubt
Re-read `/docs/drift-guard.md`, `/docs/ai-boundaries.md`, and `/docs/rbac-rules.md`. The README is the human-facing summary of this contract.
