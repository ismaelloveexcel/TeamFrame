# Bootstrap Prompt

This file is the **canonical re-bootstrap prompt** for TeamFrame. Paste it into a new agent/chat to re-establish the scope contract from scratch.

---

You are working on a product called **TeamFrame**.

TeamFrame is **a payroll-ready employee data layer for startup finance teams supporting companies with 6–25 employees**.

The core promise is: *we install a working payroll input layer in 48–72 hours.*

## Launch Lock Mode (Permanent)

Assume TeamFrame is already product-coherent, architecturally stable, and launch-safe.

When operating in launch lock mode:
- do not redesign product direction
- do not expand scope
- do not add runtime behavior
- reinforce identity, boundaries, language, and anti-bloat guardrails only

Allowed changes in launch lock mode:
- documentation, guardrail wording, and vocabulary enforcement
- copy consistency fixes that remove identity drift

Disallowed changes in launch lock mode:
- application logic changes
- schema changes
- service behavior changes
- new product modules or workflows

## What TeamFrame is
- employee data source of truth
- payroll snapshot discipline for finance review and payroll cycles
- export-first payroll input workflow for CSV/Excel handoff
- org visibility (org chart)
- onboarding document hub
- minimal leave tracking
- two constrained AI helpers (CV → bio, contract template)

Finance is the primary user of exports. The product exists to keep employee payroll inputs structured, validated, and exportable.

Required payroll fields:
- name
- designation
- department
- salary
- currency
- pay frequency
- bank account
- bank name
- bank code
- employment status

## What TeamFrame is NOT
TeamFrame is **not** an HRIS, **not** a payroll execution system, **not** a tax engine, **not** a payment rail, **not** an AI HR/payroll/finance advisor, **not** a workflow automation platform, **not** a compliance engine, **not** an analytics product, **not** an ATS.

Additional locked non-goals:
- payroll software
- payroll execution infrastructure
- people operations suite
- workforce management platform

Do not add: payroll execution, benefits, accounting system-of-record features, tax computation, payment processing, compliance engines, analytics dashboards, people-ops metrics, AI HR/payroll/finance chatbots, employee scoring/ranking, hiring pipelines, onboarding workflows/tasks/reminders, approvals engines, e-signatures, document versioning, performance reviews, compensation benchmarking, integrations marketplace, Zapier/webhooks, workflow orchestration, plugin ecosystems, enterprise admin systems.

If a feature resembles payroll execution software, workflow automation, enterprise HRIS, or AI assistant platform — **reject it**.

## V1 scaling rule
Optimized for: 10 paying customers, 6–25 employees per customer, founder-led support.
Not optimized for: enterprise scale, multi-region, heavy concurrency, plugin systems, workflow engines.
Premature scalability = scope drift.

## Tech stack (locked)
- Next.js App Router + TypeScript + TailwindCSS
- Supabase Postgres + Storage + Auth
- OpenAI API only, server-side only, isolated in `/lib/ai`
- Vercel

## Architecture flow (mandatory)
```
Frontend → API Routes / Server Actions → RBAC Middleware → Service Layer → Database
```
All authorization is enforced server-side. Client-side role checks are UX hints only.

## RBAC
Two roles only: `admin`, `employee`. No others.

## AI
Exactly two server-only functions in `/lib/ai`:
1. `generateBio(cvText)` — CV text in, 3–5 sentence bio out.
2. `generateContract(employeeData)` — typed contract fields in, populated template out.

AI must not query the DB, access compensation implicitly, score/rank, infer personality, or give payroll/legal/tax/compliance advice.

## Repository structure (preserve exactly)
```
/app
  /dashboard
  /employees
  /admin
  /auth
/lib
  /ai
  /db
  /rbac
/components
  /OrgChart
  /EmployeeProfile
  /LeaveSystem
/services
  /employeeService
  /documentService
  /leaveService
/middleware
  auth.ts
  rbac.ts
/schemas
  employees.sql
  employee_profiles.sql
  compensation.sql
  documents.sql
  leaves.sql
  company_updates.sql
  audit_logs.sql
/docs
  architecture.md
  drift-guard.md
  rbac-rules.md
  ai-boundaries.md
  bootstrap-prompt.md
/.cursor/rules
  teamframe-rules.md
```

## Sanity check (apply to every proposed feature)
1. Does this move setup closer to or further from 72-hour readiness?
2. Does this reuse existing entities/tables?
3. Does this introduce payroll execution, workflow automation, tax/compliance logic, analytics, or AI scope creep?
4. Can it be implemented without a new subsystem?

If a feature increases operational complexity, workflow complexity, compliance surface, payroll-system similarity, AI scope, HRIS similarity, or onboarding automation — it is **V2**.

## Final rule
TeamFrame V1 is intentionally constrained. The goal is fast launch, real customer usage, finance-ready operations, founder-managed support, and low-maintenance infrastructure. This repository is an **enforcement contract against scope creep**. Protect simplicity at all costs.

Language and UX posture are part of the contract: maintain startup-native, calm, finance-ops-oriented wording. Reject enterprise HR phrasing, generic team management language, and heavy process framing.
