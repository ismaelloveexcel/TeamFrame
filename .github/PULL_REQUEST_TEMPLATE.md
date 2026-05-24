## Objective

One sentence only.

## Hard Stop Compliance

- [ ] This PR does not introduce new feature/domain work.
- [ ] If this is an exception, PR title starts with `unfreeze:` and reviewer approval is documented.

## Phase Gate

- Target phase:
- Exit criterion satisfied:

## Baseline and Verification Evidence

- Baseline artifact (Phase 0 or N/A with reason):
- Verification artifact(s):
- CI run link:

## Rollback Plan

1.
2.
3.

## Release Invariant Check

- [ ] This PR does not introduce or permit any workflow path to production infrastructure from CI.

## Checklist

- [ ] No empty `catch {}` added in `app/`, `lib/`, `middleware/`, `services/`.
- [ ] No silent success path introduced for persistence/audit/redirect/external side effects.
- [ ] `remediation/known-unsafe-surfaces.md` updated if impacted.
