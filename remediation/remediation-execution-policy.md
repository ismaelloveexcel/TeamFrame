# TeamFrame Remediation Execution Policy

Status: temporary policy active during remediation program.

## Hard Stop Governance Rule
- No new feature/domain work until:
  - Phase 1 exit criteria pass,
  - Phase 2 exit criteria pass,
  - CI isolation is verified,
  - reliability helpers are proven fail-capable.

## Release Blocker Invariant
- Any workflow capable of reaching production infrastructure immediately blocks release qualification.

## Release Freeze (Mandatory)
- No new domains.
- No new schemas unless directly required by a remediation item.
- No UI expansion unrelated to findings.
- No AI feature expansion.
- No refactors unrelated to findings.

Allowed work only:
- Integrity fixes
- Environment isolation
- Onboarding/runtime repair
- Test correctness
- Truthfulness alignment
- Security hardening scoped to findings

## No Silent Catch Rule
- No empty `catch {}` in remediation changes.
- No swallowed errors in auth, onboarding, audit, storage, CI scripts.
- Every failure path must be either:
  - surfaced as structured log + metric, or
  - propagated as a typed error.

## Rollback and Recovery Rules
- Capture DB backup/export before destructive or schema-affecting remediation.
- Preserve prior CI secret values until isolation is verified.
- Keep previous workflow YAML snapshot for one-cycle rollback.
- Every remediation PR must include explicit rollback steps.

## Runtime Verification Gates
- Phase 1A: prove CI cannot reach production DB.
- Phase 1B: intentionally break an RLS policy in a disposable environment and verify reliability tests fail.
- Phase 2: create employee and complete login end-to-end.
- Phase 3: CSP report-only reviewed, zero critical violations before enforce mode.
- Phase 4: docs and UI claims audited against reachable behavior.
- Phase 5: dormant-domain scan confirms scope alignment.

## Mandatory Negative Test Rule
- Every security-sensitive positive-path test must have at least one intentional failure-path test.
- Minimum required negative controls:
  - broken RLS policy must fail,
  - broken onboarding flow must fail,
  - broken redirect flow must fail,
  - audit insert failure must surface.

## Evidence Retention
- Phase outputs must remain committed for at least one release cycle after the related remediation ships.

## Dormant Domain Policy
A domain is "active" only if all exist:
- schema
- service layer
- reachable UI/API surface
- test coverage
- operational owner

If not active, it must be:
- explicitly marked experimental, or
- removed.

## Truthfulness Rule
No docs/UI may claim:
- audited
- stable
- compliant
- hardened
- green
- production-ready
- operationally complete

unless backed by measurable runtime checks and reproducible evidence.

## No Silent Success
- No operation may report success unless required side effects completed.
- For flows under remediation, success requires:
  - persistence completed,
  - audit completed when required,
  - redirect/navigation completion,
  - external side effects completion.

## Independent Re-Audit
After Phase 3 or 4, require a clean-room re-audit by someone not implementing fixes.
