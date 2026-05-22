# Branch Protection Requirements

Configure repository branch protection so merges are blocked unless CI succeeds.

## Branch: `main`

Set these rules in GitHub branch protection:

- Require a pull request before merging.
- Require at least 1 approving review.
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Do not allow bypassing the above settings.

Required status checks:

- `Gate Chain (Strict)`

## Branch: `develop` (recommended)

Use the same settings as `main` to keep integration quality equivalent to release quality.

## Release tags

Release tags must match `vMAJOR.MINOR.PATCH` and trigger `Release Validation` workflow (`.github/workflows/release.yml`).