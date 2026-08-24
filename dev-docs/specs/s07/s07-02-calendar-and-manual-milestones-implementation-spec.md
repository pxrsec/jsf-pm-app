---
document_id: S07-02-CALENDAR-MILESTONES-IMPLEMENTATION-SPEC-02
sprint_id: S07
work_item: S07-02
status: ready-for-forward-migration-application-and-implementation-plan
created_at: 2026-08-23T16:17:43-06:00
reconciled_at: 2026-08-23T20:00:00-06:00
source_plan: dev-docs/specs/s07/s07-e09-visibility-reporting-and-operational-administration-demo-completion-sprint-plan.md
mapping_reference: dev-docs/specs/s07/s07-e09-capability-contract-mapping-reference.md
target_environment: jsf-pm-dev
---

# S07-02 — Calendar and Manual Milestones Implementation Specification

## 1. Purpose and execution baseline

S07-02 delivers one localized, authenticated operational calendar for `jsf-pm-dev`. It composes authoritative project, task, and deliverable deadlines with non-deleted manual milestones. It never copies a deadline into `calendar_events`, makes browser state an authorization source, activates a provider, adds polling/Realtime/scheduling, or claims hosted/release readiness.

This is the repository-local execution baseline after the Project Owner’s calendar reconciliation. At application implementation time, the following forward migration is assumed **applied to `jsf-pm-dev`**, with MCP-generated database types regenerated and committed unchanged:

```text
supabase/migrations/20260823144000_s07_e09_calendar-task-scoped-milestones-and-pm-authority.sql
```

The migration is append-only and follows applied M1 (`20260823140000`) and its direct-read remediation (`20260823143000`). No implementation worker may modify migration SQL, apply a migration, access Supabase MCP, regenerate `src/lib/database.types.ts`, read environment values, or repair database state from application code.

## 2. Authority and reconciliation record

Apply authority in this order:

1. Direct Project Owner direction.
2. This reconciled S07-02 specification.
3. The reconciled S07 plan and capability-contract mapping reference.
4. Applied database contracts and untouched MCP-generated `src/lib/database.types.ts`.
5. `AGENTS.md`, `GEMINI.md`, and established repository conventions.
6. General framework guidance.

This reconciliation supersedes earlier S07-02 wording only for calendar role scope, task-scoped manual milestones, manager mutation authority, safe calendar display fields, and manager-only form contracts:

- all active Admin and PM application users, including PM Lead and PM Watcher memberships, have calendar-wide read and milestone-management authority;
- Operators see only manual milestones attached to tasks assigned directly to them;
- Clients retain the original safe read-only deadline calendar and never receive manual milestones;
- calendar entries use human-readable project names where authorized; IDs are never display labels;
- manager forms use purpose-limited targets and an edit-detail RPC so descriptions can be safely preserved without entering any feed/list DTO.

The reconciliation does not change broader PM project-directory/workspace authority, archive authority, metrics authority, provider posture, OpenAPI disposition, or non-calendar role policy.

## 3. Applied prerequisites expected by implementation

| Prerequisite | Required state before application implementation |
| --- | --- |
| M0 security preparation | Applied before M1. |
| M1 calendar boundary | Applied: original bounded role-safe feed and milestone commands. |
| Direct read remediation | Applied: original broad direct `calendar_events` read policy closed. |
| M1-R forward reconciliation | Applied: task scope, calendar-wide Admin/PM authority, manager-only form RPCs, project-name DTO, and authenticated base-table SELECT revocation. |
| Generated types | `src/lib/database.types.ts` is regenerated from the applied schema and remains untouched by application workers. |
| M2/M3 | Applied/current but not consumed by S07-02. |

If live schema, generated types, or function signatures differ from this baseline, stop. Reconcile via a reviewed forward migration and regenerated types; do not compensate in UI code.

## 4. Scope

### 4.1 In scope

