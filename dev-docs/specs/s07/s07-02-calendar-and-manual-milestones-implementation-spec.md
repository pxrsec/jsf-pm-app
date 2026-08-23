---
document_id: S07-02-CALENDAR-MILESTONES-IMPLEMENTATION-SPEC-01
sprint_id: S07
work_item: S07-02
status: ready-for-implementation-plan
created_at: 2026-08-23T16:17:43-06:00
source_plan: dev-docs/specs/s07/s07-e09-visibility-reporting-and-operational-administration-demo-completion-sprint-plan.md
mapping_reference: dev-docs/specs/s07/s07-e09-capability-contract-mapping-reference.md
target_environment: jsf-pm-dev
---

# S07-02 — Calendar and Manual Milestones Implementation Specification

## 1. Purpose and delivery statement

S07-02 delivers one localized, authenticated operational calendar for the JSF PM App. It composes deadlines from their authoritative project, task, and deliverable records with non-deleted manual milestones from `calendar_events`. It must not duplicate deadline data into manual-milestone storage, manufacture a client-side calendar authority, or broaden a role's existing data visibility.

The feature is a localhost capability for `jsf-pm-dev`. It does not activate any external provider, create a schedule, add polling, use Realtime, dereference external URLs, or claim hosted/release readiness.

This document is the repository-local execution baseline for S07-02. It supplements the Sprint 07 plan with the post-application state verified on 2026-08-23. It does not revise the product scope, role model, database source of truth, or API authority.

## 2. Authority and precedence

Apply the following order for S07-02 decisions:

1. Direct Project Owner direction.
2. This accepted work-item specification once approved for implementation.
3. The Sprint 07 plan and the S07-01 mapping reference.
4. Applied database contract and untouched MCP-generated `src/lib/database.types.ts`.
5. `AGENTS.md`, `GEMINI.md`, and established repository conventions.
6. General framework guidance.

The older plan and mapping describe M1 as a candidate/unapplied migration. That historical readiness wording is superseded only as to actual application status: live Supabase migration history lists `20260823140000_s07_e09_calendar_role_safe_feed_and_milestones`, Git commit `0f9700d3ff60f084786ba73afc3d677d683f5bd9` records the M1 application/type generation step, and the current generated types contain the four M1 RPCs. Their product and security requirements remain controlling.

No implementation worker may modify migration SQL, apply a migration, access Supabase MCP, regenerate `src/lib/database.types.ts`, read environment values, or repair database state from application code.

## 3. Current implementation baseline

### 3.1 Confirmed prerequisites

The following are ready and must be consumed as existing facts, not recreated:

| Prerequisite | Verified state |
| --- | --- |
| S07 M0 security preparation | Four M0 migrations precede M1 in live migration history. |
| M1 database application | Live history includes the normalized M1 name and current repository migration SQL is unchanged from commit `0f9700d`. |
| Generated database types | `src/lib/database.types.ts` includes `list_role_safe_calendar_events`, `create_calendar_milestone`, `update_calendar_milestone`, and `soft_delete_calendar_milestone`. |
| M2/M3 dependency state | M2 and M3 are also applied and types are current; S07-02 must not consume their archive/metrics/admin contracts. |
| Repository baseline | Working tree was clean when this specification was authored; existing protected-route, server-action, Zod, RTL/Vitest, `next-intl`, and dialog conventions are available. |
| OpenAPI adoption | No S07-02 HTTP endpoint exists or is authorized by this specification. Server actions/RSC query modules are the selected integration boundary. |

### 3.2 Resolved P0: direct `calendar_events` SELECT bypass closed

The original `calendar_events_select_policy` admitted every active authenticated project member through `private.is_project_member(project_id)`. That allowed an Operator or Client project member to bypass the M1 role-safe feed and directly read non-deleted manual milestone data. This was a database authorization defect, not a UI issue.

The approved forward migration `supabase/migrations/20260823143000_s07_e09_scope_calendar_events_direct_select.sql` is now applied to `jsf-pm-dev` and is present in live migration history as `20260823143000_s07_e09_scope_calendar_events_direct_select`.

### 3.3 Verified remediation posture

Live catalog verification confirms:

