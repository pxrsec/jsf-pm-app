# S05-03 — Deliver Operator Task Detail and Production-Submission Flow

**Sprint:** S05  
**Work item:** S05-03  
**Status:** Implementation-ready after `20260821170000_s05_03_operator_task_detail_safe_projection.sql` is applied to `jsf-pm-dev` and its generated types are committed  
**Last reviewed:** 2026-08-21  
**Spec authority:** `dev-docs/specs/s05/s05-e06-e07-operator-and-client-execution-sprint-plan.md`, Sections 4–7 and 9; `dev-docs/specs/s05/s05-e06-e07-contract-mapping-reference.md`, Sections 2–7; the committed Supabase migrations and generated types; S05-02’s accepted handoff.  
**Dependencies:** integrated S04 production lifecycle; S05-01 contract mapping; completed S05-DEC-01 agenda migration/type baseline; completed S05-02 Operator agenda and own-work navigation; applied S05-03 safe-projection migration and its committed generated-type baseline.  
**Successor boundary:** S05-04 onward own Client portal behavior. S05-03 adds no Client surface, no PM workspace capability, and no lifecycle shortcut.

---

## 1. Objective

Deliver the canonical, localized, bookmarkable Operator task-detail route and the narrowly scoped production-version submission flow.

An authenticated Operator must be able to:

1. open an own assigned task at `/operador/tareas/[task-id]` (or its locale equivalent);
2. inspect only the safe task title, description, task state/priority/urgency, relevant task/deadline context, safe task resources, and assigned deliverable context returned by the authenticated Operator-safe projection;
3. deliberately open an already-rendered safe resource URL without the application fetching, previewing, proxying, scanning, or otherwise inspecting it;
4. submit one eligible assigned **production** deliverable using a raw lexically valid Google Drive HTTPS URL and an optional supported note; and
5. receive authoritative success, validation, conflict, authorization, and online-failure outcomes without fabricated version history, local lifecycle changes, or deferred replay.

A successful submission records the next immutable version through `submit_deliverable_version()` and returns the production deliverable to `awaiting_internal_review`. It does not prove that a remote resource exists, is available, is safe, has been uploaded, or was sent to a Client.

---

## 2. Scope and non-negotiable boundaries

### 2.1 In scope

1. Add the canonical protected Operator route:

   ```text
   /operador/tareas/[task-id]
   /en/operador/tareas/[task-id]
   ```

2. Extend `src/lib/operator/queries.ts`—and only that Operator read boundary—with a typed safe current-task/detail representation over `operator_agenda_view`.
3. Consume the applied S05-03 safe-projection baseline defined in Section 3.
4. Add an Operator-owned submission schema/action wrapper that derives the actor from the server session, validates only browser-owned input, proves target visibility through the Operator safe projection, invokes the existing production command adapter, and revalidates concrete Operator paths.
5. Add route-local task-detail and submission-form components, including accessible pending, validation, safe-error, success, and retry states.
6. Activate canonical task navigation from existing S05-02 agenda/project task cards only after the route exists. The card link must use the locale-aware routing helper.
7. Add only the required `es-MX`/`en-US` message keys, in exact semantic-key and interpolation parity.
8. Add the minimum focused application coverage needed for the new safe-detail/query/action/UI behavior. Database/RLS/command invariants remain owned by the existing schema evidence and command tests; do not mechanically duplicate them.

### 2.2 Explicitly out of scope

- Task status transition controls, task editing, assignment, planning, Kanban, task comments, project administration, membership, project-wide task lists, audit history, notifications, or PM/Admin workspace controls.
- Client portal, Client submissions, Client review, Client feedback, Client lifecycle actions, or any Client data source.
- Internal review, release-to-Client control, Client approval, final delivery, or any direct lifecycle/status/feedback/version write.
- Version-history UI, formal-feedback UI, prior submitted URLs, link reporting, Drive preview, remote URL dereference, Drive API use, binary upload/storage, content scanning, proxying, or reachability checks.
- Offline cache, Service Worker, client data cache, persistent local queue, background synchronization, deferred mutation, replay, polling, or broad Realtime.
- New HTTP route handlers, CORS behavior, provider activation, email, WhatsApp, webhooks, schedules, hosted-environment changes, deployment, preproduction, or production work.
- Creating, applying, or modifying migrations; dashboard edits, generic SQL, destructive reset, or manual generated-type edits. The required migration is applied before this implementation begins.
- `CHANGELOG.md` and Sprint 05 closeout updates; S05-07 owns the aggregated closeout/changelog scope unless the Project Owner expressly redirects it.

