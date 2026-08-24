---
document_id: S07-07-BOOTSTRAP-REVIEW-REMEDIATION-01
sprint_id: S07
work_item: S07-07
status: remediated
reviewed_at: 2026-08-24T11:24:44-06:00
scope: scripts/bootstrap-dev-demo-data.ts
---

# S07-07 Bootstrap Review Remediation

## Outcome

A post-implementation source review found two provenance/integrity gaps in the generation-scoped deliverable and notification rollover paths. Both have been remediated directly in `scripts/bootstrap-dev-demo-data.ts`.

No migration, schema/type/RPC/policy/trigger change, provider action, direct database operation, Git operation, or external delivery was performed or is required.

## Review evidence

- `deliverable_cycle_metrics_view` groups audit timestamps by deliverable and derives them with `min(...)`.
- M3 and M5 count review cycles only when the derived `client_acted_at` falls inside their selected time range.
- The generation-scoped deliverable strategy is therefore necessary to produce a fresh metric cycle after the legacy fixed deliverable's audit trail ages outside the 90-day window.
- Candidate audit request IDs are checked using raw row cardinality before a request-ID map is built, so a duplicate database request ID fails closed rather than being concealed by map overwrite.

## Remediated issue: generation fixture lookup was too weak before mutation

### Defect

The new-generation path previously located a matching generation-scoped deliverable by project, title, and specifications, selected only its `id`, then refreshed mutable presentation timestamps.

Those fields are useful provenance anchors but were not a complete ownership/lifecycle contract. A malformed or lookalike row could have the same title/specifications while being assigned to another task or person, having an invalid workflow/status/version, being soft-deleted, or having been created by an unexpected actor. Updating it would violate the bootstrap's provenance-guarded mutation rule.

The existing immutable generation version lookup also accepted any existing version-1 row without validating its immutable identity fields.

### Remediation

The bootstrap now validates an existing generation-scoped deliverable before either reusing it for audit-candidate validation or updating its mutable timestamps. It requires all of:

- expected Sandbox task, project, title, and specifications;
- `workflow_type = "production"`;
- `status = "approved"`;
- Operator A assignment and PM Lead A creator;
- `current_version_number = 1`;
- `deleted_at = null`.

Before accepting an existing generation-scoped immutable version 1, it now validates:

- matching generation deliverable and version number;
- exact deterministic local synthetic HTTPS submission URL;
- `google_drive` provider label;
- exact generation-specific submission note;
- Operator A as submitter.

Any mismatch throws a descriptive `[Bootstrap Error]` and makes no mutation. A missing version remains insert-only. Existing immutable versions are never updated or deleted.

## Remediated issue: notification reuse did not validate complete event coherence

### Defect

The standard in-app candidate checks validated event identity and recipient state, but did not require the immutable event `occurred_at` to match its `created_at` and recipient `created_at`. They also did not validate the expected event payload. The historic candidate similarly ignored `occurred_at`.

A timestamp- or payload-corrupt immutable event could therefore be reused rather than failing closed.

### Remediation

The bootstrap now requires, before standard-pair reuse:

- exact unread and read payload contracts;
- finite event and recipient timestamps;
- each event `created_at` and `occurred_at` to be within one second of each other;
- each event timestamp to be within one second of its expected recipient `created_at`.

Historic-fixture reuse now applies the same finite-timestamp and event `created_at` / `occurred_at` / recipient-time coherence checks. Any mismatch leaves the fixture non-reusable; the exact current historic key remains corruption-checked before insertion.

## Residual conditions and required remediation

No further source remediation is currently required.

The only remaining operational conditions are Project Owner-owned evidence steps:

1. Run `npm run db:bootstrap` against `jsf-pm-dev`.
2. Confirm the bounded Admin/PM metric, Operator A notification-history, historic custom-range, and authorized diagnostics journeys described in the S07-07 runbook.
3. Record actual output and walkthrough evidence before factual Sprint 07 closeout.

If the bootstrap reports an integrity error, preserve the error text and stop. Do not reset data, delete immutable rows, add a migration, or bypass the fail-closed checks.
