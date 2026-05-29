# Consolidated Audit Findings

These findings are synthesized from five separate audit reports (archived in `audit-reports-archive/`). Source audit numbers correspond to the archive filenames. All Status fields initialize to Open.

## Critical (Launch Blockers)

| ID | Finding | Affected Files | Source Audit | Status | Verification Artifact |
|----|---------|----------------|-------------|--------|-----------------------|
| M1 | Enable RLS + tenant policy on `companies` table | `schemas/tenancy_rls.sql`, `schemas/companies.sql` | Audits 2, 3 | Open | TBD |
| M2 | Add RLS policies to `onboarding_tasks` (RLS enabled, zero policies) | `schemas/tenancy_rls.sql` | Audits 1, 2, 3 | Open | TBD |
| M3 | HTTP security headers in next.config.ts (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) | `next.config.ts` | Audits 1, 2 | Open | TBD |
| M5 | Guard `inviteEmployeeAuthUser` against cross-tenant `app_metadata` overwrite | `services/employeeService/index.ts` | Audits 2, 3 | Open | TBD |
| M7 | Restrict employees + employee_profiles SELECT — self+admin full, safe view (employees_public) for tenant-wide directory | `schemas/tenancy_rls.sql`, `schemas/employees.sql`, `schemas/employee_profiles.sql` | Audit 3 | Open | TBD |
| M8 | Fix callback failure path — never wipe active session cookies on stale/scanner-hit links, only PKCE verifier cookies | `app/auth/callback/route.ts` | Audit 3 | Open | TBD |

## High (Reliability Risks)

| ID | Finding | Affected Files | Source Audit | Status | Verification Artifact |
|----|---------|----------------|-------------|--------|-----------------------|
| M4 | Fix softDeleteEmployee silent NOT_FOUND — exits with no error when employee never existed or was already deleted | `services/employeeService/index.ts` | Audit 1 | Open | TBD |
| M6 | Add status='pending' guard to decideLeaveRequest | `services/leaveService/index.ts` | Audit 1 | Open | TBD |
| M9 | Make employee provisioning atomic OR add visible link-status + admin re-invite action | `services/employeeService/index.ts`, `lib/rbac/roles.ts` | Audit 4 | Open | TBD |
| M10 | Add `app/error.tsx` with graceful "sign out and retry" recovery for server component crashes | `app/error.tsx` (new) | Audit 4 | Open | TBD |
| M12 | Fail loud on audit-log insert failure for sensitive admin mutations (employee creation, leave decisions, role changes) | `services/employeeService/index.ts`, `services/leaveService/index.ts` | Audit 4 | Open | TBD |
| M13 | Tighten policies and procedures SELECT to published-only for non-admins (verify is_published column exists first) | `schemas/tenancy_rls.sql`, `schemas/policies.sql`, `schemas/procedures.sql` | Audit 2 | Open | TBD |
| M14 | Deterministic email fallback — add ORDER BY created_at LIMIT 1 to current_actor_tenant_id() | `schemas/tenancy_rls.sql` | Audit 2 | Open | TBD |
| M15 | Convert /auth/logout from route handler to server action (CSRF protection) | `app/auth/logout/route.ts`, `app/auth/actions.ts` | Audit 2 | Open | TBD |
| M16 | Add basic rate limiting on sendMagicLink — 5 req/15min/IP, 3 req/10min/email | `app/auth/actions.ts` | Audits 2, meta-review | Open | TBD |

## Medium (UX / Polish)

| ID | Finding | Affected Files | Source Audit | Status | Verification Artifact |
|----|---------|----------------|-------------|--------|-----------------------|
| M11 | Replace UUIDs with employee names in admin leave queue | `app/leaves/page.tsx` | Audit 4 | Open | TBD |
| M17 | Add Zod validation to submitLeaveRequest | `services/leaveService/index.ts` | Audit 1 | Open | TBD |

## Low (Cleanup)

| ID | Finding | Affected Files | Source Audit | Status | Verification Artifact |
|----|---------|----------------|-------------|--------|-----------------------|
| M18 | Remove dead openaiApiKey getter | `lib/db/env.ts` | Audits 1, 4 | Open | TBD |
| M19 | Clean up /lib/ai references in docs and .env.example | `docs/architecture.md`, `docs/ai-boundaries.md`, `.env.example` | Audits 1, 4 | Open | TBD |
| M20 | Confirm Supabase backup tier (PITR enabled) and document recovery procedure | Operational — no code change | Meta-review | Open | TBD |
