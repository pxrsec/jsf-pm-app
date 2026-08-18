---
spec_id: S02-E02-01-02
feature_slug: authoritative-data-platform-and-access-controls
sprint: S02
epic: E02
work_items: [S02-E02-01, S02-E02-02]
status: ready-for-owner-directed-execution
version: 1.0
created: 2026-08-18
updated: 2026-08-18
branch: feature/s02-e02-f01-authoritative-data-platform-and-access-controls
risk: critical
sources:
  - contracts/openapi/jsf-pm-api.openapi.yaml
  - C:\Users\ruben\Desktop\jsf-app-dev-project\jsf-project-vault\project-docs\sprint-plans\s02-e02-authoritative-data-platform-and-access-controls-sprint-plan.md
  - C:\Users\ruben\Desktop\jsf-app-dev-project\jsf-documentation\jsf-pm-app-db-schema-stable.md
  - C:\Users\ruben\Desktop\jsf-app-dev-project\jsf-project-vault\updates\adr-020-2026-08-10-supabase-schema-change-operation-decision.md
  - C:\Users\ruben\Desktop\jsf-app-dev-project\jsf-project-vault\updates\wiki-intended-updates\adr-022-2026-08-17-prisma-complete-removal.md
---

# S02 E02 — Authoritative Data Platform and Access Controls

## 1. Execution objective

Complete the repository adoption of the authoritative data-interface contract and establish the complete Supabase/PostgreSQL data and authorization plane defined by Database Schema v1.6. This is a schema-and-policy foundation. It creates no UI, API route handlers, provider activation, external webhook handler, or product workflow screen.

The adopted contract is `contracts/openapi/jsf-pm-api.openapi.yaml`. Its current `info.version` is `1.5.0-beta`; this specification refers to it as the repository-adopted v1.5 contract. Do not create a second OpenAPI source, generated client, Redocly program, or contract-test suite.

## 2. Authority and conflict rule

Precedence is: Direct Project Owner instruction → accepted ADRs → Database Schema v1.6 → repository OpenAPI v1.5 HTTP shape → sprint plan → repository context.

- The schema defines persistence, authorization, RLS, projections, constraints, transaction boundaries, and exact state-machine authority.
- The OpenAPI source defines external HTTP vocabulary, request/response shapes, public error semantics, idempotency headers, and deferred-provider declaration.
- A discrepancy affecting authorization, lifecycle, table shape, or public command behavior is a stop condition. Do not silently “resolve” it in SQL, a route, or this specification.

## 3. Scope

### In scope

1. Treat the repository OpenAPI v1.5 file as the canonical data-interface source for S02.
2. Create the complete forward-only Supabase SQL migration source for the full E2 platform, in the exact dependency order in §5.
3. Establish all listed enums, tables, constraints, triggers, private helpers, RLS policies, constrained RPCs, indexes, security-invoker views, Realtime publication, and non-secret static configuration records.
4. Preserve the contract mapping in §6 when later application routes consume the data plane.
5. Apply the exact reviewed migration to `jsf-pm-dev` only, when the Project Owner performs the approved Supabase MCP operation, which will populate `src/lib/database.types.ts` with the byte-for-byte MCP-generated output.

### Explicitly out of scope

- Next.js API routes, Server Actions, UI components, auth/onboarding pages, application query modules, generated OpenAPI declarations, client SDKs, or contract tooling.
- Supabase Auth tenant configuration, external provider activation, outbound email/WhatsApp, QStash schedules, webhooks, backups, preproduction, production, and deployment changes.

## 4. Non-negotiable implementation boundaries

- `supabase/migrations/` is the only schema and database-policy source. Use append-only SQL; never Prisma, a second ORM, `DATABASE_URL`, dashboard-only DDL, `supabase db push`, direct database access, reset, or manual repair.
- `profiles.role` is the only application-role authority. Never trust Auth `raw_user_meta_data`, browser input, a route parameter, or a claimed actor ID for authorization.
- Every public table has RLS enabled. `anon` receives no application-table privilege. Policies target `authenticated` and use stable helpers scoped through `SELECT`.
- RLS governs rows, not columns. Client and Operator reads use explicit-column `security_invoker = true` views; no client-facing `SELECT *` across mixed-visibility tables.
- Critical state changes occur only in constrained functions. Direct base-table updates must not bypass authorization, lifecycle checks, immutable evidence, or notification fan-out.
- All actor identity comes from `auth.uid()` inside the database boundary. Security-definer helpers live in `private`, set `search_path = pg_catalog, public`, expose no arbitrary SQL inputs, have public execution revoked, and receive only minimum grants.
- URLs are lexical-only: absolute HTTPS, ≤2048 characters, no credentials/control characters/localhost/private-or-reserved IP literals/nonstandard ports; do not resolve, fetch, proxy, preview, scan, or dereference them.
- Only `public.notification_recipients` enters `supabase_realtime` at launch. No other operational table is published.
- `src/lib/database.types.ts` is MCP-generated only; do not hand-author, repair, or regenerate it outside the Project Owner’s controlled MCP operation.

