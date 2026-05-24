# Phase 0 — Repro: `expectDenied` False-Pass Bug

**Finding:** The `expectDenied` helper in `multi-actor-concurrency-v2.mjs` and
`session-boundaries-v2.mjs` passes unconditionally — whether the SQL was denied
by RLS or not. The test cannot fail. CI Gate 5 (`test:security`) and Gate 6
(`test:reliability`) therefore emit no signal when an RLS policy regresses.

**Affected files:**
- `tests/reliability/multi-actor-concurrency-v2.mjs` — `expectDenied` at lines 36–46
- `tests/reliability/session-boundaries-v2.mjs` — `expectDenied` at lines 36–48

## Root Cause

```js
// multi-actor-concurrency-v2.mjs (current)
async function expectDenied(client, claims, sql, params, message) {
  await client.query("begin");
  try {
    await asActor(client, claims);
    await client.query(sql, params);  // if RLS allows this: succeeds...
    await client.query("rollback");
    throw new Error(message);         // ...throws the "not denied" error...
  } catch {                           // ...which is CAUGHT HERE silently
    await client.query("rollback");
    // returns undefined, test continues, no failure
  }
}
```

The `throw new Error(message)` that is supposed to signal "SQL was not denied"
is inside the same `try` block whose `catch` it falls into. It is immediately
swallowed. The helper returns success regardless of the SQL outcome.

## Reproduction Steps (code-level, no live DB required)

Run this isolated script against any connected Supabase project:

```js
// remediation/phase-0/repro-expect-denied.mjs
// Demonstrates that expectDenied passes when it should fail.
// Replace connectionString with a CI Supabase connection before running.

import pg from "pg";

const connectionString = process.env.SUPABASE_DB_URL;
const { Client } = pg;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function asActor(client, claims) {
  await client.query("reset role");
  await client.query("set role authenticated");
  await client.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify(claims),
  ]);
}

// Current broken implementation
async function expectDenied_BROKEN(client, claims, sql, params, message) {
  await client.query("begin");
  try {
    await asActor(client, claims);
    await client.query(sql, params);
    await client.query("rollback");
    throw new Error(message);
  } catch {
    await client.query("rollback");
  }
}

await client.connect();

// This should FAIL because we're running a SELECT that will succeed
// (we are not actually testing denial of anything meaningful here)
// but the helper will PASS regardless.
console.log("Running expectDenied_BROKEN with a SQL that may or may not be denied...");
await expectDenied_BROKEN(
  client,
  { email: "anyone@test.com", app_metadata: { role: "employee" } },
  "select 1",    // <-- this always succeeds; nothing is denied
  [],
  "SELECT 1 should have been denied but was not",
);
console.log("RESULT: helper returned success (BUG — should have thrown)");

await client.end();
```

### Expected output (after fix)
```
Running expectDenied_BROKEN with a SQL that may or may not be denied...
Error: SELECT 1 should have been denied but was not
```

### Actual output (current broken behavior)
```
Running expectDenied_BROKEN with a SQL that may or may not be denied...
RESULT: helper returned success (BUG — should have thrown)
```

## Evidence Capture
- [ ] Run the repro script and save stdout to `remediation/phase-0/outputs/expect-denied-false-pass.txt`
- [ ] Confirm Gate 6 passes with a deliberately broken RLS policy before fix
- [ ] Confirm Gate 6 fails with the same broken RLS policy after fix (Phase 1B)

## Fix Location
`tests/reliability/multi-actor-concurrency-v2.mjs` and
`tests/reliability/session-boundaries-v2.mjs` — Phase 1B, Task 1.
Fix PR must link this artifact as baseline evidence.
