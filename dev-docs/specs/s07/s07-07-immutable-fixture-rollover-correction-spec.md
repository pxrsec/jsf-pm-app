---
document_id: S07-07-IMMUTABLE-FIXTURE-ROLLOVER-CORRECTION-SPEC-01
sprint_id: S07
work_item: S07-07
status: post-implementation-correction-required
created_at: 2026-08-24T11:24:44-06:00
target_environment: jsf-pm-dev
prerequisite_implementation: S07-07 consolidated-and-refined implementation plan
supersedes: none
scope: scripts/bootstrap-dev-demo-data.ts only, except narrowly justified focused coverage
---

# S07-07 — Immutable Fixture Rollover Correction

## 1. Authority, timing, and assumed baseline

This is a **post-implementation correction specification**. It must be given to Antigravity only after it completes the currently executing S07-07 Consolidated & Refined plan. Assume that plan was implemented exactly as written; do not reopen, revert, or duplicate its completed accessibility, locale, documentation, runbook, closeout, CHANGELOG, route, or authorization work.

This correction exists because the applied schema makes the following rows immutable after insertion:

- `audit_logs`
- `notification_events`
- `deliverable_versions`

The currently executing plan correctly avoids direct updates to these rows, but its unconditional 30-day epoch derivation would create new immutable metric/history rows whenever the calendar bucket changes—even while the previously inserted fixture remains valid. That would duplicate client-review/completion cohorts and notification scenarios inside the same latest-90-day presentation window.

This correction owns only deterministic fixture reuse and rollover in:

- `scripts/bootstrap-dev-demo-data.ts`

No migration, generated type, RPC, policy, trigger, provider, navigation, UI, catalog, runbook, closeout record, CHANGELOG, Git operation, or Supabase MCP operation is authorized.

If the current generated types, applied immutable-mutation triggers, or current bootstrap implementation differ from this document, stop and report the exact mismatch. Do not bypass immutability using direct SQL, trigger disabling, casts, delete/reset behavior, a browser client, or a new migration.

## 2. Non-negotiable fixture lifecycle rules

### 2.1 Mutable rows

Continue provenance-guarded controlled updates only for mutable fixtures already owned by S07-07:

- Sandbox tasks;
- Sandbox deliverables;
- Sandbox calendar milestones;
- Sandbox link incident rows;
- notification recipient rows where this specification explicitly permits an update;
- the pending invitation expiry.

Never mutate a reference/isolation project or a user-created Sandbox row. Existing title/description/specification/reason provenance guards remain mandatory.

### 2.2 Immutable rows

For `audit_logs`, `notification_events`, and `deliverable_versions`:

- never call `.update()` or `.delete()`;
- never call `upsert` where it could attempt an update;
- query first and insert only when no **currently usable complete fixture generation** exists;
- do not create a new immutable generation merely because `bucketEpoch` changed;
- preserve old immutable records. They are audit/history facts, not resettable seed data.

### 2.3 Version rows

The existing S07-07 plan's version rule remains final:

- locate each archive fixture version by `deliverable_id` plus `version_number = 1`;
- insert it only if absent;
- never update its URL, submitter, `created_at`, or `submitted_at`.

Do not bucket or roll over deliverable versions. Version timestamps are not the authority for the S07 client-review metric trail.

## 3. Deterministic fixture identity utilities

Retain the current deterministic UUID helper, but make its output contract explicit:

```ts
function deterministicFixtureUuid(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
```

The helper must return a syntactically valid UUID and must be deterministic for the same seed. It must not use `randomUUID()`.

Keep the existing `bucketEpoch` only as a **candidate generation identifier**, not an instruction to insert on each 30-day rollover:

```ts
const THIRTY_DAYS_MS = 30 * 86400000;
const NINETY_DAYS_MS = 90 * 86400000;
const currentBucketEpoch = Math.floor(now.getTime() / THIRTY_DAYS_MS);
```

When finding a reusable standard immutable generation, inspect at least the current epoch plus the prior three epochs. That covers the current 90-day presentation window even when a fixture was created near an epoch boundary.

## 4. Metric audit generation: reuse before rollover

### 4.1 Fixture generation identity