1. One shared role-aware calendar route at `/calendario`, localized as canonical Spanish and `/en/` English.
2. Month, week, agenda, and first-class accessible list representations of one bounded role-safe feed.
3. Server-side range navigation and optional authorized project filtering, bounded to 93 days.
4. Admin and any active PM user—including PM Lead and PM Watcher—creating, editing, and soft-deleting project-scoped or task-scoped manual milestones.
5. Manager-only project/task target selection and milestone edit detail, without exposing these management contracts to Operator or Client.
6. Operator visibility of only milestones explicitly task-scoped to a directly assigned task.
7. Client read-only safe deadline context; no manual milestones or management controls.
8. Project names where the safe feed authorizes them, with independently authorized deep links only where an existing route is proven safe.
9. Calendar integration in existing Admin/PM project workspaces only through server-fed composition.
10. Focused static, server/action, component, localization, accessibility, and manual localhost evidence.

### 4.2 Explicit non-goals

- No HTTP API route under `/api`, no OpenAPI change, public SDK, CORS work, browser PostgREST access, or API client.
- No new deadline table/column, deadline mutation, deadline duplication, or conversion of a deadline to a milestone.
- No recurrence, invitation, ICS import/export, drag/drop rescheduling, time-zone preference, bulk mutation, global free-text search, sharing, cache, persistent mutation queue, scheduler, polling, Realtime, or provider activity.
- No broadened project workspace, archive, metrics, notification, administration, roster, or identity authority beyond the calendar contracts defined here.
- No direct `calendar_events` table/view read or mutation from application code, no `calendar_feed_view`, no `select("*")`, no service-role client, no Prisma, and no raw database error rendering.

## 5. Reconciled database contract

### 5.1 Task-scoped milestone invariant

`calendar_events` remains the sole manual-milestone table. Each manual milestone has a required `project_id` and an optional `task_id`.

- `task_id IS NULL`: project-scoped milestone.
- `task_id IS NOT NULL`: task-scoped milestone.
- The referenced task must be active and belong to the milestone’s `project_id`.
- The database enforces this relationship on insert and update.
- Existing milestones remain valid project-scoped records.
- Audit facts record scope and task ID where applicable, but never description content.

### 5.2 Read feed

The only general calendar read boundary is:

```text
list_role_safe_calendar_events(
  p_from timestamptz,
  p_to timestamptz,
  p_project_id uuid default null
)
```

Inputs are mandatory except the optional project filter:

- `p_from` and `p_to`: offset-bearing ISO timestamps.
- `p_from < p_to`.
- `p_to - p_from <= 93 days`.
- overlap: `starts_at < p_to AND coalesce(ends_at, starts_at) >= p_from`.
- deterministic order: `starts_at ASC`, `event_type ASC`, `entity_id ASC`.
- `p_project_id` is never authorization proof.

Application-normalized output is exactly:

```ts
export interface CalendarEventDto {
  entity_id: string;
  project_id: string | null;
  project_name: string | null;
  task_id: string | null;
  title: string;
  event_type:
    | "project_deadline"
    | "task_deadline"
    | "internal_review_deadline"
    | "client_delivery_deadline"
    | "milestone";
  starts_at: string;
  ends_at: string | null;
  is_all_day: boolean;
  color_override:
    | "chart-1"
    | "chart-2"
    | "chart-3"
    | "chart-4"
    | "chart-5"
    | null;
}
```

MCP-generated declarations may represent nullable return values as non-null strings. Do not edit them. The server query adapter explicitly normalizes runtime null for `project_id`, `project_name`, `task_id`, `ends_at`, and `color_override`.

### 5.3 Role-safe composition

| Caller | Included feed rows | Explicit exclusions |
| --- | --- | --- |
| Admin | All authorized project/task/deliverable deadlines and all manual milestones | Deleted/out-of-range rows only. |
| PM Lead / PM Watcher | Same calendar-wide feed as Admin | No membership-based calendar restriction. |
| Operator | Directly assigned task deadlines; directly assigned production-deliverable deadlines; task-scoped milestones only where the linked task is directly assigned to caller | Project deadlines, client submissions, internal-review deadlines, project-scoped milestones, and another assignee’s task-scoped milestone. |
| Client | Existing safe project deadlines, direct client-request task deadlines, direct client-submission deadlines, and client-delivery deadlines in active client project scope | Internal-review deadlines, every manual milestone, other clients’ direct work, provider/operations data. |

