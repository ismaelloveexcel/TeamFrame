# TeamFrame — Signal Rules

**Status:** Draft v1. Authored from founder's HR practitioner experience (UAE + Mauritius).
**Scope:** The three MVP signals from `blueprint-locked.md` §7. Phase 2 signals not included here — author them when their slice begins.
**Audit hook:** Every rule below maps to a `trigger_reason` string. Use these as the canonical machine-readable IDs in code, audit logs, and exports.

---

## Rule format (applies to every signal below)

Each signal definition includes:

- **Trigger reason** — machine-readable id (snake_case, stable across versions)
- **What it detects** — plain language
- **Inputs** — fields/relationships the rule reads
- **Severity transitions** — when it becomes green / yellow / red
- **Recommended action** — the Fix-This action surfaced on the dashboard
- **Resolution** — what makes the signal go away
- **Edge cases** — explicit handling of nulls, missing data, lifecycle states

**Severity convention:**

- **Green** — no signal, dashboard does not show it
- **Yellow** — needs attention soon, not yet a problem
- **Red** — already a problem (legal, compliance, or operational)

**Lifecycle filter (applies to all rules):** signals only generate for persons in `preboarding`, `active`, `on_leave`, or `offboarding` states. Persons in `exited` state generate signals only for incomplete offboarding (see Rule 3). All other signal types suppress for `exited`.

---

## Rule 1 — Missing contract

### Trigger reason
`missing_contract`

### What it detects
A person has an active employment record but no signed contract document on file.

### Inputs
- `Person.id`
- `Employment.start_date`, `Employment.type` (full_time / part_time / contractor / intern)
- `Document` where `subject_person_id = Person.id` AND `document_type = 'contract'` AND `signed_at IS NOT NULL`

### Severity transitions

| Condition | Severity |
|---|---|
| Person in `preboarding`, no signed contract, `start_date` is 7+ days away | Yellow |
| Person in `preboarding`, no signed contract, `start_date` within 7 days | Red |
| Person in `active`, no signed contract, regardless of tenure | Red |
| Person in `active`, has signed contract | Green (no signal) |

**Rationale:** A preboarding employee with a start date next month is a yellow — fixable. A person already working without a signed contract is always red (legal exposure in every jurisdiction TeamFrame supports).

### Recommended action
"Upload signed contract" → opens the document upload modal pre-filtered to `document_type = contract` and scoped to this person.

### Resolution
Signal clears when a `Document` exists with `subject_person_id = Person.id`, `document_type = 'contract'`, `signed_at IS NOT NULL`, AND `signed_at >= Employment.start_date - 60 days` (prevents a stale contract from a prior role accidentally satisfying the rule).

### Edge cases
- **Contractor with statement of work, not employment contract:** treat SoW as `document_type = 'contract'` with a `subtype = 'sow'`. Same rule applies.
- **Multiple employment records (re-hire):** evaluate against the most recent `Employment` record only.
- **Document uploaded but `signed_at` is null:** signal does NOT clear. Surface a sub-action "Mark contract as signed" to capture the signature date.

---

## Rule 2 — Expiring document

### Trigger reason
`expiring_document` (yellow) / `expired_document` (red)

### What it detects
Any document with a known expiry date that is approaching or past its expiry.

### Inputs
- `Document.id`
- `Document.expires_at` (nullable — rule skips if null)
- `Document.document_type` — used to determine warning window
- `Document.subject_person_id` — for routing to the right person
- Today's date

### Severity transitions (warning windows by document type)

| Document type | Yellow window | Red trigger |
|---|---|---|
| Passport | expires within 90 days | expired |
| Emirates ID (UAE) | expires within 60 days | expired |
| UAE work permit / labour card | expires within 60 days | expired |
| UAE residence visa | expires within 60 days | expired |
| EU work permit / residence permit | expires within 90 days | expired |
| Schengen / national visa | expires within 45 days | expired |
| Professional certification | expires within 60 days | expired |
| Right-to-work document (generic) | expires within 60 days | expired |
| Other | expires within 30 days | expired |

**Rationale for windows:**
- 90 days for passports because renewal in UAE/EU typically takes 4–8 weeks and a founder needs lead time to chase.
- 60 days for UAE labour-side documents because MOL renewals require active employee participation and consular-style queues.
- 45 days for Schengen visas because they're often shorter-validity and travel may be imminent.
- These windows come from founder's practitioner experience and should be revised as actual customer feedback arrives.

### Recommended action
- Yellow: "Request renewal from {person_name}" → generates a templated email + logs the request in audit history.
- Red: "Upload renewed {document_type}" → opens upload modal for the document, prefilled.

