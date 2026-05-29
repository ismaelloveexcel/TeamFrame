# Instrumentation Coverage Matrix

Tracks telemetry coverage for all Server Actions and critical service-layer mutations.

**Columns:**
- **Success log** — `logAction(..., outcome: "ok")` present
- **Failure log** — `logAction(..., outcome: "fail")` present
- **captureActionError** — `captureActionError(...)` called in catch block
- **Status** — `DONE (1A/1B/1C)` = phase completed; `NOT FOUND` = symbol not found in codebase; `N/A` = non-action

---

## Server Actions — `app/employees/actions.ts`

| Action | File:Line | Success log | Failure log | captureActionError | Status | Notes |
|---|---|---|---|---|---|---|
| `createEmployeeAction` | actions.ts:71 / logAction:104,114 | ✅ | ✅ | ✅ | DONE (1C) | Added Phase 1C |
| `updateEmployeeAction` | actions.ts:131 / logAction:173,183 | ✅ | ✅ | ✅ | DONE (1B) | Already instrumented |
| `archiveEmployeeAction` | actions.ts:200 / logAction:236,246 | ✅ | ✅ | ✅ | DONE (1C) | Added Phase 1C; includes `employee_id` in Sentry ctx |
| `reinviteEmployeeAction` | actions.ts:263 / logAction:298,308 | ✅ | ✅ | ✅ | DONE (1C) | Added Phase 1C; includes `employee_id` in Sentry ctx |
| `generateActivationLinkAction` | actions.ts:325 / logAction:362,372 | ✅ | ✅ | ✅ | DONE (1C) | Added Phase 1C; auth-token issuing — Sentry ctx carries `employee_id` |

---

## Server Actions — `app/leaves/actions.ts`

| Action | File:Line | Success log | Failure log | captureActionError | Status | Notes |
|---|---|---|---|---|---|---|
| `submitLeaveAction` | actions.ts:46 / logAction:78,88 | ✅ | ✅ | ✅ | DONE (1C) | Added Phase 1C |
| `decideLeaveAction` | actions.ts:104 / logAction:147,157 | ✅ | ✅ | ✅ | DONE (1B) | Already instrumented |

---

## Server Actions — `app/onboarding/actions.ts`

| Action | File:Line | Success log | Failure log | captureActionError | Status | Notes |
|---|---|---|---|---|---|---|
| `assignOnboardingTaskAction` | actions.ts:29 / logAction:61,71 | ✅ | ✅ | ✅ | DONE (1B) | Already instrumented |
| `completeOnboardingTaskAction` | actions.ts:87 / logAction:116,126 | ✅ | ✅ | ✅ | DONE (1C) | Added Phase 1C |

---

## Service Layer — `services/documentService/index.ts`

| Function | File:Line | Success log | Failure log | captureActionError | Status | Notes |
|---|---|---|---|---|---|---|
| `uploadDocument` | index.ts:~115 / logAction:142,157 | ✅ | ✅ | ✅ | DONE (1C) | Added Phase 1C; no Server Action wrapper — instrumented at service layer |

---

## Service Layer — `services/onboardingService/index.ts`

| Function | File:Line | Success log | Failure log | captureActionError | Status | Notes |
|---|---|---|---|---|---|---|
| `maybeFireActivationCompleted` | index.ts:66 / logAction:79 | N/A | ✅ | ✅ | DONE (1C) | **Bug fix** (Phase 1C). Was silently swallowing DB errors. Non-fatal path: failure logged + captured, execution continues. |

---

## Infrastructure Probe — `app/api/health/route.ts`

| Action | File:Line | Success log | Failure log | captureActionError | Status | Notes |
|---|---|---|---|---|---|---|
| `healthcheck` (ceiling) | route.ts:~135 / logAction:142 | N/A | ✅ | ✅ | DONE (1B) | Ceiling path: all subsystems marked fail |
| `healthcheck` (subsystem fail) | route.ts:~160 / logAction:167 | N/A | ✅ | ✅ | DONE (1B+1C) | Auth subsystem probe added Phase 1C |

---

## NOT FOUND — Symbols searched but not present in codebase

The following symbol names were searched verbatim across the codebase and returned no matches. Per Phase 1C rules, no substitutes were invented.

| Symbol searched | Status | Notes |
|---|---|---|
| `acceptInvite` | NOT FOUND | No Server Action or service function by this name exists |
| `completeOnboardingStep` | NOT FOUND | No match; closest match is `completeOnboardingTaskAction` (instrumented) |
| `requestLeave` | NOT FOUND | No match; closest match is `submitLeaveAction` (instrumented) |
| `approveLeave` | NOT FOUND | No match; closest match is `decideLeaveAction` (instrumented) |
| `rejectLeave` | NOT FOUND | No match; closest match is `decideLeaveAction` (instrumented) |
| `inviteEmployee` | NOT FOUND | No match; closest match is `createEmployeeAction` / `reinviteEmployeeAction` (both instrumented) |
| `terminateEmployee` | NOT FOUND | No match; closest match is `archiveEmployeeAction` (instrumented) |
| `deleteDocument` | NOT FOUND | Soft-delete exists in `documentService` but no exported action by this name |
| `activateEmployee` | NOT FOUND | No match; closest match is `generateActivationLinkAction` (instrumented) |
| `resendInvite` | NOT FOUND | No match; closest match is `reinviteEmployeeAction` (instrumented) |
| `resetPassword` | NOT FOUND | No match; no password-reset flow found in codebase |

---

## Summary

| Category | Total | Instrumented | NOT FOUND |
|---|---|---|---|
| Server Actions (employee) | 5 | 5 | 0 |
| Server Actions (leaves) | 2 | 2 | 0 |
| Server Actions (onboarding) | 2 | 2 | 0 |
| Service layer (document) | 1 | 1 | 0 |
| Service layer (onboarding — bug fix) | 1 | 1 | 0 |
| Infrastructure probes | 1 | 1 | 0 |
| NOT FOUND symbols | 11 | N/A | 11 |

All discovered mutations are instrumented. The 11 NOT FOUND symbols do not exist in the current codebase and require no action.
