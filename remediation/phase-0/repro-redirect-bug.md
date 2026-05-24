# Phase 0 — Repro: Redirect Control-Flow Bug

**Finding:** All three employee server actions call `redirect()` inside `try { }`.
Next.js 15 implements `redirect()` by throwing a `NEXT_REDIRECT` error.
The surrounding `catch` block catches it before Next.js can intercept it,
so success paths land on `?error=NEXT_REDIRECT` instead of `?status=created`.

**Affected files:**
- `app/employees/actions.ts` — `createEmployeeAction`, `updateEmployeeAction`, `archiveEmployeeAction`

## Reproduction Steps

### 1. Environment requirements
- Node 20+, `.env.local` pointing at a dev Supabase project
- At least one admin user seeded via `npm run seed:admin`
- `npm run dev` running on port 3030

### 2. Steps
1. Sign in as admin at `http://localhost:3030/auth`
2. Navigate to `http://localhost:3030/employees`
3. Fill out the "Add employee" form with valid data and click **Create employee**
4. Observe the URL after submission

### 3. Expected result
```
http://localhost:3030/employees?status=created
```
Page shows: "Employee created."

### 4. Actual result
```
http://localhost:3030/employees?error=NEXT_REDIRECT
```
Page shows: "Unexpected error. Please retry."

### 5. Code path trace
```
createEmployeeAction() {
  try {
    await createEmployee(actor, parsed);   // succeeds
    redirect("/employees?status=created"); // throws NEXT_REDIRECT
  } catch (error) {                        // catches NEXT_REDIRECT
    redirect(`/employees?error=${getErrorCode(error)}`);
    // getErrorCode sees error.message = "NEXT_REDIRECT"
    // regex /^[A-Z_]+/ matches "NEXT_REDIRECT"
    // lands on ?error=NEXT_REDIRECT
  }
}
```

### 6. Same failure mode on all three actions
- `updateEmployeeAction` → `?error=NEXT_REDIRECT` instead of `?status=updated`
- `archiveEmployeeAction` → `?error=NEXT_REDIRECT` instead of `?status=archived`

## Evidence Capture
- [ ] Screen recording of reproduction
- [ ] Browser DevTools Network tab screenshot showing final URL
- [ ] Console output (if any) saved to `remediation/phase-0/outputs/redirect-bug-console.txt`

## Fix Location
`app/employees/actions.ts` — Phase 2, Task 1.
Fix PR must link this artifact as baseline evidence.