### Resolution
Signal clears when either:
- A new `Document` of the same `document_type` and same `subject_person_id` is uploaded with a later `expires_at`, OR
- The existing `Document.expires_at` is updated to a future date that exceeds the yellow window.

The original signal is closed (not deleted) and linked to the resolving document for audit trail.

### Edge cases
- **Document with no `expires_at`:** rule does not generate a signal. A separate Phase 2 signal (`missing_expiry_data`) may chase data completeness — out of scope for v1.
- **Person in `exited` state:** suppress the signal. Once they're gone, document expiry is irrelevant unless it's part of an audit trail export.
- **Document expires_at in the past at the moment of upload:** immediate red, but action becomes "Mark as historical / replace" rather than "Request renewal".
- **Multiple documents of the same type (e.g. two passports during a renewal):** signal evaluates against the one with the *latest* `expires_at`. The other is treated as superseded.

---

## Rule 3 — Incomplete offboarding

### Trigger reason
`incomplete_offboarding`

### What it detects
A person in `offboarding` or `exited` state has open items on their offboarding checklist.

### Inputs
- `Person.id`
- `Person.lifecycle_state` ∈ {`offboarding`, `exited`}
- `Employment.end_date`
- Open `ActionItem` records where `subject_person_id = Person.id` AND `category = 'offboarding'` AND `completed_at IS NULL`

### Offboarding checklist (standard items — country pack may add)

These are the default items generated when a person enters `offboarding` state:

1. Final contract / termination letter signed and filed
2. Last working day confirmed in writing
3. All assigned assets returned (or written off with reason)
4. Access revoked from internal systems (manual checklist for v1 — see Phase 2 integrations)
5. Final salary / settlement calculated and shared with finance (uses Finance Handoff Export)
6. End-of-service gratuity calculated (UAE-specific — country pack adds)
7. Exit interview recorded (optional but tracked)
8. Personal documents returned (passport copies, certificates)
9. Reference / experience letter prepared (optional)
10. Final export pack generated (Due Diligence + Audit)

### Severity transitions

| Condition | Severity |
|---|---|
| Person in `offboarding`, all items open, `end_date` is 14+ days away | Yellow |
| Person in `offboarding`, any open item, `end_date` within 14 days | Red |
| Person in `exited` state, any open item, regardless of how long since exit | Red |
| Person in `exited` state, all items complete | Green (no signal); final state |

**Rationale:** Items remaining after exit are the dangerous ones (access not revoked, assets not returned, gratuity not paid). These must stay red until resolved — they are the signals founders most need to see.

### Recommended action
"Open offboarding checklist for {person_name}" → opens the dedicated offboarding view with each open item as a row + Fix-This per item.

### Resolution
Signal clears when all checklist items have `completed_at IS NOT NULL` OR are explicitly marked `skipped` with a written reason captured in audit log.

### Edge cases
- **Person moved back from `offboarding` to `active` (cancelled exit):** signal clears. Open checklist items are archived (not deleted) for audit history.
- **Person in `exited` for more than 90 days with open items:** escalate severity copy ("Exited 90+ days ago with open items — urgent compliance risk") but severity remains red, not a new colour.
- **Items 6 (gratuity) and 4 (access revocation) cannot be auto-completed in v1.** They require manual confirmation. Future Phase 2 integrations may auto-detect access revocation.

---

## Country pack additions (preview — full spec in country pack files)

When the UAE country pack ships, it adds the following rule overrides:

- **Rule 1 (missing contract):** required document types expand to include `mol_contract` (Ministry of Labour contract) for mainland employees.
- **Rule 2 (expiring document):** adds `emirates_id`, `labour_card`, `residence_visa` as required-by-default document types per person. Missing-document is a separate yellow signal (Phase 2: `missing_required_document`).
- **Rule 3 (incomplete offboarding):** adds checklist items: cancellation of work permit, cancellation of residence visa, end-of-service gratuity calculation, final settlement clearance letter.

When the EU country pack ships:

- **Rule 1:** required document types expand by member-state where applicable (e.g. German `Arbeitsvertrag` flag).
- **Rule 2:** adds `right_to_work_proof`, `national_insurance_equivalent` per jurisdiction.
- **Rule 3:** adds notice-period validation against contract type and jurisdiction.

Country packs are authored after Slice 3 ships, per blueprint §15.

---

## Versioning

This file is version `v1.0`. Any change to a rule's severity transitions, warning windows, or resolution logic requires:

1. Bump the rule's threshold version (e.g. `expiring_document_v1` → `expiring_document_v2`)
2. Log the change in this file's changelog
3. Existing open signals continue under their original rule version until resolved (do not retroactively re-evaluate — would confuse customer audit trails)

### Changelog
- **2026-05-30 — v1.0** — Initial draft, three MVP signals, UAE/EU country pack preview.
