# Known Unsafe Surfaces (Temporary Register)

Purpose: track unresolved risk surfaces during remediation so they are not
forgotten or re-labeled as complete.

Status key:
- `OPEN` not remediated
- `MITIGATED` partially remediated, guard in place
- `CLOSED` fully remediated and verified

| Surface | Risk | Status | Phase Owner | Evidence |
|---|---|---|---|---|
| Dormant service domains (`documentService`, `leaveService`) | Behavior/claims drift | OPEN | Phase 5 | docs/PHASE-GATES.md |
| Partial RLS coverage vs service-role paths | False confidence from mismatched enforcement path | OPEN | Phase 1B | remediation negative controls |
| Export behavior parity (`exportEmployeeDocumentsZip`) | Contract mismatch risk | OPEN | Phase 5 | service/domain review |
| Audit guarantees across services | Silent compliance drift risk | MITIGATED | Phase 2/3 | telemetry + enforcement logs |
| CSP report-only period | Header hardening not fully enforced yet | OPEN | Phase 3 | CSP report review |
| Non-adversarial tests in legacy paths | Potential false-green risk | MITIGATED | Phase 1B | reliability negative control workflow |

Update this table in each remediation PR that changes one of these surfaces.
