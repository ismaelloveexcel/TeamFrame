# Security Smoke Test Record

This file records the results of manual security verification tests run after the hardening sprint. Each test must be completed and recorded before launch. Tests are run against the production or staging environment, not local dev.

---

## Test 1 — Cross-tenant company enumeration

**Test Method:** Log in as employee of tenant A, query `/rest/v1/companies` via Supabase direct REST with employee JWT and anon key, verify zero rows returned.

| Field | Value |
|-------|-------|
| Expected Result | Zero rows returned |
| Actual Result | |
| Pass/Fail | |
| Date Verified | |
| Tester | |

---

## Test 2 — Direct REST employee table access (employee persona)

**Test Method:** Log in as non-admin employee, query `/rest/v1/employees` via direct REST, verify only safe columns returned via employees_public view.

| Field | Value |
|-------|-------|
| Expected Result | Only safe columns returned via employees_public view |
| Actual Result | |
| Pass/Fail | |
| Date Verified | |
| Tester | |

---

## Test 3 — Direct REST employee table access (admin persona)

**Test Method:** Log in as admin, query `/rest/v1/employees` via direct REST, verify only own-tenant rows returned.

| Field | Value |
|-------|-------|
| Expected Result | Only own-tenant rows returned |
| Actual Result | |
| Pass/Fail | |
| Date Verified | |
| Tester | |

---

## Test 4 — Cross-tenant employee access attempt

**Test Method:** Obtain JWT from tenant A employee, attempt to query tenant B employees via direct REST, verify zero rows.

| Field | Value |
|-------|-------|
| Expected Result | Zero rows returned |
| Actual Result | |
| Pass/Fail | |
| Date Verified | |
| Tester | |

---

## Test 5 — Magic link rate limit

**Test Method:** Send >5 magic link requests from same IP within 15 minutes, verify subsequent requests are rate-limited.

| Field | Value |
|-------|-------|
| Expected Result | Requests beyond limit are rate-limited |
| Actual Result | |
| Pass/Fail | |
| Date Verified | |
| Tester | |

---

## Test 6 — Stale callback session preservation

**Test Method:** Log in successfully, then click an expired magic link, verify existing session is preserved and user is NOT logged out.

| Field | Value |
|-------|-------|
| Expected Result | Existing session preserved; user remains logged in |
| Actual Result | |
| Pass/Fail | |
| Date Verified | |
| Tester | |

---

## Test 7 — CSP and security headers

**Test Method:** Open browser devtools Network tab on any authenticated page, inspect response headers, verify CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy all present.

| Field | Value |
|-------|-------|
| Expected Result | All five headers present |
| Actual Result | |
| Pass/Fail | |
| Date Verified | |
| Tester | |

---

## Test 8 — onboarding_tasks policy coverage

**Test Method:** As non-admin employee, query `/rest/v1/onboarding_tasks` via direct REST, verify only own tasks returned.

| Field | Value |
|-------|-------|
| Expected Result | Only own tasks returned |
| Actual Result | |
| Pass/Fail | |
| Date Verified | |
| Tester | |
