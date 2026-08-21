# S05-02 — Deliver the Operator My Day Agenda and Own-Work Navigation

**Sprint:** S05  
**Work Item:** S05-02  
**Status:** Implementation-ready after the S05-DEC-01 Operator-agenda migration baseline is committed, applied to `jsf-pm-dev`, and its untouched MCP-generated types are committed  
**Last reviewed:** 2026-08-21  
**Spec authority:** `dev-docs/specs/s05/s05-e06-e07-operator-and-client-execution-sprint-plan.md`, Section 6 (S05-02), Sections 4–5, and Section 9; `dev-docs/specs/s05/s05-e06-e07-contract-mapping-reference.md`, Sections 2, 4–7; accepted decision S05-DEC-01.  
**Dependencies:** integrated S04 protected shell and role navigation; S05-01 contract mapping; the approved S05-DEC-01 schema/projection baseline; committed `src/lib/database.types.ts` generated from that applied development migration.  
**Successor boundary:** S05-03 owns canonical Operator task detail and production-version submission. This work item must create no submission form, task-status control, or production lifecycle mutation UI.

---

## 1. Objective

Replace the Operator placeholder with a server-rendered, mobile-first **My Day** experience and browseable own-work navigation.

An authenticated Operator must be able to:

1. open the active localized Operator agenda at `/operador/agenda` (or `/en/operador/agenda`);
2. see only task and deliverable context returned through the authenticated Operator-safe agenda projection;
3. understand the server-derived urgency/category, deadline, current task state, safe project context, and whether the next step is to open the task;
4. browse a project index derived only from that same already-safe returned agenda data at `/operador/proyectos` (and `/en/operador/proyectos`); and
5. open a project-scoped own-task list at `/operador/proyectos/[project-id]` that contains only that Operator’s own returned task rows.

This is a read/navigation slice. It establishes the role-safe presentation path that S05-03 will extend with a canonical task-detail route and constrained production submission. It must not turn the Operator surface into a project workspace, task manager, or PM/Admin substitute.

---

## 2. Scope and hard boundaries

### 2.1 In scope

1. Activate the existing Operator agenda navigation target only when `/operador/agenda` is implemented and usable.
2. Add the localized Operator agenda route, route-local loading/empty/error/not-found treatment where needed, and focused route-local presentation components.
3. Add `src/lib/operator/queries.ts` as the dedicated typed, server-only read boundary for `operator_agenda_view`.
4. Map safe agenda rows into explicit presentation models without using `select("*")`, table reads, browser policy, or client-side joins.
5. Render the cross-project agenda in the database-provided urgency/deadline order and show server-provided urgency categories without recomputing them in JavaScript.
6. Add the Operator own-work project index and project-scoped own-task-list routes. Both derive grouping, deduplication, counts, and summaries solely from the already-authorized agenda rows.
7. Add minimal, local client interaction only if a demonstrated agenda/list filtering need remains after server-rendered grouping. The default implementation is server-rendered and requires no client data cache.
8. Add only the exact bilingual catalog entries needed by this slice, preserving existing catalog namespace and parity conventions.
9. Add focused tests for this slice’s new authorization-preserving data shaping and public navigation/presentation behavior. Do not duplicate database/RLS migration evidence.

### 2.2 Explicitly out of scope

- Creating, modifying, applying, or inspecting a Supabase migration; generating or modifying `src/lib/database.types.ts`; accessing Supabase MCP, dashboard, CLI, credentials, or remote database state.
- Implementing S05-03 task-detail routes, task drawers, resource-link controls, production submission, URL validation, task status transitions, collaboration comments, or any Server Action.
- Querying `tasks`, `deliverables`, `projects`, `project_members`, task resources, comments, feedback, audit, notification, or base tables for an Operator screen.
- PM/Admin project workspace views, project membership enumeration, project administration, assignment changes, task planning, Kanban, task lifecycle controls, archives, calendars, metrics, or notifications.
- Client portal behavior, Client-safe views, Client requests, Client submissions, or production Client review.
- Offline cache, service worker, persistent local agenda data, deferred mutation queues, mutation replay, broad Realtime, polling, or client-side query caching.
- External URL opening, previewing, validation, fetching, proxying, scanning, downloading, hosting, Drive API access, or file upload/storage behavior.
- Provider dispatch, email, WhatsApp, webhooks, schedules, delivery receipts, hosted-environment changes, deployment, or preproduction/production work.
- Playwright, snapshot-only tests, visual-regression infrastructure, a live database suite, a full repository verification run, or an S05 closeout record.
- `CHANGELOG.md` changes. The sprint-closeout item owns the aggregated factual changelog/closeout entry.