`project_name` is a display field, not navigation authority. Render project names when supplied. Never render UUIDs as labels. `project_id`, `entity_id`, title, and event type never prove a destination is authorized.

### 5.4 Manager-only form contracts

Only Admin and active PM users may execute:

```text
list_calendar_milestone_targets()
get_calendar_milestone_for_edit(p_event_id uuid)
```

Targets return only `project_id`, `project_name`, optional `task_id`, and optional `task_title`. A null task target represents a project-scoped milestone.

Edit detail returns the current editable milestone—including `description`—only to a manager. Description is never returned from the feed, shown in a general card/grid/list, exposed to Operator/Client, or included in audit facts.

### 5.5 Mutation commands

```text
create_calendar_milestone(
  p_project_id, p_task_id, p_title, p_description,
  p_starts_at, p_ends_at, p_is_all_day, p_color_override
)

update_calendar_milestone(
  p_event_id, p_project_id, p_task_id, p_title, p_description,
  p_starts_at, p_ends_at, p_is_all_day, p_color_override
)

soft_delete_calendar_milestone(p_event_id)
```

The database owns active-profile verification, Admin/PM authority, project/task consistency, event-type enforcement, actor derivation, trimming, audit insert, and soft deletion.

Required values/invariants:

| Field | Rule |
| --- | --- |
| `project_id` | Required UUID; may change during an update only with a matching/null task scope. |
| `task_id` | Optional UUID; when supplied must identify an active task in `project_id`. |
| `title` | Trimmed 1–160 characters. |
| `description` | Nullable; blank becomes `null`; maximum 2,000 trimmed characters. Manager edit detail only. |
| `starts_at` | Required valid offset-bearing ISO datetime. |
| `ends_at` | Nullable valid offset-bearing ISO datetime; not earlier than start. |
| `is_all_day` | Required boolean; initial client form default may be true, but actions have no implicit fallback. |
| `color_override` | Null or exactly `chart-1` through `chart-5`. |

Operator and Client forged command calls receive a generic safe denial. A false delete result is a safe no-op/missing outcome: the UI must not claim deletion, optimistically remove the event, or assert success.

### 5.6 Base-table boundary

Authenticated direct `SELECT` on `calendar_events` is revoked. All authenticated calendar access uses the purpose-limited RPCs. Application code must not restore or rely on direct table access.

## 6. Application architecture

### 6.1 Integration boundary

Use RSC for calendar data-bearing routes. Use server-only query/command modules and narrow client components only for range navigation, dialogs, form state, pending feedback, focus restoration, and locale-preserving URL transitions.

```text
Browser
  -> RSC route / protected server action
  -> typed server-only calendar module
  -> authenticated Supabase RPC under RLS/auth.uid()
```

There is no S07-02 REST handler. Calling a Supabase RPC from server-only code is not an HTTP API implementation and does not require OpenAPI work.

### 6.2 Required modules

Exact filenames must follow nearby repository conventions and remain at or below 400 lines. Expected responsibilities are:

| Responsibility | Required behavior |
| --- | --- |
| Calendar types | Narrow DTOs/finite unions separate from generated types; nullable normalization. |
| Schemas | Search/range/create/update/delete schemas; validate UUIDs, task scope, offset datetimes, range, title/description/color constraints. |
| Server queries | Typed client; feed, manager targets, and edit detail only; no raw SQL error return. |
| Server actions | `"use server"`, cookies, `requireSession`, Zod, typed RPC calls, safe `CommandResult`, and post-success exact revalidation. |
| Safe error mapping | Stable categories only; never browser-visible database text/function names/existence facts. |
| Date utilities | Canonical month/week range, bounded navigation, localized formatting, and deterministic grouping. |
| RSC page | Validates URL state, obtains feed, supplies safe props. |
| Client calendar coordinator | Changes URL state and owns dialogs only; no direct Supabase client and no broad client-side filtering. |
| Milestone dialog leaves | Manager target selection, manager-only edit detail, validation, pending state, confirmation, focus restoration. |

