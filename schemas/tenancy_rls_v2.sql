-- TeamFrame — Tenant isolation fix (V2)
-- Weekend 1 Phase 1A Foundation — applied to STAGING ONLY (not existing project).
-- References: docs/launch/weekend-1-report.md
--
-- PROBLEM: The original current_actor_tenant_id() in tenancy_rls.sql had a COALESCE
-- fallback that looked up tenant_id from the employees table via email if the JWT
-- app_metadata.tenant_id claim was absent. This creates a cross-tenant data-leak risk:
--   1. A session without a valid tenant_id JWT claim could match a row by email
--      in any tenant, potentially resolving to the wrong tenant.
--   2. The fallback is opaque — callers don't know whether RLS is enforced via JWT
--      (correct) or via email lookup (insecure path).
--
-- FIX: current_actor_tenant_id() now reads ONLY from JWT app_metadata.tenant_id.
-- Returns NULL if the claim is absent or empty. NULL causes all tenant-scoped RLS
-- policies to match no rows — access is denied, not leaked.
--
-- ROLLBACK (if needed — see docs/launch/weekend-1-report.md for full plan):
--   -- Restore email fallback:
--   CREATE OR REPLACE FUNCTION current_actor_tenant_id() ...
--   -- Drop unique index:
--   DROP INDEX IF EXISTS employees_tenant_email_active_idx;

-- Redefine current_actor_tenant_id() — JWT-only, no email fallback.
create or replace function current_actor_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  -- Read ONLY from JWT app_metadata.tenant_id.
  -- Returns NULL if claim is absent or empty.
  -- NULL causes tenant_id = current_actor_tenant_id() to evaluate as false
  -- for every row, which blocks all access — no silent fallback to email.
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid;
$$;

comment on function current_actor_tenant_id() is
  'Returns tenant_id from JWT app_metadata.tenant_id only. '
  'Returns NULL if claim is absent — NEVER falls back to email lookup. '
  'Applied in tenancy_rls_v2.sql (Weekend 1 Phase 1A). '
  'See docs/launch/weekend-1-report.md for rollback instructions.';

-- Mark current_actor_email() as audit-logging only.
-- It is still functional but must never be used for tenant resolution.
comment on function current_actor_email() is
  'Returns lower-cased email from JWT. '
  'NEVER used for tenant resolution. Audit logging only. '
  'Tenant context must come from app_metadata.tenant_id exclusively.';

-- Unique index: prevents duplicate active employees per tenant+email.
-- This eliminates any ambiguity the old email-fallback lookup relied upon.
-- Also enforces a clean invariant: one active record per (tenant, email).
create unique index if not exists employees_tenant_email_active_idx
  on employees (tenant_id, lower(email))
  where deleted_at is null;