### 2.3 Non-negotiable security and truthfulness rules

- `profiles.role` and the authenticated server session are the only application-role authority. A pathname, project ID, task ID, client component, or browser state never grants access.
- `operator_agenda_view` is the only permitted Operator data source for every screen in this item. It is a `security_invoker` view; its underlying RLS remains in force.
- The UI may group, deduplicate, sort only where this spec permits, and format rows it has already received. It must not infer membership, query broad records, or use client-side filtering as an authorization mechanism.
- The browser must not infer, calculate, repair, or override urgency. The database-provided category and deadline representation are authoritative.
- Missing, non-visible, malformed, stale, or forged project/task targets must converge on a generic localized safe absence/denial experience. Do not disclose whether an ID exists, belongs to another Operator, or is hidden by a policy.
- User-visible error and empty-state copy must never expose RLS policy details, database/RPC messages, raw IDs, stack traces, internal project notes, membership facts, or any unreturned source data.
- A displayed Drive/resource value, if any is later introduced by S05-03, remains merely a stored lexical URL. This work item does not establish reachability, provider access, upload, delivery, or file safety.

---

## 3. Mandatory prerequisite and authority reconciliation

### 3.1 S05-DEC-01 is a prerequisite, not UI work

The pre-S05 generated type/view baseline is insufficient for the accepted My Day semantics because it lacks an authoritative `assigned_at` fact and excludes completed items. The Project Owner accepted S05-DEC-01 on 2026-08-21. Before this work item begins implementation, the following narrow schema bundle must already exist as committed source and be reflected by the committed MCP-generated types:

1. `tasks.assigned_at` is non-null, deterministically backfilled, set on creation, and refreshed only when the authoritative assignee changes.
2. The revised `operator_agenda_view` returns `assigned_at` and preserves its `security_invoker`/underlying-RLS boundary.
3. The revised view returns the authenticated Operator’s active rows plus that Operator’s completed rows only through the end of the Operator’s stored local calendar day.
4. Completed retention uses the authenticated Operator’s stored `profiles.timezone` (default `America/Mexico_City`) and database evaluation time. Browser locale, browser timezone, and user device clock do not alter this rule.
5. The view returns authoritative urgency categories: `new`, `normal`, `upcoming`, `urgent`, `overdue`, and `completed`.
6. The migration’s focused database/RLS/query evidence and generated-type provenance are complete under the separately authorized schema workflow.

This work item consumes that result. It must not imitate the missing columns or categories with a browser-derived fallback, query an older view shape, edit generated types, or broaden the schema decision.

### 3.2 Stop before implementation if the prerequisite is absent or inconsistent

Stop S05-02 before writing application code if any of the following is true:

| Discovery | Required response |
| --- | --- |
| The committed generated types do not include the revised agenda view fields needed by Section 4.2. | Stop. Report the exact missing field/type and return to the approved schema prerequisite. Do not add a type assertion, `any`, manual generated-type edit, or fallback table query. |
| The committed migration/view does not expose the accepted completed-retention or urgency semantics. | Stop. Report the exact source discrepancy. Do not calculate them in React/TypeScript. |
| The applied `jsf-pm-dev` baseline and committed migration/generated type provenance disagree. | Stop. The authorized schema owner must resolve the mismatch through the approved forward-only process. |
| The view is no longer a safe `security_invoker`/RLS-respecting Operator boundary. | Stop. Do not replace it with base-table reads or a privileged client. |
| A needed screen field is absent from the safe projection. | Stop the affected surface. Record the exact safe field needed and request a narrowly scoped authoritative decision; do not join an internal table. |

### 3.3 Source precedence for this item

1. Direct Project Owner instruction and accepted S05-DEC-01.
2. Accepted ADRs and the committed, applicable migration/generated-type baseline for database shape, RLS, view columns, RPCs, and enum vocabulary.
3. The repository OpenAPI source for HTTP vocabulary, if an HTTP boundary becomes relevant. No new HTTP boundary is in scope here.
4. The S05 sprint plan for scope, sequencing, acceptance, exclusions, and stop conditions.
5. The S05 contract-mapping reference for the reconciled application read boundary and known implementation gaps.
6. This implementation specification for S05-02 file boundaries, route behavior, presentation, and selected evidence.

If an authoritative source contradicts this specification, stop the affected scope and report the conflict. Do not decide it in a component.

---

## 4. Canonical read model

### 4.1 Required server read boundary