### 2.3 Security and truthfulness rules

- `profiles.role` and the authenticated server session are the only application-role authority. Route paths, task IDs, deliverable IDs, client state, and form values never grant access.
- `operator_agenda_view` is the **sole permitted Operator read source** for every S05-03 page, target-lookup, and action preflight. It is a `security_invoker` view; underlying RLS remains effective.
- Do not read `tasks`, `deliverables`, `task_resources`, `projects`, `project_members`, `deliverable_versions`, `deliverable_feedback`, `audit_logs`, comments, notifications, or a mixed-visibility internal query as an Operator shortcut.
- The database command remains the authority for production workflow type, assignee authorization, row locking, valid current state, immutable version creation, status transition, audit evidence, and in-app event creation.
- The browser never sends or selects actor ID, role, project ID, task status, deliverable status, workflow type, current version, version number, review stage, reviewer, or lifecycle transition.
- A task/deliverable is never considered available merely because its UUID is well formed. Missing, foreign, stale, malformed, or non-visible targets converge on generic safe absence/denial treatment.
- URL validation is lexical only. Neither client nor server may fetch, resolve, follow, preview, proxy, download, scan, host, authenticate against, or report remote reachability for a submitted or displayed URL.
- UI state may show transient pending feedback only. It must not append a version, increment a version number, switch a status, or claim successful submission until the command accepts and the authoritative route is refreshed.
- User-visible output must not disclose raw URLs after a failed submission, UUIDs, RLS details, SQL/RPC messages, function names, stack traces, private project context, or membership facts.

---

## 3. Required safe-projection migration baseline

### 3.1 Resolved projection gap

The current S05-02 application boundary and committed S05-DEC-01 view do **not** contain every field required by the accepted S05-03 task-detail scope:

- `operator_agenda_view` currently provides task title/description/status/priority/deadline/start/assignment data and compact deliverable identity/title/status/workflow/version/review-deadline data.
- It does **not** provide task resources.
- It does **not** provide production deliverable specifications.
- It does **not** provide the production submission deadline.

The current generated type at `Database["public"]["Views"]["operator_agenda_view"]["Row"]` confirms those omissions. The original S02 migration contains a resource aggregation for `client_task_view`, but it is not part of the Operator projection; it must not be repurposed through a base-table read.

The migration named below resolves the gap without a second Operator detail query or any broad base-table read.

### 3.2 Applied migration contract

`supabase/migrations/20260821170000_s05_03_operator_task_detail_safe_projection.sql` is the required forward-only S05-03 migration. Apply it to `jsf-pm-dev` and commit the untouched generated `src/lib/database.types.ts` output before implementation begins.

It extends `operator_agenda_view` with only the following fields:

| Required field | Source | Permitted S05-03 use | Must not expose |
| --- | --- | --- | --- |
| `task_resources` | Aggregated active `task_resources` for the same returned task | Ordered resource name, URL, and optional ordering metadata for intentional outbound links | Internal resources for another task, deleted resources, arbitrary task-resource table access, remote metadata, preview data, or credentials |
| `deliverable_specifications` | The same returned assigned deliverable row | Plain-text production deliverable requirements | Internal feedback, version history, audit data, client-visible/internal visibility distinctions, or rendered HTML |
| `submission_deadline_at` | The same returned assigned deliverable row | Relevant submission deadline display | A deadline that is not on the returned assigned deliverable or any inferred urgency/lifecycle state |

The migration:

1. preserve `security_invoker = true` and underlying RLS behavior;
2. aggregate only active task resources for the visible task, ordered deterministically by the authoritative resource order and represented as a stable JSON array (empty array rather than a fabricated resource);
3. retain the existing Operator task/deliverable row cardinality and no broader joins than are required for the three fields above;
4. expose no task assignee, member, Client, PM, audit, feedback, notification, resource-secret, or external-provider fields;
5. leave S05-DEC-01 assignment, urgency, completed-day retention, task lifecycle, existing RPCs, and Client-safe projections unchanged;
6. requires focused migration/RLS/query evidence;
7. applies only to `jsf-pm-dev`; and
8. requires untouched MCP-generated `src/lib/database.types.ts` to be committed before S05-03 application code selects or types the fields.