## 5. Required migration design

Create one coherent initial migration for the full platform unless the Project Owner explicitly chooses a reviewed, dependency-safe multi-file sequence. Its name must be an append-only migration filename assigned at creation, such as `<UTC_TIMESTAMP>_s02-e02-authoritative-data-platform.sql`.

### 5.1 Build order

1. Enable `pgcrypto` and `citext`; create and harden `private`.
2. Create all schema enums exactly as specified: roles, project/member/workflow statuses and types, priority, submissions, reviews, notifications, invites, link reports, calendar events, audit entity types, and collaboration capacities.
3. Create independent tables: `profiles`, `clients`, `whatsapp_templates`.
4. Create project tables: `client_contacts`, `projects`, `project_members`.
5. Create work tables: `tasks`, `task_resources`, `deliverables`, `deliverable_versions`, `deliverable_feedback`.
6. Create collaboration tables: `collaboration_comments`, `calendar_events`, `deliverable_link_reports`.
7. Create integration/event tables: `invite_tokens`, `notification_events`, `notification_recipients`, then `audit_logs`.
8. Add checks, foreign keys, unique/partial indexes, update timestamps, deferred membership constraint triggers, denormalized project consistency triggers, and immutable-table protection.
9. Create private authorization helpers, enable RLS, revoke broad access, and add all table policies.
10. Create public constrained RPCs, indexes, security-invoker projections, `notification_recipients` Realtime publication, and non-secret logical WhatsApp template records.

### 5.2 Canonical data model

Implement the full schema-defined inventory, not an MVP subset:

- Identity/CRM: `profiles`, `clients`, `client_contacts`.
- Work ownership: `projects`, `project_members`, `tasks`, `task_resources`.
- Deliverable lifecycle: `deliverables`, immutable `deliverable_versions`, immutable `deliverable_feedback`, `deliverable_link_reports`.
- Internal collaboration and scheduling: `collaboration_comments`, `calendar_events`.
- Invitations, notifications, and operational history: `invite_tokens`, immutable `notification_events`, constrained `notification_recipients`, `whatsapp_templates`, immutable `audit_logs`.

Mutable business records use UUID primary keys, UTC `timestamptz`, audit actor/timestamps where applicable, and soft deletion only where Schema v1.6 allows it. Never soft-delete immutable/security-history records.

### 5.3 Invariants that must be enforced by constraints, deferred triggers, or trusted RPCs

- Client projects require a client; internal projects have no client, no client members, and no deliverables.
- Each active project has one or more active Leads and exactly one active primary Lead. Multiple non-primary Leads, multiple Watchers, and multiple Client members on client projects are valid.
- Membership capacity maps only to the compatible `profiles.role`; one active `(project_id, user_id, member_type)` capacity exists at a time.
- Task and deliverable assignees are active, compatible members of the same project. Deliverables inherit and match `tasks.project_id`, require `has_deliverables`, and client submissions require a client-request parent and direct Client assignee.
- Production and client-submission workflows are distinct. A client submission ends at `submitted`; it cannot create feedback/review artifacts. Production uses the mandatory re-review chain `changes_requested → pending → awaiting_internal_review → awaiting_client_review`.
- Exactly one authoritative feedback decision exists per `(version_id, stage)`. Lock delivery/review rows so the first valid concurrent decision wins and stale competitors fail.
- Project completion remains warning-based but locked and explicit: readiness reports unfinished work; completion requires rechecked `confirm_unfinished`; reopening requires a reason; Admin recovery changes only current state and preserves history.
- Audit logs, notification events, versions, and feedback are append-only. Notification-recipient updates are constrained to trusted lifecycle functions.
- Notification event deduplication and recipient fan-out uniqueness convert retries into safe no-ops.

### 5.4 Required helpers, RPCs, and transactional behavior

Private helpers include current role and active project/member/lead/watcher/operator/client/task-assignee/deliverable-assignee checks. They must return no authority for inactive or deleted profiles.

Public/controlled commands must implement the schema-defined responsibilities:

