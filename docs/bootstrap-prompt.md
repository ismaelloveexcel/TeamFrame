# Bootstrap Prompt

This file is the **canonical re-bootstrap prompt** for TeamFrame. Paste it into a new agent/chat to re-establish the scope contract from scratch.

---

You are working on a product called **TeamFrame**.

TeamFrame is **a lightweight HR structure system for startups with 6–25 employees**.

The core promise is: *we install a working HR structure system in 48–72 hours.*

## What TeamFrame is
- employee directory
- org visibility (org chart)
- onboarding document hub
- minimal leave tracking
- two constrained AI helpers (CV → bio, contract template)

## What TeamFrame is NOT
TeamFrame is **not** an HRIS, **not** a payroll system, **not** an AI HR advisor, **not** a workflow automation platform, **not** a compliance engine, **not** an analytics product, **not** an ATS.

Do not add: payroll, benefits, accounting, tax, compliance engines, analytics dashboards, HR metrics, AI HR chatbots, employee scoring/ranking, hiring pipelines, onboarding workflows/tasks/reminders, approvals engines, e-signatures, document versioning, performance reviews, compensation benchmarking, integrations marketplace, Zapier/webhooks, workflow orchestration, plugin ecosystems, enterprise admin systems.

If a feature resembles HR operations software, workflow automation, enterprise HRIS, or AI assistant platform — **reject it**.

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

AI must not query the DB, access compensation implicitly, score/rank, infer personality, or give HR/legal/compliance advice.

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
3. Does this introduce workflow automation, HR ops logic, analytics, or AI scope creep?
4. Can it be implemented without a new subsystem?

If a feature increases operational complexity, workflow complexity, compliance surface, AI scope, HRIS similarity, or onboarding automation — it is **V2**.

## Final rule
TeamFrame V1 is intentionally constrained. The goal is fast launch, real customer usage, operational simplicity, founder-managed support, low-maintenance infrastructure. This repository is an **enforcement contract against scope creep**. Protect simplicity at all costs.
