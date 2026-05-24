# Remediation Phase Gates

This document is the authoritative gate definition for remediation execution.

## Hard Stop Rule

No new feature/domain work is allowed until all of the following are complete:
- Phase 1 exit criteria pass.
- Phase 2 exit criteria pass.
- CI isolation is verified.
- Reliability helpers are proven fail-capable.

Any exception requires a PR title prefix `unfreeze:` and reviewer sign-off.

## Release Qualification Invariant

Any workflow capable of reaching production infrastructure immediately blocks
release qualification.

## Phase Exit Criteria

### Phase 1
- CI uses CI-only database/project credentials.
- Destructive reset guard is active by default.
- Shared schema order is the only migration order source.
- Reliability negative control passes (helper can fail).

### Phase 2
- Employee action redirects verified on success paths.
- Employee onboarding works end-to-end (invite to successful login).
- Audit observability is active with no silent failure paths.

### Phase 3
- CSP report-only baseline reviewed.
- Security hardening controls pass (rate limit + logout protection).

### Phase 4
- Docs/UI claims aligned with measurable behavior.

### Phase 5
- Dormant domains either completed end-to-end or removed from active claims.

## Production Capability Definition

No `release-ready` claim is valid unless all are true:
- CI isolated from production infrastructure.
- Adversarial/negative reliability controls are passing.
- Onboarding works end-to-end in runtime checks.
- Audit failure handling policy is enforced.
- No placeholder throws in active domains.
- CSP is enforced after report-only validation.
- Schema fingerprint artifact is stable and published.
- Rollback path is documented and verified.