A complete client-review/project-cycle generation consists of all five deterministic request IDs derived from the **same candidate epoch**:

```ts
s07_audit_approved_sub_${epoch}
s07_audit_approved_start_${epoch}
s07_audit_approved_act_${epoch}
s07_audit_proj_completed_${epoch}
s07_audit_proj_reopened_${epoch}
```

Each continues to use the existing helper for its UUID.

For newly inserted generations only, add these harmless object properties to each `changed_fields` JSON object:

```ts
{
  s07_demo_fixture: "immutable-metrics-rollover",
  s07_fixture_generation: String(epoch),
  // existing action-specific fields remain intact
}
```

The existing M3/M5 views read their established action/status/timestamp fields and tolerate additional object keys. Never alter an existing immutable `changed_fields` value merely to add this marker.

### 4.2 Reuse algorithm

Before inserting any of the five audit records:

1. For epochs `currentBucketEpoch`, `currentBucketEpoch - 1`, `currentBucketEpoch - 2`, and `currentBucketEpoch - 3`, derive all five expected request UUIDs.
2. Query the five rows by their request IDs and validate that each candidate is complete and belongs to the expected Sandbox fixture:
   - exact expected action;
   - expected `entity_type` / `entity_id` / `project_id`;
   - expected actor identity and role;
   - expected status transition;
   - no record is outside its intended fixture relationship.
3. A candidate is reusable only when the approved client-action and project-completion timestamps remain inside the latest 90-day metric range and the five rows form a complete sequence.
4. If exactly one reusable candidate exists, use it. Insert nothing and do not modify it.
5. If no reusable candidate exists, create exactly one new generation using `currentBucketEpoch` and the existing canonical offsets.
6. If more than one reusable candidate is found, stop with a descriptive integrity error. Do not choose arbitrarily and do not create another generation.

### 4.3 Insertion and idempotence

When a new generation is necessary:

- insert all five rows with the exact action/status/actor contracts from the existing S07-07 implementation;
- preserve the approved-client-review sequence and project completion/reopen sequence;
- insert rows only when their exact deterministic `request_id` is absent;
- if a partially present generation is found, stop with a descriptive integrity failure rather than filling a potentially corrupt trail;
- never update or delete an audit row.

This algorithm prevents a 30-day bucket boundary from doubling the latest-90-day M3/M5 cohort counts.

## 5. Notification fixture lifecycle

### 5.1 Standard in-app read/unread pair

The two standard M4 fixtures must remain a coherent pair:

- unread `task_assigned` event and self-owned in-app recipient;
- read `deliverable_submitted` event and self-owned in-app recipient.

Keep the existing deterministic event-key format with its epoch suffix. However, before inserting the current epoch pair:

1. examine the current and prior three epoch candidates;
2. for each event key, validate the expected Sandbox entity/project and exact self-owned recipient (`opAId`, `channel = 'in_app'`);
3. validate that the recipient timestamps remain in the default latest-90-day range and retain the intended read/unread state;
4. reuse exactly one complete valid pair;
5. insert a new pair for `currentBucketEpoch` only if no valid pair exists;
6. stop on duplicate complete candidates rather than creating a third visible pair.

Newly inserted standard events must have coherent `created_at` and `occurred_at`. Their matching recipients must have coherent `created_at`, delivery state, and read state. Notification events are immutable; never update their timestamps or payload.

Do not use an external-recipient event for ordinary M4 inbox proof.

### 5.2 Older 91–93-day history fixture

The historic fixture has a much narrower validity window. A 30-day epoch cannot maintain it.

Use a separate historic generation procedure:

1. Find existing S07 historic events by the dedicated deduplication-key prefix `sandbox_historical_event_92d:` and their self-owned in-app recipient for `opAId`.
2. A historic fixture is reusable only when its recipient `created_at` is at least 91 days and no more than 93 days before captured `now`, and its event `occurred_at` is coherent with that same historic presentation.
3. If exactly one reusable fixture exists, reuse it and insert nothing.
4. If none exists, generate a deterministic historic generation suffix using a two-day epoch:

   ```ts
   const historicEpoch = Math.floor(now.getTime() / (2 * 86400000));
   ```

   Create exactly one new event key:

   ```ts
   sandbox_historical_event_92d:${historicEpoch}
   ```

   Insert its immutable event and matching recipient at `now - 92 days`.