### 3.3 Implementation start gate

Before application implementation begins, confirm all of the following from committed source/types:

- the projection has the approved safe fields with the exact generated types;
- task resources have a stable safe JSON shape with a deterministic empty state;
- no selected field requires a type assertion, `any`, manual type edit, or browser-side repair;
- the view remains the only Operator read boundary; and
- the current `submit_deliverable_version()` contract remains unchanged: it accepts an eligible production assignee, active PM Lead, or Admin; permits only `pending` or `changes_requested`; creates the successor immutable version; and returns `awaiting_internal_review`.

Any inconsistency is a stop condition for the affected implementation scope. Do not substitute a broad table query, a type assertion, a manual generated-type edit, or client-side joining.

---

## 4. Canonical read and action model

### 4.1 Operator query boundary

`src/lib/operator/queries.ts` remains the sole role-safe read module. Do not create a second generic task/detail module and do not import internal S04 project or deliverable queries into the Operator route.

Extend it with focused, server-only responsibilities conceptually equivalent to:

```text
getOperatorTaskDetail(taskId)
getOperatorDeliverableForSubmission(deliverableId)
```

Exact names may follow current code conventions, but the responsibilities must remain separate and explicit.

#### `getOperatorTaskDetail(taskId)`

1. Validate the route value with the existing strict UUID convention before querying.
2. Select only the exact safe fields required by the canonical detail model from `operator_agenda_view`; never use `select("*")`.
3. Constrain the view by `task_id` and operate only on rows already returned for the authenticated Operator.
4. Deduplicate one-to-many deliverable rows into one selected task and an array of only its safe deliverable summaries.
5. Normalize the approved `task_resources` JSON into a narrow typed resource model. Treat a malformed/null resource payload as a safe implementation error, not as permission to query the base table.
6. Validate the existing six urgency values at the same application boundary used by S05-02. Preserve the database category; do not recompute it.
7. Return `null` for malformed, absent, or non-visible targets. The route must render one generic localized absence/denial state.

#### `getOperatorDeliverableForSubmission(deliverableId)`

1. Validate the untrusted UUID before querying.
2. Query only `operator_agenda_view`, constrained by the supplied `deliverable_id` and the authenticated Operator’s RLS-scoped result.
3. Return a minimal safe target record: task ID, project ID, deliverable ID, deliverable workflow type, current deliverable status, and title needed for action/revalidation/result context.
4. Return `null` for absent/non-visible/malformed targets. It must never fall back to `deliverables` or another table to distinguish existence from invisibility.

This preflight is a safe presentation/action target lookup, not a replacement for RPC authorization. The RPC remains final authority against reassignment, stale state, races, and lifecycle rules.

### 4.2 Canonical detail presentation model

The task-detail model may contain only:

| Group | Allowed content |
| --- | --- |
| Task identity/context | Task title; safe project name only as contextual text and return navigation; no raw IDs or project workspace link. |
| Task work description | Returned task description as plain text; no internal notes, HTML interpretation, comments, or audit context. |
| Work state | Returned task status and priority using existing central semantic maps; returned urgency using the existing S05-02 map; task status and urgency stay distinct. |
| Time context | Returned task deadline/start/assigned time where present; approved deliverable submission/internal-review/client-delivery deadlines when present. Do not invent missing dates or calculate urgency. |
| Safe resources | Approved projected resources only, rendered as intentional outbound actions with their returned display name. |
| Assigned deliverables | Returned title, plain-text specifications, workflow type, current status, current version number, relevant deadlines, and exactly one next action based on the returned safe state. |

For each returned deliverable:

- render submission only when `deliverableWorkflowType === "production"` **and** status is `pending` or `changes_requested`;
- show a read-only truthful waiting state for `awaiting_internal_review` and `awaiting_client_review`;
- show read-only state for `approved` and `delivered`;
- do not render a Client workflow or Client-submission behavior for any status;
- do not render a generic submit action for an unrecognized, null, or unsupported workflow/status. Treat an unexpected safe-view invariant as a generic recovery/error state and log only sanitized operational context.

