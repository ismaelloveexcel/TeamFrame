/**
 * Single source of truth for TeamFrame schema apply order.
 *
 * Keep every migration script wired to this list to avoid drift.
 */

export const SCHEMA_ORDER = [
  "companies.sql",
  "employees.sql",
  "employee_profiles.sql",
  "compensation.sql",
  "documents.sql",
  "leaves.sql",
  "company_updates.sql",
  "audit_logs.sql",
  "policies.sql",
  "procedures.sql",
  "acknowledgements.sql",
  "tenancy_rls.sql",
];