Create a dedicated server-only module:

```text
src/lib/operator/queries.ts
```

It owns typed reads from `operator_agenda_view` and conversion into small explicit models needed by S05-02. It must use the authenticated server Supabase client under the existing `@supabase/ssr` pattern. It must not be imported by a Client Component.

Do not enlarge `getOperatorShellData()` into the agenda query. The current shell helper is intentionally a constrained five-item/summary surface and is not the cross-project agenda, project index, deep-route boundary, or safe detail representation.

### 4.2 Required projection and model boundary

The final exact select list must be derived from the revised committed `Database["public"]["Views"]["operator_agenda_view"]["Row"]` type. It must select only fields actually needed by this item. The intended use is limited to the following safe semantic groups:

| Semantic group | Required use in S05-02 | Notes |
| --- | --- | --- |
| Task identity | task-card key, canonical future task route target, project-list deduplication | Use the projection’s task identity only. Never use it to query an internal detail source. |
| Safe project identity/name | own-work project index, per-project route filter, card context | `project_id` and `project_name` are already safe because they come from the Operator projection. |
| Task title/description/status/priority | agenda and own-task list presentation | Description may be shown only when the projection returns it and the mobile card can do so without overwhelming the primary agenda. Never augment it with internal notes. |
| Task deadline/start/assignment facts | localized deadline/relative context and new-category explanation | `assigned_at` is display context only; it is never used to derive a new urgency category in application code. |
| Deliverable identity/title/workflow/status/version/review-deadline facts | compact assignment context only when a returned row has a linked deliverable | Do not expose a submission CTA, Drive URL, history, internal feedback, or a deliverable detail surface in this item. |
| `urgency_category` | semantic label/icon/order presentation | Accept only the six authoritative values in Section 5.2. Unknown/missing values are a safe implementation stop condition, not a generic client-generated category. |

The query module must expose focused read functions with responsibility-specific names. The expected conceptual API is:

```text
getOperatorAgenda()
getOperatorOwnWorkProjects()
getOperatorOwnWorkProject(projectId)
```

Exact function/type names may follow nearby repository conventions, but responsibilities may not be merged into a generic all-role project query.

### 4.3 Read rules

1. The query itself is authenticated through the existing server client/session boundary. Route pages retain their existing `requireSession` role enforcement for `operator` before rendering data.
2. The view query must request the revised authoritative agenda ordering where the committed view supplies it. If the view does not expose an ordering column/contract, order only by already-returned safe urgency/deadline fields using the exact accepted category ordering in Section 5.3. Never use task creation time, browser time, inferred assignment age, or a new query to produce order.
3. Project grouping and deduplication occur in the server query layer, not in a Client Component. A project card represents only the returned own-work rows with the same safe `project_id`.
4. A returned task may have multiple returned deliverable rows. Agenda and project-task presentation must deduplicate the task while preserving a compact count/list of only that task’s returned safe deliverable summaries. Do not emit duplicate task cards because of a one-to-many deliverable relationship.
5. A project count is the count of distinct returned own task IDs for that project. It is not a project-wide task count and must not be labeled or phrased as one.
6. Per-project reads must constrain the safe view by the requested `project_id` and operate only on rows returned for the authenticated Operator. Do not first query a broad project record to validate ownership.
7. A non-visible or absent project ID returns `null`/empty safe representation to the route. The route renders the generic localized not-found/denial treatment described in Section 7.4.
8. No query in this item may use `select("*")`, a mixed-visibility base table, an admin/service-role client, or an application-side list of other users/projects.

---

## 5. Authoritative urgency, ordering, and display contract

### 5.1 Accepted categories

The revised view must deliver one of these exact values for every returned agenda row:

| Category | Authoritative meaning | Required visible meaning |
| --- | --- | --- |
| `new` | The current Operator is assignee and the authoritative assignment timestamp is less than 24 hours old. | Newly assigned / recent assignment. |
| `normal` | Active assigned work that is neither new, upcoming, urgent, nor overdue. | Normal active work. |
| `upcoming` | Active assigned work due more than 24 and no more than 72 hours from database evaluation time. | Due soon. |
| `urgent` | Active assigned work due within 24 hours and not overdue. | Due within 24 hours. |
| `overdue` | Active assigned work whose deadline is before database evaluation time. | Overdue. |
| `completed` | Completed assigned work still inside the stored-local-day retention window. | Completed today. |

The visible Spanish and English labels may be product-language equivalents, but their semantic key, icon/non-color cue, accessible description, and meaning must correspond exactly to this table.

### 5.2 Presentation rules

- Render a localized textual urgency/status label and a meaningful non-color cue (for example, icon plus accessible description) for every card. Color alone is insufficient.
- Render a localized deadline or completed-state context from the returned timestamp. Do not synthesize a deadline where none is returned.
- Render current task status separately from urgency. `blocked` is a task status; `blocking` is a task priority; neither is an urgency synonym. This item does not introduce task controls for either state.
- The `completed` category must be visually separated as completed-today context while remaining within the same authorized agenda. It must not be treated as an active action queue and must not receive task-transition controls.
- Do not show raw enum identifiers, UTC strings, user IDs, project IDs, assignee IDs, database evaluation time, or a computed “assigned X hours ago” claim unless an existing localized formatter can express it truthfully from the returned safe timestamp.

### 5.3 Ordering

Use the revised view’s authoritative order when that order is part of the committed projection contract. If application ordering is necessary because the view returns only category/deadline facts, use this exact stable order on server-returned rows:

1. `overdue` — nearest/oldest overdue deadline first;
2. `urgent` — nearest deadline first;
3. `upcoming` — nearest deadline first;
4. `new` — most recently assigned first, then nearest deadline;
5. `normal` — nearest deadline first;
6. `completed` — most recently completed first.

Use a deterministic final task-identity tie-breaker only after those safe fields. Do not let the browser timezone, locale sort, task creation date, project name, or a Client Component alter category membership. A UI-only filter may hide/show already-rendered safe categories, but it cannot re-rank across the canonical default ordering or change the category’s meaning.

---

## 6. Route and navigation specification

### 6.1 Route matrix

| Surface | Spanish route | English route | Server gate | Read source | Required result |
| --- | --- | --- | --- | --- | --- |
| Operator role home | `/operador` | `/en/operador` | Existing `requireSession`; `role = operator` | Existing shell summary only | Remains a concise role landing page. It links to real agenda/project routes after they exist; it is not a duplicate agenda system. |
| My Day agenda | `/operador/agenda` | `/en/operador/agenda` | `requireSession`; `role = operator` | `getOperatorAgenda()` over `operator_agenda_view` | Server-rendered cross-project own-work agenda. |
| Own-work project index | `/operador/proyectos` | `/en/operador/proyectos` | Same | `getOperatorOwnWorkProjects()` derived solely from agenda rows | Distinct safe-project cards, each with only own returned-work summary. |
| Per-project own-task list | `/operador/proyectos/[project-id]` | `/en/operador/proyectos/[project-id]` | Same | `getOperatorOwnWorkProject(projectId)` constrained to agenda view | Only the Operator’s own returned tasks in the selected safe project. |
| Canonical task route | `/operador/tareas/[task-id]` | `/en/operador/tareas/[task-id]` | Deferred to S05-03 | Deferred | S05-02 may link only when the target is implemented by the successor item. It must not create a placeholder page or dead task link. |

Spanish remains unprefixed and English remains `/en`-prefixed through existing `next-intl` routing. All internal links introduced or modified by this item must use the locale-aware navigation helpers from `@/i18n/routing`; never build `/en` with string concatenation or browser pathname logic.

### 6.2 Navigation activation

The current shared desktop and mobile navigation already contains the intended Operator target `/operador/agenda`, but S04 intentionally treated it as unavailable. S05-02 must make it a real locale-aware link only after the agenda route exists.

Required behavior:

1. For `operator`, render the existing agenda item as an active locale-aware link to `/operador/agenda` in both `AppNav` and `MobileNavToggle`.
2. The active link must be keyboard-focusable and must not expose `aria-disabled="true"` or `tabIndex={-1}`.
3. Mobile navigation must preserve the existing drawer-close behavior before navigation, exactly as the existing role-home navigation does.
4. Do not activate Client destinations, create a new sidebar/header, add project administration links, change the language switcher, or modify theme controls.
5. Do not retain a second “coming soon” Operator agenda item after activation.

### 6.3 Agenda page

The agenda page is a Server Component and is the default Operator execution entry point.

Required structure:

1. localized page heading and a concise role-safe purpose statement;
2. a server-rendered ordered agenda list of distinct own tasks;
3. each task card/list row shows task title, urgency meaning, task status, safe project name, relevant deadline/completed context, and a compact safe deliverable summary when present;
4. the primary action is only a safe navigation affordance to a real implemented target. Before S05-03 implements the canonical task route, use no task-detail CTA that creates a dead route. A card may remain informational with project navigation as the available browse action.
5. a project-index navigation link to `/operador/proyectos` using the locale-aware helper;
6. route-specific loading, empty, and safe recovery states;
7. no mutation control, no status selector, no submission control, no link preview, no membership or team display, no project-wide count, and no broad “view project” workspace action.