A task may contain zero deliverables. That is an allowed read state: render the task detail without a submission CTA. It is not evidence that the project lacks deliverables or that the Operator lacks membership.

### 4.3 Operator submission action boundary

Create a dedicated `"use server"` module at:

```text
src/lib/operator/actions.ts
```

If an Operator-specific input schema would otherwise duplicate the exact shared production schema, reuse `SubmitDeliverableVersionSchema` directly. Create `src/lib/operator/schemas.ts` only for an action-envelope schema that adds genuine Operator-specific input validation without duplicating lifecycle policy.

The Server Action must be a direct exported async declaration. It must:

1. accept only `deliverable_id`, raw `submission_url`, and nullable optional `submission_note` from the browser;
2. validate that input with the shared strict production submission schema before any command invocation;
3. obtain cookies, call `requireSession`, and require `session.role === "operator"` before action processing;
4. create the typed SSR client;
5. obtain the safe submission target via `getOperatorDeliverableForSubmission`; return generic `NOT_FOUND`/denial behavior when it is absent;
6. reject any non-production workflow or status other than `pending`/`changes_requested` as `INVALID_TRANSITION` without a direct base-table query;
7. invoke existing `submitDeliverableVersion(supabase, parsedInput)` exactly once after the safe preflight;
8. on success, revalidate all concrete affected localized Operator paths: agenda, own-work project index, the selected safe project list, and the selected canonical task route in Spanish and English;
9. return the standard `CommandResult<SubmitVersionResult>` shape; and
10. never accept/derive browser-controlled project/task/actor/status/version/stage fields or call a PM-only action wrapper.

Do **not** reuse `submitDeliverableVersionAction()` as the Operator action. Its current preflight reads `deliverables` directly and its success path revalidates Admin/PM workspace routes; both are wrong boundaries for S05-03. Reuse the narrow typed `submitDeliverableVersion()` command adapter and the shared URL schema/validator instead.

### 4.4 Required error/result semantics

| Result/condition | Operator UI behavior |
| --- | --- |
| Local malformed Google Drive URL | Keep the form open; show localized, field-associated validation copy. Do not call the action. |
| Server `VALIDATION_FAILED` | Keep inputs open; show safe validation feedback. Server validation remains authoritative. |
| Safe target absent/non-visible or `NOT_FOUND` | Close stale submission dialog if needed, show generic localized unavailable/permission-safe state, then refresh the canonical route. Do not reveal why. |
| `UNAUTHORIZED` | Keep no local status/history change; show one safe localized unavailable/permission message; refresh the canonical route. |
| `INVALID_TRANSITION` | Explain only that submission is no longer available in the current state; close pending state and refresh authoritative task data. |
| `CONFLICT`, duplicate/replay, stale assignment, or stale state | Do not claim a version was created. Show localized state-changed copy and refresh authoritative task/agenda data. |
| `INVARIANT_VIOLATION` | Show a safe action-specific message only where it does not reveal internal configuration; otherwise use generic retry/unavailable copy. |
| `UNKNOWN` or interrupted online request | Clear pending state, preserve non-sensitive form text in component state where practical, show generic retry copy, and do not persist/replay anything. |
| Success | Close form, announce that immutable version `v{version}` was recorded for **internal review**, call `router.refresh()` as UI follow-up, and render refreshed server state. Never say uploaded, verified, released to Client, sent, delivered, or approved. |

Map `CommandResult.error.code` to localized copy. Never render `error.message` as product copy.

---

## 5. Route and interaction specification

### 5.1 Route matrix

| Surface | Spanish | English | Gate/read source | Required behavior |
| --- | --- | --- | --- | --- |
| Canonical Operator task detail | `/operador/tareas/[task-id]` | `/en/operador/tareas/[task-id]` | `requireSession`, role `operator`; `getOperatorTaskDetail(taskId)` | Server-rendered safe detail. Invalid, absent, or foreign task returns generic safe absence/denial. |
| Operator submission dialog/form | Child of canonical task detail | Locale supplied by route | Same role plus safe deliverable lookup and RPC enforcement | Client interaction leaf only; no client-side data query/cache. |
| Agenda task CTA | `/operador/agenda` cards | Locale helper supplies English | Existing safe item only | Opens canonical task URL. |
| Per-project task CTA | `/operador/proyectos/[project-id]` cards | Locale helper supplies English | Existing safe item only | Opens canonical task URL. |

