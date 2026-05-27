# Support Debugging Runbook

This runbook provides first-line support queries and diagnostic steps for common customer-reported issues. All queries must be run with a tenant_id filter. Do not query across tenants without explicit authorization.

## Customer says they can't log in

_Check auth callback logs, check employee row exists, check auth_user_id linkage, check app_metadata.role._

Steps to complete with real query examples.

## Customer says they can't see an employee

_Check deleted_at, check tenant_id match, check RLS policy._

Steps to complete with real query examples.

## Customer reports incorrect leave status

_Check leaves table directly, check audit_log for decision event._

Steps to complete with real query examples.

## Looking up audit log for a customer

_Query audit_logs with tenant_id filter. Admin-only operation._

Steps to complete with real query examples.

## Checking magic link send history

_Check Supabase Auth logs in dashboard, check Resend delivery logs._

Steps to complete with real query examples.
