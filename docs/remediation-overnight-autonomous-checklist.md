# Remediation Overnight Autonomous Checklist

Date: 2026-05-24
Mode: Autonomous overnight execution
Scope rule: No feature expansion. Only remediation scope in phase gates.

## Sources Of Truth

- remediation/PHASE-GATES.md
- docs/remediation-status.md

## Global Hard Gates (Must Always Hold)

- [ ] Work from latest `main` only.
- [ ] Keep one active implementation PR at a time.
- [ ] Keep phase scope strict (`phase-2-only`, `phase-3-only`, `phase-4-5-only`).
- [ ] Run independent auditor at each phase boundary.
- [ ] Resolve all PR comments and threads before merge.
- [ ] Required checks must be green before merge.
- [ ] Do not mark any phase complete without evidence links.

## Preflight (Hour 0 to 0.5)

- [ ] `git fetch origin && git checkout main && git pull --ff-only`
- [ ] Confirm clean workspace (`git status --short` shows no tracked edits).
- [ ] Confirm required workflows exist and are enabled:
- [ ] `.github/workflows/ci.yml`
- [ ] `.github/workflows/release.yml`
- [ ] `.github/workflows/remediation-freeze.yml`
- [ ] Reconcile status document with current truth in `docs/remediation-status.md`.
- [ ] Create or refresh requirement traceability section in `docs/remediation-status.md`:
- [ ] Requirement
- [ ] Changed files
- [ ] Test evidence
- [ ] Check links
- [ ] Auditor verdict
- [ ] Merge commit

## Phase 2 (Runtime Correctness)

Branch: `remediation/phase2-runtime-correctness`

### Implement

- [ ] Fix redirect control flow in `app/employees/actions.ts`.
- [ ] Implement invite to login onboarding flow in employee path.
- [ ] Enforce audit observability and no silent failure behavior.

### Validate

- [ ] Add or update tests for successful action redirects.
- [ ] Add or update tests for error redirects.
- [ ] Add or update onboarding end-to-end verification.
- [ ] Add or update audit failure-path verification.
- [ ] Run strict checks locally where possible:
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`

### PR And Review

- [ ] Open phase PR with explicit scope in title/body.
- [ ] Ensure review comments are resolved in one fix wave.
- [ ] Re-run checks and verify all required checks pass.
- [ ] Capture evidence links in `docs/remediation-status.md`.

### Auditor Gate

- [ ] Run independent auditor review for phase scope only.
- [ ] Auditor result must be PASS with no blockers.
- [ ] If FAIL, fix blockers, re-run checks, and re-run auditor once.

### Merge Gate

- [ ] Checks green.
- [ ] Unresolved thread count is zero.
- [ ] Auditor PASS.
- [ ] Evidence updated in status doc.
- [ ] Merge PR.

## Phase 3 (Security Hardening)

Branch: `remediation/phase3-security-hardening`

### Implement

- [ ] Establish CSP report-only baseline with reviewable output.
- [ ] Validate rate limit and logout protection controls.

### Validate

- [ ] Add or update tests or verification scripts for controls.
- [ ] Run required checks and ensure green status.

### PR, Auditor, Merge

- [ ] Open phase PR and keep scope strict.
- [ ] Resolve all comments and review threads.
- [ ] Run independent auditor.
- [ ] Merge only after PASS and green checks.
- [ ] Update `docs/remediation-status.md` with evidence and merge commit.

## Phase 4 And Phase 5 (Claims And Dormant Domains)

Branch: `remediation/phase4-5-claims-domain-cleanup`

### Implement

- [ ] Align docs and UI claims to measurable behavior only.
- [ ] Remove or revise unsupported release-ready claims.
- [ ] For each dormant domain, either complete end-to-end or remove active claim.

### Validate

- [ ] Verify all claims map to current behavior and test evidence.
- [ ] Run required checks and verify green status.

### PR, Auditor, Merge

- [ ] Open combined cleanup PR with explicit scope.
- [ ] Resolve all comments and threads.
- [ ] Run independent auditor and obtain PASS.
- [ ] Merge after all gates pass.
- [ ] Update `docs/remediation-status.md` with final evidence and merge commits.

## End Of Night Exit Checklist

- [ ] Every completed phase has evidence links in `docs/remediation-status.md`.
- [ ] No stale or contradictory statements remain in status docs.
- [ ] All merged PRs have green checks recorded.
- [ ] All merged PRs have zero unresolved review threads.
- [ ] Remaining blockers (if any) are documented with next action and owner.

## Morning Handoff Template

- Completed:
- In progress:
- Blocked:
- PR links:
- Check run links:
- Auditor verdicts:
- Unresolved items and next action:
