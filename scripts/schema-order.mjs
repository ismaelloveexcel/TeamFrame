/**
 * Single source of truth for TeamFrame schema apply order.
 */

export const SCHEMA_ORDER = [
  "companies.sql",
  "employees.sql",
  "employee_profiles.sql",
  "compensation.sql",
  "documents.sql",
  "leaves.sql",
  "audit_logs.sql",
  "risk_signals.sql",
  "action_items.sql",
  "analytics_events.sql",
  "onboarding_tasks.sql",
  "policies.sql",
  "procedures.sql",
  "acknowledgements.sql",
  "tenancy_rls.sql",
];