```text
RLS: enabled on public.calendar_events
Policy: calendar_events_select_policy
Command: SELECT
Role: authenticated
Using: deleted_at IS NULL AND private.is_project_pm(calendar_events.project_id)
Table privileges for authenticated: SELECT=true; INSERT=false; UPDATE=false; DELETE=false
```

`private.is_project_pm(project_id)` is the existing active-membership predicate: it includes Admin and active `pm_lead`/`pm_watcher` membership, and excludes Operator and Client membership. The applied remediation changes no M1 RPC signature, grant, function, table shape, audit rule, color-token rule, view, Realtime publication, provider, scheduler, or generated TypeScript declaration.

Real authenticated role evidence on the applied environment established:

| Caller | Direct `calendar_events` result |
| --- | --- |
| Admin | Authorized; one in-scope manual milestone returned. |
| PM Lead / PM Watcher, active assigned project | Authorized; one in-scope manual milestone returned. |
| PM Lead / PM Watcher, unassigned project | Denied; zero rows returned. |
| Operator, assigned project | Denied; zero rows returned. |
| Client, assigned project | Denied; zero rows returned. |

The migration is source-reviewed and registered; MCP-generated types are an exact byte-for-byte match to the tracked `src/lib/database.types.ts` and therefore remain untouched. The focused migration suite passes four tests, and `npm run typecheck` passes with zero errors.

### 3.4 Resumption gate — satisfied

The direct-read remediation, policy/grant confirmation, generated-type invariance, and real-role negative evidence are complete. S07-02 is ready for implementation planning. The implementation worker must use only the M1 RPCs and must not reopen or alter this applied schema boundary.

## 4. Scope

### 4.1 In scope

1. One role-aware calendar entry route and only authorized project-scoped calendar context.
2. Bounded agenda, month, and week presentation of the M1 role-safe feed.
3. Text/list equivalent for every calendar presentation; the list is a first-class accessible representation, not an afterthought.
4. Range navigation and optional authorized project filtering, all constrained server-side to the M1 maximum of 93 days.
5. Admin and active PM Lead manual-milestone create, edit, and soft-delete flows using M1 RPCs.
6. PM Watcher read-only treatment.
7. Operator and Client safe personal/project context with no management controls and no manual milestones.
8. Spanish canonical protected routes and English `/en/` equivalents with exact semantic message-key parity.
9. Focused static, server/action, component, and live database/RLS evidence.

### 4.2 Explicit non-goals

- No new table, enum, view, materialized view, scheduler, background job, Realtime publication, polling loop, cache, or persistent mutation queue.
- No deadline write, deadline copying, deadline deletion, or manual conversion of a deadline into a milestone.
- No calendar invitation, ICS export/import, recurring milestone, time-zone preference, drag/drop rescheduling, free-text global search, bulk mutation, or calendar sharing.
- No API route under `/api`; no update to OpenAPI during S07-02 because this specification deliberately introduces no actual same-origin HTTP endpoint.
- No project/member/user management, archive, incident, notification queue/history, metric, configuration, provider, deployment, or M2/M3 surface.
- No Client/Operator direct project browser, project roster exposure, manual milestone data, or administrative control.
- No use of raw `calendar_feed_view`, direct `calendar_events` query/mutation from the application, broad `select("*")`, service-role client, Prisma, browser-side authorization, or raw database error rendering.

## 5. Applied M1 contract to consume

### 5.1 Read RPC

The only calendar read boundary is:

```text
list_role_safe_calendar_events(
  p_from timestamptz,
  p_to timestamptz,
  p_project_id uuid default null
)
```

Return only these fields after application normalization:

```text
entity_id: string
project_id: string | null
title: string
event_type: project_deadline | task_deadline | internal_review_deadline |
            client_delivery_deadline | milestone
starts_at: ISO-8601 timestamp
ends_at: ISO-8601 timestamp | null
is_all_day: boolean
color_override: chart-1 | chart-2 | chart-3 | chart-4 | chart-5 | null
```

The MCP-generated function declaration represents several nullable SQL return-table fields as non-null strings. Do not edit generated types. The calendar query adaptor must explicitly normalize `project_id`, `ends_at`, and `color_override` into the nullable application DTO above and treat runtime null as valid contract data.