Do not add a client-side data cache. Do not load agenda data inside `useEffect`, a browser query client, or a hydrated store.

### 6.4 Own-work project index

The project index is a Server Component backed exclusively by `getOperatorOwnWorkProjects()`.

Each card may show only:

- safe `project_name`;
- a localized count/summary explicitly phrased as the Operator’s own returned work (for example, “Your assigned tasks” rather than “Project tasks”);
- a compact returned-work category/deadline summary when it can be derived from those own rows without exposing project-wide data; and
- the locale-aware link to the per-project own-task list.

It must not show internal project description, client scope, project status beyond what the safe agenda projection explicitly and necessarily returns, deadline unrelated to the Operator’s own task rows, project members, roles, task assignees, administration, project-wide delivery counts, or a generic project workspace link.

### 6.5 Per-project own-task list

This page is a Server Component backed by `getOperatorOwnWorkProject(projectId)`.

Required behavior:

1. Validate route-parameter shape using the repository’s existing safe UUID/route-parameter convention before the read.
2. Query only the agenda view constrained by the requested safe project ID.
3. If no safe rows return, render the generic localized absence/denial treatment. Do not reveal whether the project exists, is inactive, is a valid UUID owned by someone else, or has no project-wide tasks.
4. Render the same distinct-task presentation model and authoritative category/status semantics as the agenda page, scoped only to returned own rows.
5. Provide a locale-aware return link to `/operador/proyectos`.
6. Do not render a project workspace tab system, a project overview, task create/edit controls, a project “backoffice” header, member list, global task count, or an internal-project empty state.

### 6.6 No optional filtering unless needed

No filter is required for acceptance. Implement a small client filter leaf only if the final server-rendered list demonstrably needs it for practical use. If implemented:

- keep all data acquisition, authorization, grouping, and default ordering on the server;
- filter only already-rendered safe rows by a narrow, accessible category/status control;
- preserve canonical default ordering within the visible subset;
- provide an explicit localized accessible name and selected-state semantics;
- do not persist filters to a shared store, URL, local storage, or offline cache unless an existing project convention already owns that behavior; and
- do not create a generic filtering framework or a client-side project/task store.

---

## 7. Presentation, localization, accessibility, and recovery

### 7.1 Component placement and file boundaries

Keep production implementation files at or below 400 lines. Prefer the following ownership split; exact component names may vary only where a nearby established convention is stronger:

```text
src/lib/operator/
└── queries.ts

src/app/[locale]/(protected)/operador/
├── agenda/
│   ├── page.tsx
│   ├── loading.tsx                         # only if no correct parent boundary already exists
│   ├── error.tsx                           # only if route-specific recovery is required
│   └── _components/
│       ├── operator-agenda-list.tsx
│       ├── operator-agenda-task-card.tsx
│       └── operator-agenda-empty-state.tsx
└── proyectos/
    ├── page.tsx
    ├── [project-id]/page.tsx
    └── _components/
        ├── operator-project-list.tsx
        └── operator-project-task-list.tsx

src/components/shared/app-nav/
├── app-nav.tsx                              # modify only to activate the real Operator link
└── _components/mobile-nav-toggle.tsx         # same role/navigation behavior
```

- Route-specific presentation remains route-local under `_components/`.
- Do not place Operator-specific cards in `src/components/shared/` merely because they are used by more than one Operator route. Shared application components are only appropriate for genuinely cross-role presentation primitives already warranted by existing patterns.
- Keep all query transformation in `src/lib/operator/queries.ts`; do not duplicate row grouping in pages/components.
- Do not create a `"use server"` action module: there is no mutation in S05-02.

### 7.2 Mobile-first presentation contract

At a 375px viewport, the primary card/list hierarchy must remain usable with no horizontal scrolling:

1. task title and safe project name are readable and not dependent on hover;
2. urgency label/icon, deadline/completed context, and task status are visible or reachable in the normal reading order;
3. no dense table, horizontal card rail, drag-and-drop control, hover-only tooltip, or PM-style Kanban is introduced;
4. primary navigation targets are at least 44×44px;
5. cards/list links have explicit localized accessible names that distinguish the task/project they open without relying only on visual position;
6. semantic status/urgency cues remain legible in light and dark themes; and
7. content uses existing semantic tokens and does not introduce raw color values as status meaning.

### 7.3 Localization contract

