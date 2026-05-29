# No-Silent-Failures Audit

**Phase:** 1B — Reliability Foundation  
**Date:** 2025  
**Status:** COMPLETE  
**Scope:** Server actions, service layer, middleware — all files read at HEAD of `phase-1b/reliability`

---

## Methodology

Each server action, service function, and middleware guard was inspected for:
- Catch blocks that swallow errors without any output
- Error paths that reach the user as a redirect code but leave no server-side trace
- Success paths that silently fail at sub-operations (audit log, telemetry writes)
- Functions that throw but whose callers don't propagate or log

`Current visibility` values: `response` | `console` | `audit_logs` | `sentry` | `none`  
`Verdict` values: `OK — intentional silent` | `OK — sufficient visibility` | `GAP — needs instrumentation` | `BUG — swallowed defect`

---

## Audit Table

| File:line | Failure path | Current visibility | Verdict | Recommended action (Weekend 3+) |
|---|---|---|---|---|
| `app/auth/actions.ts:34` | `signInWithOtp` Supabase error | `console` (warn + diagnostic object) | OK — sufficient visibility | — |
| `app/auth/actions.ts:45` | Auth error does NOT expose enum detail to caller (anti-enumeration) | `response` redirect (terse) | OK — intentional silent | — |
| `app/auth/actions.ts:55` | `continueCurrentSessionAction` — `resolveIdentity` throws | `response` redirect on null check | GAP — needs instrumentation | Wire `captureActionError` + `logAction` in Weekend 3 |
| `app/employees/actions.ts:97` | `updateEmployeeAction` failure | `console` + `sentry` (Phase 1B) | OK — sufficient visibility | — |
| `app/employees/actions.ts:50` | `createEmployeeAction` failure | `response` redirect only | GAP — needs instrumentation | Wire logger + captureActionError in Weekend 3 |
| `app/employees/actions.ts:145` | `archiveEmployeeAction` failure | `response` redirect only | GAP — needs instrumentation | Wire logger + captureActionError in Weekend 3 |
| `app/employees/actions.ts:185` | `reinviteEmployeeAction` failure | `response` redirect only | GAP — needs instrumentation | Wire logger + captureActionError in Weekend 3 |
| `app/leaves/actions.ts:55` | `submitLeaveAction` failure | `response` redirect only | GAP — needs instrumentation | Wire logger + captureActionError in Weekend 3 |
| `app/leaves/actions.ts:110` | `decideLeaveAction` failure | `console` + `sentry` (Phase 1B) | OK — sufficient visibility | — |
| `app/onboarding/actions.ts:30` | `assignOnboardingTaskAction` failure | `console` + `sentry` (Phase 1B) | OK — sufficient visibility | — |
| `app/onboarding/actions.ts:70` | `completeOnboardingTaskAction` failure | `response` redirect only | GAP — needs instrumentation | Wire logger + captureActionError in Weekend 3 |
| `services/employeeService/index.ts:~200` | `createEmployee` — `writeAudit` failure | `console` warn (audit_log write fail, non-fatal) | OK — sufficient visibility | Consider promoting to `sentry` for audit reliability |
| `services/documentService/index.ts:87` | `uploadDocument` — storage upload fails → record never created | throw `DOCUMENT_UPLOAD_FAILED` (propagates to action) | OK — sufficient visibility | Action layer currently lacks logger; wire in Weekend 3 |
| `services/documentService/index.ts:103` | `uploadDocument` — DB insert fails → compensating storage delete | throw `DOCUMENT_RECORD_CREATE_FAILED`. Storage remove result is ignored | BUG — swallowed defect | Storage remove result must be checked; log failure if remove also fails |
| `services/leaveService/index.ts:60` | `writeAudit` when `required=false` — DB insert error | `console` error only | GAP — needs instrumentation | Promote to Sentry capture for audit integrity |
| `services/onboardingService/index.ts:54` | `writeAudit` failure | `console` error only | GAP — needs instrumentation | Promote to Sentry capture for audit integrity |
| `services/onboardingService/index.ts:80` | `maybeFireActivationCompleted` — query error swallowed | `none` (data ?? [] falls through) | BUG — swallowed defect | Add console.warn + Sentry capture; activation funnel silently broken |
| `middleware/auth.ts:29` | `requireAuthSession` — `getUser()` network failure | throw `UNAUTHENTICATED` (propagates) | OK — sufficient visibility | — |
| `middleware/rbac.ts:50` | `getActor()` — any exception caught, returns null | `none` (catch {} silences all errors) | GAP — needs instrumentation | Log non-auth errors before returning null |
| `lib/telemetry/track.ts:45` | Insert failure for non-23505 errors | `console` warn only | OK — intentional silent | Documented as approved pattern: telemetry must never break user flows |

---

## Summary by Verdict

| Verdict | Count |
|---|---|
| OK — intentional silent | 2 |
| OK — sufficient visibility | 9 |
| GAP — needs instrumentation | 7 |
| BUG — swallowed defect | 2 |

**Total rows:** 20  
**Weekend 3 candidates:** 9 rows (7 GAP + 2 BUG)

---

## Critical Findings

### BUG-1: `services/documentService/index.ts` — compensating delete result ignored
When a document upload succeeds in storage but the DB insert fails, the service attempts to remove the orphaned storage object. The result of that `remove()` call is not checked. If the remove also fails, a storage object is leaked with no trace in any log or error system.

**Risk:** Storage cost leak + orphaned objects with no audit trail.  
**Weekend 3 action:** Check remove result, log failure with `console.error` + `captureActionError`.

### BUG-2: `services/onboardingService/index.ts` — `maybeFireActivationCompleted` swallows query errors
The function uses `const { data } = await supabase.from(...).select(...)` with no destructuring of `error`. A DB failure silently returns `data = null`, which is treated as "no events fired", so `activation_completed` is never emitted. The activation funnel breaks silently with no log.

**Risk:** Activation metrics are permanently wrong for affected tenants with no observable signal.  
**Weekend 3 action:** Destructure `error`, add `console.warn` + `captureActionError`.

---

## Parking Lot (Weekend 3+)

1. Wire `createEmployeeAction`, `archiveEmployeeAction`, `reinviteEmployeeAction` with `logAction` + `captureActionError`
2. Wire `submitLeaveAction`, `completeOnboardingTaskAction` with `logAction` + `captureActionError`
3. Wire `continueCurrentSessionAction` with observability
4. Fix BUG-1: check compensating storage remove result in `documentService.uploadDocument`
5. Fix BUG-2: destructure and check `error` in `maybeFireActivationCompleted`
6. Promote audit-log write failures in `leaveService` and `onboardingService` to Sentry
7. Log non-auth exceptions in `middleware/rbac.ts:getActor()`