5. If more than one fixture qualifies in the 91–93-day range, stop with an integrity error; do not create another.
6. Never update or delete historic notification events. Do not reset old recipient rows.

The expected historical state is one demonstrable fixture within the selected 91–93-day range. Older immutable records outside the range may remain.

### 5.3 Suppression fixture

Do **not** create a new terminal suppressed external recipient at each standard notification epoch.

The suppressed-state metrics/diagnostic count is not a time-windowed inbox demonstration. Multiple suppressed rows would inflate operational queue counts.

Instead:

1. Search the current bucket and prior known S07 suppression keys for exactly one existing suppression event and its `email` recipient.
2. Validate it is attached to the expected Sandbox deliverable/project and satisfies the full S06 terminal suppression contract.
3. Reuse its immutable notification event indefinitely.
4. Because `notification_recipients` is mutable, update only the known provenance-guarded recipient's `suppressed_at` when a current presentation timestamp is genuinely required. Preserve all terminal values:

   ```ts
   delivery_status: "suppressed",
   suppression_reason: "provider_disabled",
   attempt_count: 0,
   next_attempt_at: null,
   claimed_at: null,
   claim_token: null,
   provider_message_id: null,
   provider_error_code: null,
   provider_error_message: null,
   sent_at: null,
   delivered_at: null,
   read_at: null,
   failed_at: null,
   ```

5. If more than one S07 suppression fixture exists, stop and report the duplicate count. Do not insert another row.

Use `channel = 'email'` only. Do not introduce WhatsApp template coupling.

## 6. Required safety and error behavior

- Use `assertDbSuccess` or the current bootstrap's equivalent after every query/insert/update.
- Use `.maybeSingle()` only for a lookup proven unique by deterministic identity. For prefix/candidate discovery, fetch the bounded candidate set and count/validate it explicitly.
- Treat a partial immutable generation, duplicate current generation, identity mismatch, or unexpected user-created lookalike as a bootstrap integrity error. Fail closed with a descriptive label; do not repair through deletion or broad mutation.
- Do not print raw UUIDs, request IDs, token hashes, provider identifiers, or database IDs in the normal bootstrap summary.
- The current S07 fixture names and safe provenance markers may remain visible in local demonstration data. They are not credentials and must not imply actual external delivery.

## 7. Verification and acceptance

Antigravity may run only narrow checks relevant to the correction:

1. TypeScript compilation after the bootstrap edit:

   ```bash
   npm run typecheck
   ```

2. The existing bootstrap command is executed by the Project Owner against `jsf-pm-dev` after Antigravity finishes:

   ```bash
   npm run db:bootstrap
   ```

3. The Project Owner reruns the limited manual checks affected by this correction:
   - Admin/PM metrics show one intended current client-review/completion/reopen cohort rather than duplicated bucket-boundary cohorts.
   - Operator A notification history has one intended current read fixture and one intended current unread fixture.
   - The selected 91–93-day range contains exactly one current historic fixture.
   - Authorized operations/diagnostics show one suppressed external fixture with truthful inactive-provider wording.

4. Do not write or revise the Sprint 07 closeout record until these actual results exist. If a factual closeout already exists when this correction is applied, amend it only with the actual rerun evidence; never fabricate historical outcomes.

No new migration/schema suite, UI suite, broad navigation suite, or full integrated gate is required solely for this bootstrap correction. The normal final integrated gate remains governed by the S07-07 closeout sequence.

## 8. Completion criteria

This correction is complete only when:

- no bootstrap path attempts an update/delete/upsert against `audit_logs`, `notification_events`, or `deliverable_versions`;
- standard immutable metric and notification fixture generations are reused throughout their valid 90-day presentation period;
- a 30-day epoch change alone cannot create a duplicate current audit or in-app notification cohort;
- the historic fixture rolls over only after it falls outside its 91–93-day usable range;
- the terminal suppression fixture is singular and does not inflate operational counts;
- production/client-submission fixture workflow constraints from the completed S07-07 work remain valid;
- no reference/isolation corpus row is mutated; and
- all evidence reported in documentation/closeout work is factual.