Use the repository’s current message-catalog structure and existing top-level namespace constraints. Do **not** create a new top-level `operatorAgenda`, `common`, `navigation`, or route-named namespace merely because the sprint plan gives example namespaces.

Place S05-02 keys under the established existing `projects` namespace, using a focused semantic subtree such as:

```text
projects.operatorAgenda
projects.operatorProjects
```

The exact subtree must be selected after inspecting the current catalog and key-naming tests; it must be identical in `messages/es-MX.json` and `messages/en-US.json`. Add only values actually used by S05-02. At minimum, provide semantic copy for:

- agenda/project-list headings and concise descriptions;
- each urgency category’s visible label and accessible meaning;
- task-status/priority labels only where an existing central map does not already supply them;
- deadline/completed-today context;
- own-work count wording that cannot be mistaken for project-wide counts;
- loading label, empty agenda, empty own-work-project index, empty/denied project route, generic safe load failure, retry, and return-to-own-projects actions; and
- accessible labels for task/project navigation and any demonstrated local filter.

Rules:

- Spanish (`es-MX`) is the default visible locale. English (`en-US`) is the exact semantic counterpart.
- Every leaf is non-empty in both catalogs. Interpolation names, if used, are identical.
- New key segments are semantic lower camel case; avoid component, visual-position, route/path/URL, locale/language, or color terms.
- Reuse existing `shell.nav.links.agenda`, role labels, status maps, date formatting, and common recovery text where they already express the correct meaning. Do not create duplicate synonyms.
- No newly touched component renders hard-coded Spanish or English user-visible copy, raw enum values, or raw data/adapter error messages.

### 7.4 Loading, empty, error, and absence behavior

| Condition | Required treatment | Prohibited treatment |
| --- | --- | --- |
| Agenda route pending | Route loading boundary using existing `Skeleton`/semantic tokens and a localized non-leaking loading label. No fetch/mutation/client interaction in the loading file. | Fabricated task titles, project counts, membership facts, or activity. |
| No returned agenda rows | Localized truthful empty state: no assigned work currently available in the authorized agenda. Optional link to own-work project index only if it remains meaningful. | A claim that the Operator has no project membership or that the system has no tasks. |
| No returned project groups | Localized empty state for no current own-work projects derived from returned rows. | A general project-directory empty claim. |
| Invalid/non-visible/empty per-project target | Generic localized absence/denial state with safe return to `/operador/proyectos`. | Distinguishing invalid, nonexistent, foreign, archived, inaccessible, or no-project-wide-task outcomes. |
| Expected data/render failure | Localized generic retry/recovery state; capture through existing safe error reporting if a route error boundary is used. | Rendering raw error, digest, Supabase/RLS/RPC detail, UUID, stack trace, or private context. |

Do not create a client-side “retry” that replays or persists a query. A retry only invokes the normal route/render path again.

---

## 8. Expected changed-file inventory

This is an implementation map, not permission for speculative files. Create/modify only files that the actual final route/component architecture requires.

| Path | Action | Responsibility |
| --- | --- | --- |
| `src/lib/operator/queries.ts` | New | Server-only typed agenda-view reads, safe row-to-presentation mapping, distinct-task deduplication, own-work project grouping, and safe target lookups. |
| `src/app/[locale]/(protected)/operador/agenda/page.tsx` | New | Server role gate and server-rendered agenda composition. |
| `src/app/[locale]/(protected)/operador/agenda/_components/*` | New as needed | Focused agenda presentation only. |
| `src/app/[locale]/(protected)/operador/proyectos/page.tsx` | New | Server-rendered own-work project index. |
| `src/app/[locale]/(protected)/operador/proyectos/[project-id]/page.tsx` | New | Safe per-project own-task list and generic absence/denial treatment. |
| Route-local `loading.tsx` / `error.tsx` files | New only when the existing parent boundary is insufficient | Truthful route recovery without duplicate boundary boilerplate. |
| `src/components/shared/app-nav/app-nav.tsx` | Modify | Activate only the now-real Operator agenda navigation link. |
| `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx` | Modify | Same Operator navigation activation and existing drawer-close behavior. |
| `messages/es-MX.json` | Modify | Spanish S05-02 semantic keys. |
| `messages/en-US.json` | Modify | Exact English semantic-key counterpart. |
| `__tests__/operator/operator-queries.test.ts` | New | Focused safe row shaping/deduplication/project grouping and non-visible target outcomes. |
| `__tests__/operator/operator-agenda-routes.test.tsx` | New | Focused agenda/project presentation, category semantics, generic absence, and accessible/mobile-relevant behavior. |
| `__tests__/app-shell/navigation.test.ts` | Modify | Operator agenda activation parity in desktop/mobile navigation while preserving other roles’ existing behavior. |

