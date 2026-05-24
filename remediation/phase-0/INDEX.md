# Phase 0 — Evidence Baseline Index

This directory is the mandatory evidence base for all remediation work.
No Phase 1+ PR closes without a link to the relevant artifact here.

## Repro Scripts

| File | Finding | Phase that fixes it |
|---|---|---|
| `repro-redirect-bug.md` | `redirect()` inside `try/catch` breaks all employee mutations | Phase 2, Task 1 |
| `repro-expect-denied-false-pass.md` | `expectDenied` helpers pass unconditionally | Phase 1B, Task 1 |
| `repro-onboarding-dead-end.md` | Created employees cannot sign in | Phase 2, Task 2 |

## Output Captures

Runtime evidence goes in `outputs/`. This folder is tracked in git.
Each capture must record: timestamp, environment (dev/CI), operator, result.

```
outputs/
  redirect-bug-console.txt            # console output from repro
  redirect-bug-network-screenshot.*   # browser DevTools screenshot
  expect-denied-false-pass.txt        # stdout from repro-expect-denied script
  onboarding-dead-end/
    auth-users-absent.*               # Supabase Auth Users tab (employee missing)
    auth-logs-no-otp.*                # Supabase Auth Logs (no OTP sent)
    employees-row-exists.*            # /employees page (row present in DB)
```

## Completion Gate

Phase 0 is complete when:
- [ ] All three repro scripts have been exercised against a live dev environment
- [ ] All output files listed above are committed to `remediation/phase-0/outputs/`
- [ ] Each output file contains: timestamp, env label, operator initials

No Phase 1A work begins until this gate is signed off.

## Evidence Reference Format

PRs reference phase-0 evidence as:
```
Baseline: remediation/phase-0/repro-<slug>.md
Output:   remediation/phase-0/outputs/<filename>
```