Use `Link` and routing helpers from `@/i18n/routing`. Do not build `/en/` paths manually or use browser pathname logic.

### 5.2 Canonical detail page

The page is a React Server Component. It must:

1. enforce the existing protected Operator session/role gate;
2. validate and resolve the route parameter through the query boundary;
3. render a localized heading that identifies the task without exposing raw identifiers;
4. show a locale-aware return link to the safe own-work project list when project context is available, and a safe fallback to `/operador/agenda` for generic absence handling;
5. render the returned title, description, semantic urgency/status/priority, relevant date context, safe resources, and distinct returned deliverable cards;
6. preserve the S05-02 authoritative urgency semantics and central task status/priority mappings; and
7. contain no direct Supabase query, browser data fetch, generic project-page query, or lifecycle mutation logic.

The detail page must not imply that all project tasks, project resources, or project deliverables are visible. Its wording and counts must remain task/Operator-specific.

### 5.3 Task resources

Render each approved projected resource as a deliberate outbound link/button:

- use the returned resource name as visible label, with a localized accessible name stating that it opens an external resource;
- use `target="_blank"` with the project-standard safe `rel` policy, including `noopener noreferrer`;
- optionally show only a non-sensitive provider/host label derived from the already-rendered URL locally if an existing shared utility supports it; do not introduce a new provider-detection subsystem;
- do not display an iframe, preview, status, reachability assertion, fetched title, thumbnail, or raw error;
- do not create an outbound action for malformed resource data; handle this as a safe route-level data inconsistency rather than silently repairing the URL.

### 5.4 Deliverable summary and action gating

Each returned assigned deliverable card must show a concise, mobile-first hierarchy:

1. title;
2. existing central status text/icon, not color alone;
3. current version as `v{n}` only when a returned version number exists; no invented `v0` history claim;
4. plain-text specifications when supplied by the approved safe projection;
5. relevant submitted/review deadlines when present;
6. a state-specific truthful notice or submission CTA.

#### Eligible production submission

A submission CTA is rendered only for a returned production deliverable in `pending` or `changes_requested`.

For `changes_requested`, the UI must state all of the following clearly:

- revisions were requested for this production deliverable;
- submitting a replacement records a **new immutable version**; and
- the replacement returns to **internal review**, not directly to Client review.

The UI may not insert or visually claim an intermediate `pending` transition. The constrained command owns the actual lifecycle transaction.

#### Ineligible/read-only states

- `awaiting_internal_review`: show a truthful waiting-for-internal-review state; no status selector or resubmit action.
- `awaiting_client_review`: show a truthful released-for-Client-review waiting state; do not expose a Client action or infer receipt.
- `approved` or `delivered`: show only returned read-only state; no delivery or review controls.
- Unknown/null status or workflow: no action. Render generic recovery copy and preserve no false lifecycle meaning.

### 5.5 Submission form

Use a focused route-local Client Component. It may use the existing shadcn `Dialog` or `Sheet` pattern only if its focus, close, and narrow-viewport behavior are correct. A dialog is preferred because submission is an isolated action, not a competing task-detail navigation surface.

The form contains exactly:

1. **Google Drive share URL** — required raw text input, no trimming or normalization before immediate validation.
2. **Submission note** — optional plain text when the existing shared schema supports it; maximum 1,000 characters; trim only the optional note for its nullable command value, never the URL.

Form behavior:

1. Use `isValidGoogleDriveUrl()` for immediate lexical feedback and the shared `SubmitDeliverableVersionSchema` again at the server boundary.
2. Explain in localized text that only exact Google Drive/Google Docs HTTPS links are accepted and the application records the link without opening, checking, or uploading content.
3. Disable the primary submit control while pending. One user action yields at most one action invocation.
4. Associate field errors with inputs using `aria-describedby`/existing form conventions; give the error/recovery region appropriate live announcement behavior.
5. Preserve submitted URL/note only in ephemeral component state after an unknown/online failure. Never write either to local storage, URL search parameters, cache, retry queue, telemetry, or an error message.
6. On success, clear sensitive form state, close the dialog, announce authoritative internal-review result, and refresh.
7. On rejected state/permission/conflict, do not close the task detail itself, do not add a version card, and refresh the safe route as required by Section 4.4.