### 6.3 Canonical URL state

`view`, `from`, `to`, and optional `projectId` are canonical calendar state. The RSC page validates and normalizes them before the feed RPC.

- Default is the current localized calendar month, expressed as explicit offset-bearing boundaries and capped at 31 days.
- Week is exactly seven days.
- Agenda/list show the selected bounded range.
- Previous/next changes only URL state and cannot produce a request over 93 days.
- Invalid, offsetless, inverted, oversized, or malformed UUID state normalizes safely to the canonical default without reflecting raw values.
- UI form conversion must transform `datetime-local` values into offset-bearing ISO timestamps before server submission. Browser-local values are presentation/input mechanics, never calendar authorization or durable range authority.

### 6.4 Route and project-workspace design

The canonical route is:

```text
src/app/[locale]/(protected)/calendario/page.tsx
```

It is shared-authenticated for Admin, PM, Operator, and Client. Add `/calendario` to protected and shared-authenticated route prefixes. Do not add it to auth redirect allowlists.

Project workspace calendar context is optional convenience only. Existing workspace shells are client components; their calendar tabs must receive pre-fetched safe server data from an already authorized Admin/PM RSC page or use an independently protected server route. They must never query Supabase from the browser.

### 6.5 UI and deep-link rules

- Render project names, never project IDs.
- Admin links may target only existing Admin project routes.
- PM links may target only existing PM project routes.
- Client links may target only existing independently protected Client project routes.
- Operator events remain non-interactive unless an existing independently authorized task/deliverable route is explicitly proven safe.
- When no safe destination exists, render non-interactive text.
- Month, week, agenda, and list consume the same permitted feed and preserve database ordering. The list is a first-class semantic table/list equivalent.

## 7. UX, accessibility, localization, and security

### 7.1 Required states

Every presentation distinguishes loading without fake data, empty range, populated range, generic recoverable query error, invalid form data, safe denied/conflict/not-found action feedback, pending mutation, and successful refreshed state.

### 7.2 Accessibility

- All range, view, filter, create/edit/delete controls are keyboard reachable with localized accessible names.
- Use semantic headings/landmarks, native controls, associated form errors, status text beyond color, and theme-safe token styles.
- Month grid is not mouse-only; the list equivalent provides all event information and available management actions.
- Existing dialog primitives provide focus trapping, Escape behavior, cancellation, pending protection, and trigger focus restoration.
- Primary interactive targets meet the established 44px mobile expectation where applicable.
- Verify the real 375px keyboard journey manually; do not claim formal accessibility certification.

### 7.3 Localization

Add one coherent `calendar` namespace with exact semantic-key parity in `messages/es-MX.json` and `messages/en-US.json`. Include headings, views, navigation, event types, project/task scope labels, form labels/help/errors, target selection, color names, empty/retry/denial/pending/success states, list headings, confirmation copy, and accessible names.

User-facing text is resolved in presentation components with `next-intl`; query/adaptor/action modules contain no hard-coded Spanish/English display fallback. Use repository locale routing utilities.

### 7.4 Security requirements

1. Every calendar read uses the feed/manager RPC appropriate to its purpose; every mutation uses its corresponding command RPC.
2. The current authenticated cookie session and database authorization are authoritative. UI controls are supplementary only.
3. No direct table/view consumption, service role, broad select, browser filtering, browser Supabase client, or raw error rendering exists in this feature.
4. Feed/list/grid DTOs never return/render descriptions, actor IDs, audit facts, membership data, roster data, or provider/configuration state.
5. Manager edit detail exposes description only to an authenticated Admin/PM manager and only for the exact live milestone requested.
6. UUIDs, URL state, form data, and client props are untrusted. UUID format never proves access.
7. Failed/forged mutation leaves UI safe with no optimistic insertion/edit/deletion.
8. Revalidate calendar and relevant project-context routes only after a successful command.