| Database boundary | Required responsibility | OpenAPI relationship |
|---|---|---|
| `accept_invite` | Hash-only opaque-token redemption; lock pending invitation; bind created Auth user’s normalized email; derive trusted role/project/client; consume once; audit. | `completeInvite` |
| `get_project_completion_readiness`, `transition_project_status`, `recover_project_status` | Authorized lock/recheck, warning-confirmed completion, reopening/recovery with reason, canonical audit and notification evidence. | readiness, `transitionProject`, `recoverProject` |
| Membership/project write boundary | Atomically establish or reconcile valid memberships; retain exactly-one primary Lead. | `createProject`, `replaceProjectMembers` |
| `transition_task_status` | Actor-aware task transitions; direct Client only for their client request; no completion with active pending child submission; audit/notification atomicity. | `transitionTask` |
| `submit_deliverable_version`, `review_deliverable`, `mark_deliverable_delivered` | Lock, validate production lifecycle and actor, insert immutable version/feedback, enforce comments for changes, audit and deduplicated fan-out atomically. | production submit/review/delivery operations |
| `submit_client_deliverable`, `reopen_client_deliverable` | Direct-assignee client submission, lexical URL/provider validation, immutable replacement versions, no review cycle, audited reopen. | client submission/reopen operations |
| `create_collaboration_comment` | Derive trusted author capacity; validate target/project/scope; deny Clients; no lifecycle side effects. | `createComment` |
| Notification claim/completion/read functions | Lease outbound work with `FOR UPDATE SKIP LOCKED`; monotonic provider receipts; caller-owned in-app read state. | notification read operations; processor remains deferred |
| Audited soft-delete/restore functions | Admin-only current-state soft delete/restore while preserving immutable history. | future administrative/internal boundary |

Every state-changing command writes its required audit event and deduplicated notification evidence in its transaction. No function accepts a caller-supplied actor ID or role as authorization input.

### 5.5 Views and grants

Create all views with `security_invoker = true`:

- `operator_agenda_view`: caller’s assigned active tasks/deliverables only.
- `client_project_view`: client-safe project fields only; never `internal_description` or membership enumeration.
- `client_task_view`: only a Client’s direct `client_request` rows and safe resources.
- `client_submission_view`: only a Client’s direct submissions and safe correction history.
- `client_deliverable_view`: production deliverables currently client-released or archived, with client-safe feedback.
- `calendar_feed_view`: derived deadlines plus milestones without persisted duplicate deadline rows.
- `deliverable_cycle_metrics_view`, `notification_unread_counts_view`, and `project_completion_cycles_view`, scoped to authorized PM/Admin callers.

Do not expose internal comments, task resources, internal feedback, audit data, internal project descriptions, other operators, other Clients’ direct assignments, raw provider payloads, credentials, or secret values in any projection.

## 6. Repository contract adoption and interface mapping

S02-E02-01 is satisfied by the existing repository YAML. Do not duplicate its HTTP definitions in SQL. Preserve these mappings for future route implementation:

- Auth/invitation: `createInvite`, `completeInvite`, `requestMagicLink` map to the opaque invitation and existing-account-only magic-link boundaries; this sprint implements only the persistence/RPC prerequisites, not HTTP routes or delivery.
- Projects/members: list/read/create/update/soft-delete/recovery/transition/membership operations map to base tables, safe projections, and constrained project/membership boundaries.
- Tasks/deliverables: command-oriented transition, version, review, delivery, client-submission, and link-report operations map to the relevant trusted RPCs and immutable evidence tables.
- Collaboration/calendar/notifications/metrics: map to explicit views and constrained mutations. Provider processor, alert scheduler, and WhatsApp webhook operations remain documented interfaces only and must not be activated.

For an operation not represented by the OpenAPI source, keep it database-internal and document its consumer boundary in migration comments or the future route implementation. Do not create an undocumented public endpoint.

## 7. Controlled Supabase operation boundary

1. Apply the exact reviewed and committed migration to `jsf-pm-dev` only through Supabase MCP.
2. Generate TypeScript types from that resulting schema through MCP.
3. Replace `src/lib/database.types.ts` with untouched generated output only.

No preproduction or production operation is permitted. A failed/partial application is corrected by a new forward migration, never by dashboard repair, reset, untracked SQL, or a hand-written type file.

## 8. Completion criteria for this specification

This specification is complete when:

- The repository contract remains the single v1.5 OpenAPI source and the data-plane vocabulary is mapped to it or explicitly internal.
- The full migration source embodies every model, invariant, RLS boundary, RPC, projection, index, and Realtime limit described above.
- The implementation does not introduce tests, VSDD-Lite/workflow artifacts, route/UI work, provider activation, Prisma, a second migration mechanism, or a hand-authored database type file.


## 9. Stop conditions

Stop and request a Project Owner decision if an authoritative source conflicts on role/capacity, lifecycle, RLS/column exposure, a public command, a migration requires a destructive repair, or an implementation requires preproduction/production access, provider activation, an undocumented public route, or an external URL fetch.
