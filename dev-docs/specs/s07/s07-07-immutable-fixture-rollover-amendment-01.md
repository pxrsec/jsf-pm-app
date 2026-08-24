---
document_id: S07-07-IMMUTABLE-FIXTURE-ROLLOVER-AMENDMENT-01
sprint_id: S07
work_item: S07-07
status: implementation-plan-correction-required
created_at: 2026-08-24T11:24:44-06:00
amends: dev-docs/specs/s07/s07-07-immutable-fixture-rollover-correction-spec.md
applies_to: S07-07 Immutable Fixture Rollover Correction Implementation Plan
scope: scripts/bootstrap-dev-demo-data.ts and the correction-plan verification wording only
---

# S07-07 — Immutable Fixture Rollover Amendment 01

## 1. Authority and purpose

This amendment corrects six implementation-level ambiguities in the immutable fixture rollover specification and its derived implementation plan. It is authoritative where it conflicts with either document.

It does **not** reopen the completed S07-07 accessibility, locale, runbook, persona-guide, closeout, CHANGELOG, route, or authorization scope. It does not authorize a migration, database schema/type/RPC/policy/trigger change, provider activity, Git operation, deletion, reset, direct SQL, or an immutable-row update.

The follow-up implementation remains limited to `scripts/bootstrap-dev-demo-data.ts` except for a plan/document wording correction. No Project Owner product or architecture decision is needed.

## 2. Correction A — historic fixture generation must use a one-day epoch

### Problem

The prior correction document specified a two-day historic epoch. That granularity is insufficient.

A historic recipient inserted at `now - 92 days` can age beyond 93 days before its two-day epoch changes. At that point no historic fixture qualifies, but the current two-day deterministic event key may already exist. The bootstrap would be unable to insert a replacement key and would leave a demonstrability gap.

### Mandatory replacement

Replace every historic epoch definition with:

```ts
const historicEpoch = Math.floor(now.getTime() / ONE_DAY_MS);
```

Use exactly this historic event key:

```ts
const historicDeduplicationKey = `sandbox_historical_event_92d:${historicEpoch}`;
```

The standard 30-day epoch remains appropriate only as a **candidate identifier** for the standard notification pair and audit generation. It must not be used for historic history rollover.

### Required historic reconciliation algorithm

1. Query existing S07 historic events using the prefix:

   ```text
   sandbox_historical_event_92d:
   ```

2. For each candidate, fetch/associate only the expected recipient:
   - `user_id = opAId`;
   - `channel = 'in_app'`.

3. A reusable historic fixture must have exactly one expected recipient and satisfy all of the following:
   - recipient `created_at >= now - 93 days`;
   - recipient `created_at <= now - 91 days`;
   - event `created_at` and `occurred_at` correspond to the same historic fixture time, with no current event timestamp paired to an old recipient;
   - recipient `delivery_status = 'delivered'`;
   - recipient `read_at` is non-null and is coherent with the fixture's `now - 90 days` intended presentation.

4. If exactly one reusable historic fixture exists, reuse it and insert nothing.
5. If more than one reusable historic fixture exists, throw a descriptive integrity error. Do not choose one and do not insert another.
6. If no reusable historic fixture exists:
   - derive the one-day `historicEpoch` key above;
   - query that exact event key before insertion;
   - if the exact key is absent, insert one immutable event and one recipient at the standard `now - 92 days` / `now - 90 days` offsets;
   - if the exact key exists but lacks the expected recipient or violates the required event/recipient contract, throw a descriptive **partial/corrupt historic generation** error;
   - never update/delete either immutable event or an old historic recipient.

This creates a replacement key no later than the next calendar day after a historic fixture becomes unusable, preventing a 91–93-day demonstration gap.

## 3. Correction B — standard in-app notification candidates must fail closed on partial state

The implementation plan currently says it will determine whether a standard pair is coherent, but it does not define the required action when one event or recipient exists without its pair.

For each of the four candidate standard epochs (`currentBucketEpoch` through `currentBucketEpoch - 3`), validate both expected deduplication keys individually:

```text
task_assigned:sandbox_overdue_task:opA:s07_b${epoch}
deliverable_submitted:sandbox_approved:v1:s07_b${epoch}
```

For each key, the exact expected state is:

| Key | Event contract | Recipient contract |
| --- | --- | --- |
| task-assigned unread | expected Sandbox overdue task entity, `p6Id`, expected trigger/actor/payload relationship | exactly one `opAId` + `in_app` recipient; `delivery_status = 'delivered'`; `read_at = null` |
| deliverable-submitted read | expected Sandbox approved deliverable entity, `p6Id`, expected trigger/actor/payload relationship | exactly one `opAId` + `in_app` recipient; `delivery_status = 'delivered'`; `read_at` non-null |