Inputs are mandatory for every read:

- `p_from` and `p_to` are offset-bearing ISO timestamps.
- `p_from < p_to`.
- `p_to - p_from <= 93 days`.
- Project filter is absent/null for the global role-safe entry or is a UUID selected from an already authorized route context. It is never used as proof of authorization.
- Results are accepted in database order only: `starts_at ASC`, then `event_type ASC`, then `entity_id ASC`. The client must not re-sort by localized label/title in a way that changes deterministic ordering.
- Overlap semantics are inclusive of an event ending at the range start and exclusive of an event starting at range end: `starts_at < p_to AND coalesce(ends_at, starts_at) >= p_from`.

### 5.2 Authoritative event composition

| Event type | Source | Eligibility |
| --- | --- | --- |
| `project_deadline` | `projects.deadline_at` | Admin; active PM project scope; active Client project membership. Never Operator. |
| `task_deadline` | `tasks.deadline_at` | Admin/active PM scope; direct Operator assignment; direct Client `client_request` assignment. |
| `internal_review_deadline` | production `deliverables.internal_review_deadline_at` | Admin/active PM scope only. |
| `client_delivery_deadline` | production `deliverables.client_delivery_deadline_at` | Admin/active PM scope; directly assigned Operator; active Client project membership. |
| `task_deadline` for submission | `client_submission` `deliverables.submission_deadline_at` | Admin/active PM scope; direct Client assignee only. |
| `milestone` | non-deleted `calendar_events` | Admin/active PM scope only; PM Watcher is read-only. Never Operator or Client. |

A source record may yield only its one intended calendar row. The feature must never persist deadline rows to `calendar_events` or render an event twice merely because it is present in a project detail UI and the calendar feed.

### 5.3 Mutation RPCs

```text
create_calendar_milestone(
  p_project_id, p_title, p_description, p_starts_at, p_ends_at,
  p_is_all_day, p_color_override
)

update_calendar_milestone(
  p_event_id, p_title, p_description, p_starts_at, p_ends_at,
  p_is_all_day, p_color_override
)

soft_delete_calendar_milestone(p_event_id)
```

The database owns all authorization, event-type enforcement, actor derivation, audit insert, trimming, and soft deletion. The application must still perform input validation for usable feedback, but client/server validation is not a substitute for the RPC boundary.

Required values and invariants:

| Field | Rule |
| --- | --- |
| `project_id` | UUID. Create only. It is never editable. |
| `title` | Trimmed string, 1–160 characters. |
| `description` | Nullable; trim blank input to `null`; maximum 2,000 characters after trim. Never rendered in the feed/list. |
| `starts_at` | Required valid offset-bearing ISO datetime. |
| `ends_at` | Nullable valid offset-bearing ISO datetime; when supplied it is greater than or equal to `starts_at`. |
| `is_all_day` | Required boolean; default `true` only in the initial form state, never an implicit server-action fallback. |
| `color_override` | `null` or exactly one of `chart-1` through `chart-5`. No hex, CSS variable, arbitrary string, style object, or user-provided class token. |

Authorized mutation is Admin or active PM Lead of the target project. PM Watcher, Operator, and Client must receive no mutation control, and a forged server-action call must return a safe denied result without revealing project/event facts. Updates/deletes must reject a non-milestone event. Delete is a soft delete and returns a boolean/no-op outcome; the UI must not assert successful deletion when it receives `false`.

## 6. Selected application architecture

### 6.1 Integration boundary

Use React Server Components for data-bearing routes; use server-only query and command modules; use narrow client components only for calendar range navigation, filters, form input, dialogs, confirmation, focus restoration, and optimistic/pending presentation. Do not create REST handlers or a public client SDK.

The source of application authorization remains the current authenticated Supabase session and applied M1 RPC. The application may make a coarse role decision to choose navigation or controls, but it must never infer PM Lead capability from `profiles.role = 'pm'`. The database decides active lead/watcher membership for the target project.

### 6.2 Required module responsibilities

Inspect nearby repository files before choosing exact names. The expected separation is:

