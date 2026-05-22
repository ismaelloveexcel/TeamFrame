# Architecture

## Purpose
Define the minimum architecture contract for TeamFrame V1 and prevent platform drift.

TeamFrame is a **lightweight HR structure system** for startups with **6–25 employees**. The core promise is: *we install a working HR structure system in 48–72 hours*. Every architectural decision must serve that promise. Anything that does not is V2.

## Tech Stack
- **Frontend**: Next.js App Router, TypeScript, TailwindCSS
- **Backend**: Supabase Postgres, Supabase Storage, Supabase Auth
- **AI**: OpenAI API, server-side only, isolated in `/lib/ai`
- **Deployment**: Vercel

## Request Flow (mandatory)

```
Frontend
  → API Routes / Server Actions
    → RBAC Middleware
      → Service Layer
        → Database
```

No layer may be skipped. No client may bypass the middleware. No service-role key may ever reach the browser.

## Layer Responsibilities

| Layer | Allowed | Forbidden |
|---|---|---|
| Frontend (`/app`, `/components`) | rendering, form state, UX-only role hints | authoritative permission checks, direct Supabase calls with the service role, calling `/lib/ai` directly |
| API Routes / Server Actions | parse + validate input, invoke middleware, call services, shape response | embedding business rules inline, talking to the DB directly |
| RBAC Middleware (`/middleware`) | resolve session, attach role, gate by role | data fetching, business logic |
| Service Layer (`/services`) | enforce domain invariants, call DB, call `/lib/ai`, write audit logs | reading session/role itself (must be passed in), bypassing RBAC |
| Database (`/schemas`) | persist state | application logic |

## Security Baseline
- Server-side RBAC is **mandatory** for every protected operation.
- Frontend role checks are **UX-only** and never grant access.
- The Supabase **service role key** is server-only and must never appear in any code path reachable from the browser.
- Compensation data is admin-only and must never be selected in code paths that feed the org chart, employee directory, or AI prompts.
- HTTPS only. Storage encrypted at rest via Supabase defaults.

## V1 Domain Boundaries
- employee directory
- org visibility
- onboarding document hub
- minimal leave tracking
- company updates
- two constrained AI helpers (bio + contract template)

Anything outside this list is V2.

## V1 Scaling Posture
Optimized for:
- 10 paying customers
- 6–25 employees per customer
- founder-led onboarding and support

Explicitly **not** optimized for: enterprise scale, multi-region, heavy concurrency, plugin ecosystems, workflow engines. Premature scalability is treated as scope drift.