For every candidate epoch:

1. **No rows for either key** is an absent candidate.
2. **Both complete event/recipient records** may be evaluated for 90-day reuse.
3. Any other state—one event only, one expected event with no recipient, duplicate expected recipients, wrong recipient/user/channel, wrong event identity, wrong delivery/read state, or only one member of the pair—is a partial/corrupt immutable generation.
4. On a partial/corrupt generation, throw a descriptive integrity error identifying the epoch and missing/invalid member. Do not ignore it, insert an additional pair, update the event, or delete anything.

A reusable pair additionally requires both recipient `created_at` values inside the default M4 latest-90-day range. If more than one complete candidate pair is reusable, fail closed as already specified.

## 4. Correction C — suppression reuse requires exact recipient cardinality and identity

Prefix discovery of suppression **events** alone is insufficient. The bootstrap must validate the recipient topology before it updates the mutable suppression timestamp.

For the single discovered suppression event, query recipients and require exactly one recipient matching all of:

```ts
user_id === opAId
channel === "email"
delivery_status === "suppressed"
suppression_reason === "provider_disabled"
attempt_count === 0
next_attempt_at === null
claimed_at === null
claim_token === null
provider_message_id === null
provider_error_code === null
provider_error_message === null
sent_at === null
delivered_at === null
read_at === null
failed_at === null
```

Also validate the event remains attached to the expected Sandbox project/deliverable and uses the S07 suppression-key prefix.

Decision rule:

- zero suppression events: insert exactly one event plus exactly one compliant email recipient;
- one event plus exactly one compliant recipient: reuse the immutable event and update only that known recipient's `suppressed_at` if the presentation timestamp must be refreshed;
- one event with no, multiple, or non-compliant recipients: throw a descriptive partial/corrupt suppression-fixture error;
- more than one suppression event: throw the existing duplicate-fixture error.

Never alter another recipient to make it comply. Never introduce WhatsApp/template coupling.

## 5. Correction D — audit candidate validation requires exact count and request-ID membership

For each candidate epoch, the audit lookup must not accept an arbitrary five-row response merely because its count is five.

Before reusing an audit generation, validate:

1. exactly five returned rows;
2. each returned `request_id` equals one of that epoch's five derived deterministic UUIDs;
3. no expected UUID is missing and no UUID is duplicated;
4. the three deliverable audit rows point to `approvedDeliverableId` and the two project rows point to `p6Id`;
5. all actions, actors, roles, status transitions, and ordering timestamps match the existing S07-07 canonical trail;
6. the review-start timestamp is before the client-action timestamp and project completion is before reopen;
7. the client-action and project-completion rows remain inside the latest-90-day range.

Any count from one through four, a five-row mismatched set, duplicate request ID, missing expected ID, or invalid order is a partial/corrupt candidate. Throw; do not insert a replacement for that candidate epoch.

## 6. Correction E — explicit historic manual verification range

The M4 default inbox is exactly the latest 90 days. A recipient intentionally seeded at 91–93 days is **not** visible in the default view.

Replace the implementation plan's manual verification statement:

> “Verify notification center displays exactly 1 unread notification, 1 read notification, and 1 historic notification (91–93 days old).”

with:

1. In the default latest-90-day inbox, verify exactly one current unread and one current read S07 standard fixture. Do not expect the historic fixture there.
2. Select an explicit complete custom range no larger than 93 days that contains the fixture's recipient `created_at` (for example, a range covering `now - 93 days` through `now - 91 days`).
3. In that explicit bounded range, verify exactly one S07 historic in-app fixture.

This reflects the actual M4 RPC contract, which filters on `notification_recipients.created_at` in a half-open range.

## 7. Correction F — verification scope

For this bootstrap-only correction, Antigravity's required automated check is:

```bash
npm run typecheck
```

`npm run lint` and `npm run format:check` may be omitted from this correction's execution plan. They are not acceptance gates of the amendment and must not be represented as required verification.

The Project Owner remains responsible for the authorized `npm run db:bootstrap` execution and the limited manual evidence. The normal S07 integrated gate remains separate and is governed by the S07-07 closeout sequence.

## 8. Completion condition

The derived implementation plan is execution-ready only when it incorporates every requirement in Sections 2–7 of this amendment. No further Plan revision is required after those exact corrections are applied.