## 8. API and OpenAPI disposition

No S07-02 HTTP API is authorized. Do not add/modify/claim implementation of legacy `GET/POST /api/v1/projects/{project_id}/calendar-events`, and do not modify OpenAPI.

The existing OpenAPI calendar declaration remains stale/deferred vocabulary. A later approved same-origin HTTP calendar endpoint must stop before implementation, reconcile OpenAPI first, and define the task-scoped model, all-PM calendar authority, client/operator projections, 93-day range, safe DTOs, finite tokens, manager authorization, and non-leaking errors.

## 9. Essential verification

### 9.1 Focused automated evidence

1. Forward migration/static contract: `task_id` same-project/active-task invariant, revised function signatures/grants, base-table direct-read revocation, and generated type shape after application.
2. Server query/action contract: range bound, exact RPC arguments, nullable normalization, safe failures, post-success revalidation, and delete-false behavior.
3. Role projection: Admin/PM Lead/PM Watcher calendar-wide management; Operator direct-task milestone isolation; Client deadline-only/no-milestone isolation.
4. UI: project names rather than UUID labels; all four views equivalent; management controls only for Admin/PM; dialog focus/pending/validation behavior; list semantics.
5. Existing navigation, protected-route, and i18n parity tests updated rather than duplicated.

Do not recreate completed migration/RLS evidence in application tests, add Playwright/E2E/provider fixtures, or broaden the suite for ceremony.

### 9.2 Essential manual evidence

Using `Acme Sandbox Campaign` only:

1. Admin, PM Lead, and PM Watcher each create, edit, and soft-delete project-scoped and task-scoped milestones.
2. Operator sees only milestones tied to a directly assigned task; project-scoped and foreign-task milestones remain absent.
3. Client sees only its safe deadline calendar and no manual milestone.
4. Verify all four views, project-name rendering, safe links/non-links, 375px keyboard flow, themes, Spanish, and English.

Record factual outcomes and limitations. Do not claim hosted/provider/production/formal accessibility evidence.

## 10. Verification commands and completion criteria

After migration application and unchanged type generation, run focused calendar tests plus:

```bash
npm run typecheck
npm run lint
npm run build
```

S07-02 is complete only when:

1. M1-R is reviewed, committed, applied, type-provenanced, and its exact live result recorded.
2. Task-scoped scope integrity and role-safe projections are enforced by the database.
3. All active Admin/PM users manage calendar milestones; Operators receive only directly assigned task-scoped milestones; Clients retain deadline-only read context.
4. Calendar entries show safe human-readable project names and never UUID labels.
5. Feed/list/grid never disclose descriptions; manager edit detail preserves descriptions without broadening access.
6. Calendar URL state, forms, routes, deep links, errors, loading/empty states, localization, keyboard, and mobile behavior are safe and complete.
7. No HTTP route/OpenAPI/provider/unrelated S07 scope enters the change set.

## 11. Stop conditions

| Condition | Required response |
| --- | --- |
| Migration/type/live schema differs from this contract | Stop; reconcile by reviewed forward migration and regenerated types. |
| Task/project integrity cannot be database-enforced | Stop; do not rely on UI validation. |
| A manager detail/target contract would expose data to Operator/Client | Stop; narrow the RPC rather than hiding UI. |
| A deep link cannot prove destination authorization independently | Render text, not a guessed link. |
| A proposal requires REST/OpenAPI, scheduler, Realtime, broad table access, provider activity, or client-side authorization | Out of scope; open a separate decision/work item. |
| A result is ambiguous between empty/error/denied/missing | Preserve distinct safe states; never conceal failure as empty. |

## 12. Implementation readiness

After the named forward migration is applied and types regenerated, this specification is the complete Antigravity implementation-plan input. Antigravity must inspect the current checkout for exact component/test filenames, consume only the applied contracts above, preserve the RSC/server-action/no-HTTP boundary, and keep the change set within this specification.
