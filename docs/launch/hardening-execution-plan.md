# Hardening Execution Plan

Three batched Cursor prompts, executed sequentially. Each batch must be fully verified before the next begins. Do not mix schema changes, app-layer changes, and cleanup in the same commit.

## Batch 1 — Schema and RLS

**Items:** M1, M2, M5 (schema portion), M7, M13, M14

**Verification before proceeding:** Apply migration to dev Supabase. Query each affected table from three personas (anon, employee, admin) and confirm expected row visibility. Verify `employees_public` view returns only safe columns. Verify `companies` table is inaccessible to employee persona via direct REST. Record results in `verification/rls-verification-checklist.md`.

## Batch 2 — App Layer

**Items:** M4, M5 (app portion), M6, M8, M9, M10, M11, M12, M15, M17

**Verification before proceeding:** Run full test suite. Walk the auth callback failure path from a clean browser — verify existing session is preserved. Test employee provisioning for the partial-failure case. Confirm audit log write failures surface in structured logs for sensitive mutations. Record results in `verification/security-smoke-test.md`.

## Batch 3 — Headers, Rate Limit, Cleanup

**Items:** M3, M16, M18, M19

**Verification before proceeding:** Inspect response headers in browser devtools and confirm CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy all present. Test magic link rate limit from two IP addresses. Record results in `verification/security-smoke-test.md`.

## Operational Readiness

**Items:** M20 plus:

- Resend SMTP setup with SPF/DKIM/DMARC
- Test deliverability to Gmail, Outlook, corporate mail domain
- Sentry error monitoring wired
- `/api/health` route added
- BetterStack or Pingdom uptime monitor configured
- Vercel rollback rehearsed (actually do it once)
- `runbooks/support-debugging.md` completed
- `runbooks/secret-rotation.md` completed
- Supabase region confirmed against data residency commitment
- Cold-signup smoke test completed by a non-me user

Record completion in `operational-readiness-checklist.md`.