| Responsibility | Required behavior |
| --- | --- |
| Calendar domain types | Define a narrow DTO/adaptor type distinct from generated database types; include nullable output normalization and finite event/color unions. |
| Calendar schemas | Zod schemas for range/search state and create/update payloads; reject invalid UUIDs, malformed/offsetless datetimes, inverted ranges, >93 days, invalid color tokens, untrimmed-empty title, overlength title/description, and end-before-start. |
| Server query module | Obtain a typed server Supabase client and call only `list_role_safe_calendar_events`; map safe read failures without logging or returning raw RPC messages. |
| Server action module | Use `"use server"`, `cookies`, `requireSession`, Zod, typed Supabase RPC calls, `CommandResult`, safe error mapping, and exact `revalidatePath` targets for all calendar representations after successful mutation. |
| Role/route resolver | Determines route presence and safe destination candidates from session role and current route context. It does not query or expose a global project list merely to populate a calendar filter. |
| Route-local screen | Renders page heading, range controls, presentation controls, first-class list equivalent, empty/error/loading states, and management affordances only when permitted by supplied server state. |
| Milestone dialog leaf | Owns controlled form state, validation presentation, pending state, cancellation, focus restoration, create/edit mode, and delete confirmation. It has no direct Supabase client. |
| Navigation integration | Adds only destinations whose route is implemented and independently authorized. No placeholder or disabled menu item is a navigation destination. |

All production implementation files must remain at or below 400 lines. Split by responsibility rather than compressing types, JSX, or validation into a monolith. `src/lib/database.types.ts` remains untouched.

### 6.3 Route design

Choose exact paths only after checking the protected locale/router conventions. The intended information architecture is:

- A single role-aware canonical calendar route for the caller's permitted feed.
- A project-scoped calendar context only inside an already authorized Admin/PM project workspace or an independently protected project-calendar route.
- Operator and Client calendar links must land only in their safe calendar context. When `project_id` is `null`, no project detail deep link is rendered.
- PM Watcher receives a read-only calendar screen in authorized project scope. Absence of mutation controls is supplementary UX, not access control.

Every deep link is conditional on the current event DTO and a route that independently checks authorization. A route must not turn a calendar `project_id`, `entity_id`, title, or event type into proof that the destination is accessible. If no independently safe destination exists for an event type/role, render non-interactive text instead.

### 6.4 Search state and date behavior

- Canonical default: the current calendar month in the user-visible locale, expressed as explicit offset-bearing start/end boundaries and capped at 31 days.
- Week view: a seven-day range.
- Agenda view: the same bounded selected range, initially the canonical month.
- Previous/next navigation changes only the selected view range; it cannot produce more than a 93-day request.
- Month/week/agenda are presentation modes over exactly the same server feed request for the selected range.
- Invalid URL search parameters normalize to the canonical default range without reflecting raw values or throwing a visible stack; malformed project IDs are ignored/denied as safe route state, never sent as arbitrary RPC input.
- Do not make browser local time the source of date authority. Browser/localized formatting is presentation-only; RPC timestamps remain ISO strings.

## 7. UX, localization, and accessibility requirements

### 7.1 Required states

Every presentation must distinguish these states:

1. Initial loading/skeleton without fake event data.
2. Empty range: no permitted events in the selected dates.
3. Valid populated range.
4. Recoverable query error: generic localized message and retry that repeats only the bounded current range.
5. Invalid user form data: field-specific localized feedback, preserving safe user input.
6. Safe command denial/conflict/not-found: generic localized action feedback; do not reveal whether a foreign event/project exists.
7. Mutation pending and successful refresh state.

### 7.2 Accessibility

- Calendar range/view/change/create/edit/delete controls must be keyboard reachable and have localized accessible names.
- Use semantic headings, landmark/section labels, native buttons/links, labelled form controls, and clear error association.
- Month grid cells must not be a mouse-only target. Keyboard users can use the list equivalent without loss of event information or mutation capability.
- Event type, deadline/milestone meaning, status, and selected range must not rely on color alone. Include localized text/icon with hidden accessible text as needed.
- Color tokens map only to theme-aware design-system styles. Their visual meaning must have a textual equivalent.
- Dialogs must trap focus according to the existing primitive, close on Escape when no mutation is pending, restore focus to the invoking control, and not close accidentally while a destructive request is pending.
- Delete requires a localized confirmation that names the action but does not reveal additional unauthorized data.
- Primary interactive targets meet the existing 44px mobile target expectation where applicable. Validate the 375px journey manually.
- Respect both existing themes and avoid horizontal overflow at 375px.

