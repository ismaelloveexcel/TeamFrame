# Phase 0 — Repro: Employee Onboarding Dead-End

**Finding:** `createEmployeeAction` inserts a row in `employees` but never calls
`supabase.auth.admin.inviteUserByEmail()`. The created employee has no Supabase
Auth record. When they attempt to sign in via magic link, `sendMagicLink` runs
with `shouldCreateUser: false`, the OTP call returns an error (no such user),
the error is suppressed, and the employee receives a silent dead-end at
`/auth/check-email`. They never receive an email. They cannot log in.

**Affected files:**
- `services/employeeService/index.ts` — `createEmployee` function (lines 217–251)
- `app/employees/actions.ts` — `createEmployeeAction` (calls `createEmployee`)

## Code Path Trace

```
Admin fills "Add employee" form → createEmployeeAction()
  → createEmployee(actor, parsed)
      → supabase.from("employees").insert(...)   // ✅ row created
      → writeAudit(...)                          // ✅ audit written
      → return toEmployeeFullRecord(created)     // ✅ returns
  // 🚫 NO supabase.auth.admin.inviteUserByEmail() call anywhere

Employee tries to sign in at /auth
  → sendMagicLink(formData)
      → supabase.auth.signInWithOtp({ email, shouldCreateUser: false })
        // Supabase: no such auth user → returns error silently
      → error is suppressed (intentional anti-enumeration)
      → redirect("/auth/check-email?email=...")
  // Employee sees "Check your email" but receives nothing
  // They are permanently locked out
```

## Reproduction Steps

### 1. Environment requirements
- Dev Supabase project with schemas applied and an admin seeded
- `npm run dev` running

### 2. Steps
1. Sign in as admin
2. Navigate to `/employees`, fill the "Add employee" form, submit
3. Confirm the new employee appears in the list (row exists in DB)
4. Open Supabase Dashboard → Authentication → Users
5. Search for the newly created employee's email

### 3. Expected result
The employee appears in Supabase Auth Users with a pending invite.

### 4. Actual result
The employee does **not** appear in Supabase Auth Users.
The employee's email does not exist in auth.users at all.

### 5. Confirming the login failure
1. Open a private/incognito browser window
2. Go to `http://localhost:3030/auth`
3. Enter the employee's email, click "Send link"
4. Wait 2 minutes
5. Check the email inbox — no email arrives
6. Check Supabase Dashboard → Authentication → Logs
7. Confirm no OTP was sent for this email

## Evidence Capture
- [ ] Screenshot of Supabase Auth Users tab (employee absent)
- [ ] Screenshot of Supabase Auth Logs (no OTP sent)
- [ ] Screenshot of `/employees` page showing the row exists (created in DB)
- [ ] Screenshots saved to `remediation/phase-0/outputs/onboarding-dead-end/`

## Scope of Fix (Phase 2, Task 2)
The fix must cover all four sub-tasks:
1. Call `supabase.auth.admin.inviteUserByEmail(email, { redirectTo })` in `createEmployee`
2. Stamp `app_metadata: { role: "employee", tenant_id: tenantId }` on the invited user
3. Handle idempotency: if the auth user already exists, skip invite gracefully
   (do not fail the create; surface a specific non-crash error code if needed)
4. End-to-end verification: admin creates employee → employee clicks invite email
   → lands on `/dashboard` as `role = "employee"`

Fix PR must link this artifact as baseline evidence.
