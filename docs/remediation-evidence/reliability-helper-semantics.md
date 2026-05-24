# Reliability Helper Semantics Evidence

Date: 2026-05-24
PR: https://github.com/ismaelloveexcel/TeamFrame/pull/6

## Scope

This document captures the three critical states from the reliability-helper remediation cycle:

1. Pre-fix false-pass risk (helper structure)
2. Intermediate failure after strict helper fix (real mismatch exposed)
3. Final passing state after semantics aligned to Postgres RLS behavior

## 1) Pre-fix false-pass risk

Affected helpers originally used a throw-inside-try pattern that could swallow the intended failure signal:

- tests/reliability/multi-actor-concurrency-v2.mjs (pre-fix)
- tests/reliability/session-boundaries-v2.mjs (pre-fix)

Risk: an allowed operation could incorrectly be treated as denied if the helper swallowed its own "must fail" throw.

## 2) Intermediate failure after strict helper fix

Run: https://github.com/ismaelloveexcel/TeamFrame/actions/runs/26364135535

Key evidence lines from Gate 6:

- `Multi-actor concurrency...`
- `reliability multi-actor concurrency failed: employee should not update another employee`
- `Reliability suite failed: Multi-actor concurrency failed with exit code 1`

Interpretation: once false-pass behavior was removed, CI exposed a real semantics mismatch in the deny assertion model.

## 3) Final passing state after semantics alignment

Run: https://github.com/ismaelloveexcel/TeamFrame/actions/runs/26364223406

Key evidence lines from Gate 6:

- `reliability multi-actor concurrency passed.`
- `Failure injection and rollback passed.`
- `Session boundary enforcement passed.`
- `Reliability suite passed.`

Final check state on that head:

- Gate Chain (Strict): success
- Freeze Guard: success

## Contract used now

Denial is considered proven when either condition is true:

- SQL operation throws
- SQL operation returns zero affected rows (`rowCount === 0`)

This mirrors practical Postgres RLS denial shapes and prevents false confidence from helper semantics.