### 7.3 Localization

Add one coherent `calendar` message namespace to both `messages/es-MX.json` and `messages/en-US.json`, using matching key structure. Include headings, range controls, view names, event type labels, date/list labels, empty/error/retry copy, project-filter labels, read-only explanation, form labels/help/errors, color names, confirmation copy, pending/success states, and accessible names.

Do not hard-code Spanish/English fallbacks in query modules, type adaptors, or command modules. Resolve display text in server/client presentation components with `next-intl`. Preserve localized routing through the repository `@/i18n/routing` link utilities.

## 8. API and contract disposition

### 8.1 No S07-02 HTTP API is authorized

S07-02 uses RSC/server actions over the applied private database RPC contract. It creates no `/api/v1/...` handler. Therefore this work item must **not** add, modify, or claim implementation of the legacy OpenAPI path `GET/POST /api/v1/projects/{project_id}/calendar-events`.

The existing OpenAPI declaration is known stale relative to M1: it has a 180-character title limit, 10,000-character description limit, hex color regex, `starts_at`/`ends_at` naming, and an HTTP project path that does not represent M1's caller-scoped/global feed. It remains deferred contract vocabulary, not an implementation target for this work item.

### 8.2 Required future contract trigger

If a later approved item proposes an actual same-origin HTTP calendar endpoint, it must stop before implementation and revise the OpenAPI contract first. The revised operation must define:

- M1's `from`, `to`, optional `project_id`, and 93-day maximum;
- the eight-field role-safe event DTO with nullable `project_id`, `ends_at`, and `color_override`;
- M1's finite `chart-1` to `chart-5`/null color contract;
- 1–160 title and nullable 2,000-character description validation;
- actor-derived Admin/active-PM-Lead mutation authorization and PM Watcher read-only semantics;
- role-safe composition rather than a raw `calendar_events` resource; and
- safe error semantics with no raw RPC message, project-existence, or authorization-detail disclosure.

No HTTP contract change is needed merely because the app calls a Supabase RPC in server-only code.

## 9. Security requirements

1. After the forward policy remediation, direct browser/PostgREST access to `calendar_events` must not disclose manual milestones to Operator or Client.
2. The application never reads `calendar_feed_view` or uses direct `calendar_events` operations for this feature.
3. Every query/action begins from the authenticated cookie session; every authoritative read/mutation is executed under RLS/authenticated identity, not a service role.
4. Server actions validate untrusted input with Zod before the RPC call and return only the project-standard safe error envelope.
5. Extend safe RPC error mapping for M1-specific authorization, missing/deleted event, malformed range, title/description/date/color validation, and non-milestone mutation failures. The mapping may use stable categories but must never return database text to the browser.
6. Treat `p_project_id`, `p_event_id`, URL search state, client component props, and form values as untrusted. A UUID format match does not prove access.
7. Never return or render milestone description, actor IDs, audit facts, membership details, project roster, raw SQL/database errors, provider/configuration state, or external URL data from this feature.
8. A failed/forged mutation must leave the UI on a safe state and must not optimistically insert, edit, or remove an event.
9. Revalidate the calendar route family and its authorized project context after a successful command. Do not use client-only cache invalidation as truth.
10. No S07-02 request may create notification/provider behavior beyond existing accepted database behavior; no new notification trigger is in scope.

## 10. Essential verification

Keep verification focused on the behavior this work item changes. Database migration, live RLS posture, real-role direct-read isolation, and generated-type invariance are already verified in Section 3; do not recreate that work in the application change set.

### 10.1 Focused automated coverage

Add only focused tests that prove the new application boundary:

1. **Calendar query/action contract:** range validation (including the 93-day limit), exact M1 RPC argument mapping, safe handling of an RPC failure, and cache/path refresh only after a successful mutation.
2. **Milestone controls:** valid create/edit/delete submission, client-side validation for title/date/color limits, pending-state protection, and safe handling of the delete `false`/no-op outcome.
3. **Role-safe UI:** PM Watcher has no management controls; Operator and Client have no management controls or manual-milestone rendering; the list equivalent renders the same permitted events as the selected calendar presentation.