Do not modify migrations, generated types, Supabase configuration, environment files, OpenAPI source, Client modules, PM/Admin workspace queries, `CHANGELOG.md`, or closeout documentation for this work item.

---

## 9. Focused verification contract

### 9.1 Evidence selection

This item requires only focused automated evidence for new application-layer behavior plus strict TypeScript compilation. The accepted migration’s database/RLS/query evidence remains the authority for view security, assignment timestamp maintenance, completed retention, and database urgency derivation. Do not recreate those proofs in UI tests.

Run only this selected verification sequence after implementation changes are complete:

```text
npm run test -- __tests__/operator/operator-queries.test.ts __tests__/operator/operator-agenda-routes.test.tsx __tests__/app-shell/navigation.test.ts
npm run typecheck
npm run build
npm run lint
npm run format:check
```

Do not run `npm run verify`, coverage, database commands, or manual localhost journeys for S05-02 unless a later controlling task explicitly expands this item. Sprint-wide full verification and manual journeys belong to S05-07 closeout. `npm run format:check` is a non-mutating verification; do not run `npm run format` as part of this item.

### 9.2 Required focused assertions

#### A. `__tests__/operator/operator-queries.test.ts`

Test only the public behavior of the new query-model functions using the existing repository mocking/MSW conventions:

1. the query reads `operator_agenda_view` with an explicit safe field selection and does not query base task/project/membership/deliverable tables;
2. multiple safe rows for the same task are mapped into one task presentation record with only the returned safe deliverable summaries;
3. own-work project grouping creates one project card per safe `project_id`, with distinct-own-task counts only;
4. grouping never manufactures project-wide counts, memberships, assignees, internal notes, or a second query;
5. category/order behavior preserves the authoritative categories and the exact server-side fallback order from Section 5.3 when application ordering is necessary;
6. a non-visible/absent project target returns the safe absence result rather than an error that distinguishes the target; and
7. an unknown/missing urgency category fails safely at the application boundary rather than being silently guessed or mapped to a false category.

Do not unit-test Supabase client internals, RLS SQL, migration trigger behavior, stored timezone arithmetic, or a complete Cartesian matrix of timestamps. Those are schema-boundary evidence outside this work item.

#### B. `__tests__/operator/operator-agenda-routes.test.tsx`

Test only the route/presentation contract with safe fixture models:

1. the agenda displays a distinct own-task list with task title, safe project context, task status, deadline/completed context, and localized non-color urgency meaning;
2. all six authoritative categories render their correct semantic text/icon/accessible description; task status remains distinct from urgency;
3. completed-today work is visually/statefully read-only in this slice and offers no mutation/submission control;
4. the project index labels its count as the Operator’s own assigned work and does not render project-wide workspace/member/admin content;
5. the project task list contains only supplied own rows and generic safe absence copy for an absent/non-visible target;
6. agenda/project navigation uses the locale-aware path contract and does not build an English path manually;
7. loading/empty/recovery output contains no representative raw database/RLS/UUID/error detail; and
8. primary links/actions have accessible names, keyboard operability, and markup that does not require a horizontal-scroll table at the narrow-card layout boundary.

Do not assert Tailwind class strings, Lucide SVG internals, skeleton implementation internals, `next-intl` internals, every literal translation, or arbitrary pixel measurements.

#### C. `__tests__/app-shell/navigation.test.ts`

Extend the existing suite only for the changed shared navigation contract:

1. an Operator’s agenda item is a live, locale-aware, keyboard-focusable link to `/operador/agenda` in desktop navigation;
2. the same target is live in mobile navigation and follows the existing drawer-close path;
3. it is no longer marked `aria-disabled` or removed from sequential keyboard navigation;
4. Admin/PM behavior remains unchanged; and
5. Client’s not-yet-implemented destination remains unavailable and non-navigable.

Do not re-test the whole protected layout, route guard, theme switcher, language-switcher internals, or Client implementation behavior.

### 9.3 Manual verification is intentionally deferred

No manual localhost journey is required in this work item. S05-07 owns the sprint-level manual Operator isolation/navigation journey after the S05-03 task route/submission flow is integrated. This prevents duplicate setup and avoids changing mutable sandbox/reference data merely to demonstrate a partial read-only route.

---

## 10. Acceptance criteria

