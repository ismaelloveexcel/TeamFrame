# Batch 1 — Schema and RLS

## Objective
Implement and verify Batch 1 hardening with the security standard:

"Prove cross-tenant access is impossible using direct database and REST paths."

Do not rely on UI behavior as a security signal.

## Scope
Mandatory findings in this batch:

- M1 — Enable RLS + tenant policy on `companies`
- M2 — Add RLS policies to `onboarding_tasks`
- M7 — Restrict `employees` + `employee_profiles` SELECT with safe tenant directory projection
- M13 — Restrict `policies` and `procedures` SELECT to published-only for non-admins
- M14 — Make `current_actor_tenant_id()` email fallback deterministic

Read and work from current repository state in:

- `schemas/tenancy_rls.sql`
- `schemas/employees.sql`
- `schemas/employee_profiles.sql`
- `schemas/companies.sql`
- `schemas/onboarding_tasks.sql`
- `schemas/policies.sql`
- `schemas/procedures.sql`
- `services/employeeService/index.ts`
- `lib/db/supabaseServer.ts`

## Constraints
- Keep edits minimal and explicit.
- No broad schema redesign in this batch.
- No app-layer behavior changes outside what is required for schema/RLS correctness.
- Prefer additive, auditable SQL changes over disruptive rewrites.
- If a policy intent is ambiguous, stop and ask before proceeding.

## Required implementation outcomes

1. `companies` isolation (M1)
- Ensure `companies` has RLS enabled.
- Add/select policies so employees cannot enumerate tenants directly.
- Preserve admin access semantics for own tenant context only.

2. `onboarding_tasks` policy coverage (M2)
- Keep RLS enabled.
- Add explicit SELECT/INSERT/UPDATE rules consistent with tenant scoping and role model.
- Prevent cross-tenant reads and writes.

3. `employees` and `employee_profiles` least privilege (M7)
- Enforce self + admin full-read behavior.
- Provide safe tenant-wide employee directory surface (for example, `employees_public`) that excludes sensitive columns.
- Ensure cross-tenant and overbroad same-tenant exposure are blocked.

4. Publication visibility restrictions (M13)
- Confirm `is_published` exists before writing policy logic.
- Restrict `policies` and `procedures` SELECT for non-admins to published records only.
- Keep admin full tenant-scoped visibility.

5. Deterministic tenant fallback (M14)
- Update `current_actor_tenant_id()` fallback query to deterministic ordering.
- Add `ORDER BY created_at` + `LIMIT 1` (or equivalent deterministic tie-break).
- Keep null-safe behavior for unresolved identities.

## Verification requirements (mandatory before done)

Use direct SQL and direct Supabase REST paths. Record results in:

- `docs/launch/verification/rls-verification-checklist.md`
- `docs/launch/verification/security-smoke-test.md` (relevant tests)

Required persona matrix:

- anon
- employee (same tenant, own row)
- employee (same tenant, other row)
- employee (cross-tenant attempt)
- admin (same tenant)
- admin (cross-tenant attempt)

Must include:

- anon access tests
- employee same-tenant tests
- employee cross-tenant tests
- admin cross-tenant tests
- direct REST table access tests
- onboarding_tasks enumeration attempts

Must explicitly verify:

- `companies` direct REST access denied for employee persona
- employee directory projection exposes only safe columns
- `onboarding_tasks` returns only authorized rows per persona
- `policies`/`procedures` non-admin users cannot read unpublished rows

## Commit discipline
- Make small, reviewable commits.
- Verify after each schema change chunk.
- Do not mix unrelated app-layer fixes into this batch.

## Completion criteria
- All five Batch 1 findings above are implemented.
- Verification artifacts are filled with concrete pass/fail evidence.
- Cross-tenant direct REST attempts fail for non-authorized personas.
- No regression to admin own-tenant operational access.