Do not add a broad test matrix, full end-to-end suite, provider fixture, database credential setup, or test solely for implementation detail. Existing application test conventions remain the guide for exact file placement and style.

### 10.2 Essential manual check

Using `Acme Sandbox Campaign` only:

1. As Admin or active PM Lead, create, edit, and soft-delete a milestone; confirm the calendar refreshes.
2. As PM Watcher, confirm permitted calendar visibility and no management controls.
3. As Operator and Client, confirm no manual milestone is rendered and a forged calendar/project input does not disclose another resource.
4. At 375px and keyboard-only, complete the Admin/PM Lead milestone interaction and confirm the list equivalent remains usable.

Record actual outcomes and any limitation. Do not claim provider, hosted, production, or formal accessibility evidence.

## 11. Verification commands

Run only the focused tests added or changed for this work item, plus the checks that compile and lint the changed application:

```bash
npm run test -- <focused-calendar-test-paths>
npm run typecheck
npm run lint
npm run build
```

Do not run a full verification suite merely for ceremony. If one of these commands is blocked by a pre-existing runtime issue, record the exact failure and the focused checks that did run.

`CHANGELOG.md` may be updated with the implemented localhost capability after the change is complete; it must not claim provider activation, deployment, or release readiness.

## 12. Completion criteria

S07-02 may be accepted only when all conditions hold:

1. The forward direct-read RLS remediation is reviewed, committed, applied, type-provenanced, and live-tested; Operator/Client direct manual-milestone reads are denied.
2. Every calendar data read uses `list_role_safe_calendar_events`; every milestone mutation uses its corresponding M1 RPC.
3. Calendar composition is bounded, deterministically ordered, non-duplicated, and source-authoritative.
4. Admin/active PM Lead may manage only authorized-project manual milestones; PM Watcher is read-only; Operator/Client have neither manual-milestone data nor mutation control.
5. Direct DML, raw view/table consumption, browser filtering, and service-role access do not exist in the feature.
6. Routes, deep links, filters, forms, errors, loading/empty/retry states, and mobile/keyboard paths are localized and safe.
7. All new user-facing copy has exact `es-MX`/`en-US` semantic key parity.
8. Database/RLS, server, UI, i18n, accessibility, focused regression, and required manual evidence are factual and recorded.
9. No HTTP calendar endpoint or OpenAPI claim is added under this work item.
10. No external provider, deployment, archive, metrics, administration, or unrelated refactor scope enters the change set.

## 13. Stop conditions and decision handling

| Condition | Required response |
| --- | --- |
| Direct `calendar_events` SELECT cannot be narrowed without breaking a named approved consumer | Stop. Produce catalog evidence and request a bounded authority decision; do not compensate in UI. |
| Live catalog differs from the migration/type assumptions | Stop. Reconcile with a forward migration/type regeneration before application work. |
| A proposed route requires an API handler | Stop and reconcile OpenAPI before implementation; do not silently create the route. |
| Existing role shell/navigation cannot contain a real authorized calendar link without exposing a placeholder | Leave navigation unchanged and report the route-design conflict. |
| A calendar deep link cannot prove destination access independently | Render it as non-interactive text; do not leak/guess a route. |
| A feature request needs recurrence, export, schedule, caching, Realtime, broad table reads, or provider activity | Out of scope. Escalate as a new decision/work item. |
| Direct database/credential access would be required to implement or verify an application behavior | Do not add it. Keep the application on the existing RPC boundary and report the evidence gap. |
| A result is ambiguous between no events, error, forbidden scope, or missing resource | Preserve distinct safe states; do not use an optimistic empty state to conceal a failure. |

## 14. Implementation readiness

The database boundary is applied and verified. This specification is ready to be used directly as the implementation-plan input.

The plan should identify the actual route, module, component, message-catalog, and focused-test files in the current checkout; preserve the RSC/server-action/no-HTTP boundary; and keep the change set within Sections 4–13.

The implemented localhost capability may be added to `CHANGELOG.md` as described in Section 11.