The existing internal `DeliverableSubmitDialog` is not the reuse target: it is coupled to an internal `DeliverableListItem`, uses the Admin/PM action wrapper, and currently contains an internal-workspace localization/error boundary. S05-03 needs a small Operator-specific interaction leaf over the safe detail model and Operator action.

---

## 6. Component and file architecture

Keep production implementation files at or below 400 lines. Create/modify only the files the final architecture requires.

```text
src/lib/operator/
├── queries.ts                                  # MODIFY: safe detail/submission-target reads only
├── actions.ts                                  # NEW: direct async Operator submission action
└── schemas.ts                                  # NEW only if a focused action envelope is genuinely needed

src/app/[locale]/(protected)/operador/
├── tareas/
│   └── [task-id]/
│       ├── page.tsx                            # NEW: Server Component task detail
│       ├── loading.tsx                         # NEW only when parent boundary is insufficient
│       ├── error.tsx                           # NEW only for route-specific safe recovery
│       └── _components/
│           ├── operator-task-detail.tsx        # NEW: server-safe detail presentation
│           ├── operator-task-resources.tsx     # NEW only if it keeps responsibility clear
│           ├── operator-deliverable-card.tsx   # NEW: safe status/context/action gate
│           └── operator-submission-dialog.tsx  # NEW: client interaction leaf
├── agenda/_components/
│   └── operator-agenda-task-card.tsx           # MODIFY: canonical task link after route exists
└── proyectos/_components/
    └── operator-project-task-list.tsx          # MODIFY only if it must pass/offer canonical task navigation

messages/es-MX.json                             # MODIFY: exact Spanish leaf parity
messages/en-US.json                             # MODIFY: exact English leaf parity

__tests__/operator/operator-queries.test.ts      # MODIFY: safe detail/target shaping and absence
__tests__/operator/operator-agenda-routes.test.tsx # MODIFY: canonical card navigation only if needed
__tests__/operator/operator-task-detail.test.tsx # NEW: focused detail/submission presentation/action behavior
__tests__/operator/operator-actions.test.ts      # NEW: focused action ownership/input/refresh behavior
```

The required safe-projection migration and generated type update must already be committed before these application changes consume them.

Do not modify PM/Admin workspace actions, internal deliverable detail/history components, Client modules, migrations/types manually, OpenAPI, environment files, or shared navigation merely for this work item.

---

## 7. Localization, accessibility, and responsive behavior

### 7.1 Catalog contract

Retain S05-02’s existing `projects.operatorAgenda` and `projects.operatorProjects` keys. Add focused new subtrees under the same established `projects` namespace:

```text
projects.operatorTask
projects.operatorSubmission
```

Add only keys used by the implementation. At minimum cover:

- detail heading/description, back navigation, task context labels, no-resource state, and generic safe absence/recovery;
- accessible urgency/status/priority meaning reused or composed from existing central maps;
- resource external-link label/accessible description;
- production deliverable state notices and a revision-specific internal-review explanation;
- form labels, help text, URL field error, note label/help/count, pending/cancel/submit actions, success message, and code-mapped safe errors;
- explicit no-fetch/no-upload/no-client-release truthfulness text; and
- dialog title/description/close behavior and accessible names.

Rules:

- `es-MX` remains default visible locale; `en-US` is its exact semantic counterpart.
- Every leaf is present and non-empty in both files. Interpolation variable names match exactly.
- Reuse existing common/status/priority/urgency keys where they already express the required semantics; do not duplicate synonyms.
- New segments use semantic lower camel case and must not encode visual position, route names, colors, or locale names.
- No newly touched component renders hard-coded Spanish/English product copy, raw status enum, raw adapter error, URL, UUID, or internal error detail.

### 7.2 Accessibility baseline

At 375px width and by keyboard alone, an Operator must be able to open an own task, inspect its information, open a resource intentionally, open/close the submission form, correct a validation error, submit, and understand the returned outcome.

Required behavior:

- task CTA, resource controls, dialog controls, submit/cancel buttons meet the 44×44px touch-target requirement where primary;
- task urgency, task status, deliverable status, and success/error state are conveyed through localized text plus icon/semantic description, never color alone;
- dialogs have title/description semantics, visible close control, Escape/cancel behavior, focus containment, and focus restoration to the invoking action;
- all fields have persistent labels; required status, validation messages, pending state, and errors are programmatically associated and announced appropriately;
- resource links explicitly indicate external navigation and do not rely on a hover-only URL preview;
- no dense table, horizontal card rail, hover-only control, drag/drop, or desktop-only gesture is required;
- plain-text descriptions/specifications safely wrap and preserve reading order; and
- both light and dark semantic tokens remain legible without raw color-only meaning.

---

## 8. Focused verification contract

Use existing Vitest, React Testing Library, and MSW conventions. Do not add Playwright, a second test framework, a live database suite, or a broad S05 verification pass for this item.

### 8.1 Minimum automated coverage

#### A. Extend `__tests__/operator/operator-queries.test.ts`

Cover only the new public behavior:

1. the detail and submission-target reads use `operator_agenda_view` with explicit fields and never a base table or `select("*")`;
2. a detail query deduplicates one task with multiple safe deliverable rows while retaining only returned safe resource/specification/deadline values;
3. malformed, absent, or non-visible task/deliverable targets return the generic null/safe absence result;
4. malformed safe resource payload or unknown urgency/workflow invariant fails safely rather than prompting an internal fallback query.

#### B. Add `__tests__/operator/operator-actions.test.ts`

Cover only the Operator-owned action contract:

1. malformed UUID/URL/note input is rejected before command invocation;
2. only the server-derived Operator session can use the action; actor/status/version/stage/project/task fields cannot be injected by browser input;
3. the action resolves its target through the Operator safe projection, rejects absent/non-production/ineligible state safely, and does not call the generic PM/Admin action;
4. accepted input invokes `submitDeliverableVersion` once with the shared validated input;
5. a success revalidates the concrete localized agenda, project-list, selected project, and canonical task paths; and
6. validation, denial, invalid-transition, conflict, and unknown outcomes return safe code-based results with no local version/status behavior.

#### C. Add `__tests__/operator/operator-task-detail.test.tsx`

Cover the route-local presentation contract with safe fixtures:

1. own task detail renders safe title/description/project context, distinct urgency/status/priority meaning, safe resources, and only supplied assigned deliverables;
2. agenda/project task cards now link to the canonical locale-aware task URL only after the route is available;
3. resources are deliberate external links with appropriate accessible labels and no preview/fetch UI;
4. only `production` deliverables in `pending`/`changes_requested` render a submission CTA; the revision copy explicitly says the replacement returns to internal review;
5. other states are read-only and render no status/review/release/delivery/Client controls;
6. malformed URL feedback, pending double-submit protection, safe conflict/unknown recovery, and authoritative success refresh behavior are represented without fabricated history/state; and
7. required accessible labels, dialog behavior, non-color state cues, and narrow-layout semantic structure are covered.

Update `operator-agenda-routes.test.tsx` only for the changed canonical task link if its existing fixture/module coverage already owns that component. Do not create duplicate assertions across test files.

### 8.2 Verification commands

After implementation, run only the targeted commands required by the repository/task evidence, normally:

```text
npm run test -- __tests__/operator/operator-queries.test.ts __tests__/operator/operator-actions.test.ts __tests__/operator/operator-task-detail.test.tsx __tests__/operator/operator-agenda-routes.test.tsx
npm run typecheck
npm run build
npm run lint
npm run format:check
```

Do not claim commands not actually run. Sprint-wide manual localhost journeys and final full verification remain S05-07 responsibility.

---

## 9. Acceptance criteria