- [ ] S05-DEC-01’s committed migration/generated-type baseline is present before S05-02 application work relies on `assigned_at`, completed retention, or the six authoritative urgency categories.
- [ ] `/operador/agenda` and `/en/operador/agenda` are real protected Operator routes, server-rendered from the dedicated Operator safe-view query boundary.
- [ ] The shared desktop/mobile Operator navigation item is activated only for the real agenda route; it is locale-aware, keyboard reachable, and preserves mobile drawer behavior.
- [ ] Every Operator agenda, project-index, and per-project task-list read originates exclusively from `operator_agenda_view` through `src/lib/operator/queries.ts`.
- [ ] No Operator screen performs a broad table query, `select("*")`, client-side authorization filter, privileged-client access, membership query, project-wide task query, internal-note read, audit/comment read, or Client/PM/Admin data read.
- [ ] Agenda task cards are distinct by task identity even when safe agenda rows include multiple deliverables.
- [ ] Project index groups/deduplicates only already-returned own agenda rows and states counts as the Operator’s own assigned work, never a project-wide total.
- [ ] A project detail path displays only safe own rows for the authenticated Operator; forged/non-visible/absent IDs produce generic safe absence/denial treatment without disclosure.
- [ ] All six authoritative categories are shown with localized textual and non-color meaning; task status and urgency remain separate semantics.
- [ ] Default agenda ordering follows the revised authoritative representation or the exact server-side safe fallback order in Section 5.3. Browser/device time does not determine categories or retention.
- [ ] Completed-today records are presentation-only in this item; no task transition, submission, or lifecycle mutation is introduced.
- [ ] The agenda and project-list routes are usable at a 375px viewport, keyboard-operable, touch-target compliant, and legible in both themes without horizontal scrolling.
- [ ] New visible copy is localized in exact `es-MX`/`en-US` semantic-key parity. No hard-coded user-visible copy, raw enum, raw error, RLS detail, UUID, stack trace, or private project context is rendered.
- [ ] No submission/task-detail route, Server Action, URL handling, offline behavior, provider behavior, Client behavior, migration/type generation, deployment, changelog, closeout document, or broad verification is introduced.
- [ ] The selected verification sequence in Section 9.1 passes with factual results before this work item is reported complete.

---

## 11. Stop conditions and successor handoff

| Discovery | Required response |
| --- | --- |
| The revised safe view cannot supply a needed Operator presentation fact without an internal table/join. | Stop the affected surface. Request a narrowly scoped safe-projection decision. |
| A route can read another Operator’s row, a project-wide row, membership data, Client data, internal notes, feedback, audit data, or operational data. | Block the item. Do not hide the leak only in UI; correct the safe projection/query boundary and re-verify. |
| Browser logic must calculate urgency, assignment age, completion retention, or lifecycle status to make the page work. | Stop. Those are authoritative database semantics under S05-DEC-01. |
| A needed interaction requires task detail, production submission, resource opening, URL handling, or a lifecycle mutation. | Defer to S05-03; do not add a partial control or placeholder route. |
| A desired filter requires cached/broad browser data, a shared store, route redesign, or a generic filter system. | Omit it. The minimal server-rendered agenda/list remains the accepted baseline. |
| A category value returned by the revised view is unknown, null, or mismatched with the accepted six values. | Stop and report the exact type/view discrepancy. Do not silently relabel it. |
| The selected focused tests cannot prove the new safe-model/presentation behavior because existing test conventions or modules materially differ. | Stop and update this specification through the governing review path before broadening tests. Do not create an unrelated test framework. |

### Successor handoff to S05-03

When S05-02 is complete, it leaves these stable boundaries for S05-03:

- the active agenda and own-work project navigation routes;
- `src/lib/operator/queries.ts` as the sole Operator safe read layer, including a safe current-task lookup over `operator_agenda_view` when S05-03 needs it;
- distinct task/deliverable summaries with no duplicate-task rendering;
- localized urgency/status/presentation mappings and generic non-leaking route recovery; and
- no production-version mutation, no task-status UI, no external URL action, and no browser-owned lifecycle state.

S05-03 may add the canonical `/operador/tareas/[task-id]` route and the constrained production submission action only by consuming this same safe query boundary and the existing authoritative command. It must not replace the agenda/project index with a broad workspace query.

---

*This specification was written on 2026-08-21 from the accepted Sprint 05 plan, the S05-01 contract-mapping reference, S05-DEC-01, the S04 implementation-spec conventions, and the repository’s current route/navigation/test-script inventory. It intentionally selects only focused S05-02 verification and defers sprint-closeout verification to S05-07.*
