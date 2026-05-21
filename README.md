# TeamFrame

## Product Definition
TeamFrame is a lightweight HR structure infrastructure system for startups with 6–25 employees.

## Core Promise
Provide a clear employee directory, org visibility, onboarding document handling, and minimal leave tracking without expanding into full HR platform complexity.

## V1 Scope
TeamFrame V1 includes only:
- employee directory
- org chart
- onboarding document uploads
- minimal leave requests
- company announcements
- AI-assisted CV-to-bio generation
- AI-assisted contract template generation

Dashboard content is limited to:
- active employee count
- pending leaves
- latest joiners
- latest announcements

## Explicit Non-Goals
TeamFrame is not:
- payroll software
- an enterprise HRIS platform
- an analytics platform
- a workflow automation engine
- an AI HR advisor
- a compliance platform

## Anti-Drift Rules
The system must never evolve into payroll, enterprise HRIS, analytics, workflow automation, AI advice, or compliance automation.

Strictly forbidden:
- payroll features
- benefits management
- analytics dashboards
- onboarding workflow engines
- notification or reminder systems
- Zapier/webhook ecosystems
- AI employee scoring/ranking
- compliance automation
- e-signatures
- document approvals/versioning workflows
- employee preferences/settings systems

## Architecture Principles
- All permission checks must be enforced server-side.
- Frontend authorization is never trusted as a security boundary.
- Required request path:
  - Frontend
  - API Routes / Server Actions
  - RBAC Middleware
  - Service Layer
  - Database

## AI Constraints
AI is strictly limited to:
1. `generateBio(cvText)`
   - input: CV text only
   - output: short employee bio
2. `generateContract(employeeData)`
   - input: structured employee data only
   - output: contract template/PDF output

AI must not:
- access database directly
- access compensation automatically
- infer personality traits
- perform scoring/ranking
- generate HR advice
- generate compliance advice

## Tech Stack
- Next.js 15
- TypeScript
- Supabase
- PostgreSQL
- Supabase Storage
- Supabase Auth
- TailwindCSS
- OpenAI API
- Vercel

## Build Plan
1. Establish auth + server-side RBAC foundation.
2. Implement employee directory and org chart views.
3. Add onboarding document upload and retrieval.
4. Add minimal leave request flow.
5. Add company announcements feed.
6. Add constrained AI endpoints for bio + contract generation.
7. Enforce drift guards in docs and Cursor rules.

## Repository Structure
```text
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
  leaves.sql
  documents.sql

/docs
  architecture.md
  drift-guard.md
  rbac-rules.md
  ai-boundaries.md

/.cursor
  /rules
    teamframe-rules.md
```

## Branching Strategy
- `main`: production-ready only; no direct pushes.
- `develop`: integration branch.
- `feature/*`: isolated feature branches (e.g., `feature/auth`, `feature/rbac`, `feature/org-chart`, `feature/leave-system`).

Recommended protections:
- require pull requests before merge into `main`
- block direct pushes to `main`
- enable required status checks