- [ ] `20260821170000_s05_03_operator_task_detail_safe_projection.sql` is applied to `jsf-pm-dev`, and the corresponding untouched generated `src/lib/database.types.ts` output is committed before application code depends on resources/specifications/submission deadline fields.
- [ ] `/operador/tareas/[task-id]` and `/en/operador/tareas/[task-id]` are real server-rendered protected Operator routes with locale-aware entry links from S05-02 task cards.
- [ ] Every S05-03 Operator read, target lookup, and route presentation resolves exclusively through `operator_agenda_view` in `src/lib/operator/queries.ts` with explicit least-privilege selection.
- [ ] The task detail never reads or reveals project-wide tasks, membership, other assignments, internal notes/comments/audit/history, Client data, PM/Admin controls, or raw identifiers.
- [ ] Missing, malformed, foreign, non-visible, and stale task/deliverable targets converge on generic localized safe absence/denial treatment.
- [ ] Detail renders only approved safe title/description/work state/time/resource/deliverable context; task urgency remains database-derived and distinct from task status/priority.
- [ ] Safe task resources are intentional external links only. The application performs no remote URL operation, preview, proxy, upload, reachability assertion, or content inspection.
- [ ] The submission form accepts only raw exact Google Drive/Google Docs HTTPS URLs through the shared lexical validator/schema; invalid input is not normalized, fetched, or sent to the command.
- [ ] The Operator-specific Server Action derives the role/actor from session, validates only allowed browser input, finds the target through the safe Operator projection, and invokes only `submitDeliverableVersion()` for the mutation.
- [ ] The form renders a submit CTA only for a returned assigned production deliverable in `pending` or `changes_requested`; it offers no task-status, internal-review, Client-review, release, approval, delivery, or Client-submission control.
- [ ] A successful result is a command-created immutable successor version and authoritative `awaiting_internal_review` state. The UI confirms internal review only and refreshes affected Operator routes.
- [ ] The `changes_requested` revision path truthfully states that the replacement is a new immutable version returning to internal review; no `pending → awaiting_client_review` or other re-review bypass is introduced.
- [ ] Invalid, denied, stale, duplicate, conflict, and interrupted requests create no fake version/status/history, no persisted queue/cache, and no deferred replay.
- [ ] All new visible copy has exact `es-MX`/`en-US` parity. Primary interactions are keyboard-operable, focus-safe, screen-reader-labeled, non-color-dependent, mobile-first, and usable at 375px without horizontal scrolling.
- [ ] Only the focused tests and factual verification listed in Section 8 are required for this work item; no new broad test suite, Playwright, provider, hosted-environment, or sprint-closeout work is introduced.

---

## 10. Stop conditions and handoff

| Discovery | Required response |
| --- | --- |
| The required Section 3 migration/type baseline is absent, not applied, or inconsistent | Stop S05-03. Do not silently omit safe resources/specifications or add a base-table read. |
| The committed view/generated type lacks an approved required detail field | Stop the affected surface. Request a precise safe projection decision; do not use `any`, manual generated-type changes, internal query reuse, or client-side joining. |
| A route/action can read another Operator’s work, project-wide data, membership, Client data, internal notes/comments/feedback/audit data, or an unsafe resource | Block implementation. Correct the safe projection/query boundary and re-verify; hiding the field in UI is insufficient. |
| The RPC contract differs from the pending/changes-requested production submission lifecycle stated here | Stop. Record the exact migration/type/command discrepancy and obtain an authoritative decision; do not imitate a lifecycle write. |
| Submission requires Drive API, remote URL access, preview, file upload/storage, provider authentication, or content inspection | Stop/defer. This violates the S05 URL-only boundary. |
| A requested behavior adds task status mutation, comments, PM workspace control, Client behavior, review/release/delivery, offline queue/cache, or provider dispatch | Defer to its owning work item/epic. Do not broaden S05-03. |
| A safe error mapping would require rendering raw Supabase/RPC text or sensitive identifiers | Use stable localized code-based recovery copy. If a meaningful safe mapping cannot be made, report the gap rather than leaking detail. |
| Focused tests expose false success, duplicate command invocation, unsafe target lookup, route disclosure, broken localization parity, inaccessible primary action, or a re-review bypass | Block S05-03 until corrected and re-verified. |

### Handoff to S05-04/S05-07

S05-03 leaves:

- a canonical safe Operator task-detail URL and task-card navigation path;
- one reusable Operator-safe current-task/deliverable lookup boundary over `operator_agenda_view`;
- an Operator-owned production submission action that remains distinct from PM/Admin wrappers;
- truthful immutable-version/internal-review submission behavior with no Client shortcut; and
- focused application evidence for safe detail, submission, error, localization, and accessibility behavior.

S05-04 through S05-06 must not reuse this Operator query/action boundary for Client UI. S05-07 owns sprint-level manual role-isolation journeys, full integrated verification, closeout documentation, and the aggregated changelog record.
