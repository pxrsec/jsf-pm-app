---
document_id: S09-04-TASK-DELIVERABLES-REFINEMENT-IMPLEMENTATION-SPEC-01
sprint_id: S09
work_item: S09-04
status: draft-pending-project-owner-review
created_at: 2026-08-27T12:00:17-06:00
branch: feature/tasks-deliverables-refinement
target_environment: jsf-pm-dev
required_applied_migrations:
  - supabase/migrations/20260827123000_s09-04-task-deliverable-bundle-and-workflow-integrity.sql
---

# S09-04 — Task and Deliverable Creation Refinement

## 1. Objective

Correct the task/deliverable creation workflow so authorized Admins and project PM Leads can:

1. Create a task alone, preserving the existing flexible workflow.
2. Create a task together with **zero to twenty** related deliverables in one dialog and one atomic server command.
3. Add a deliverable later from the Deliverables tab to any eligible existing task, including a task originally created without deliverables.
4. See and select both `internal_work` and `client_request` tasks in the standalone related-task control, with deliverable workflow, fields, and assignee eligibility derived from that task’s type.
5. Never assign an internal-work task/deliverable to a Client member, or a client-request task/deliverable to an internal PM/Operator member.

This replaces the broken current behavior in which the task dialog cannot add deliverables, the standalone dialog filters to `has_deliverables = true`, every visible deliverable is forced into the production workflow, and the UI exposes a submission deadline that the production schema rejects.

## 2. Scope and authority

### In scope

- Task-create dialog information architecture and combined creation flow.
- Multiple draft deliverables during task creation.
- A task-type-aware assignee selector shared by task and deliverable creation.
- Standalone deliverable creation for both task types.
- Clear workflow-specific deadline fields and localized inline help.
- One reviewed forward migration to preserve database-side integrity and introduce an atomic combined creation RPC.
- Regenerated Supabase TypeScript declarations, unchanged from MCP output.
- Focused schemas, commands/actions, UI tests, localization, typecheck, lint, and manual journeys.

### Explicitly out of scope

- Changing task status transitions, submission/review/delivery transitions, notification behavior, client portal routes, calendar behavior, metrics, project membership administration, provider activation, or the Google Drive submission policy.
- Changing the existing task-edit flow to change `task_type`; task type remains immutable after creation.
- Bulk task/deliverable import, templates, cloning, attachments, or a broad workspace redesign.
- Changing who may create work: the accepted server authority remains **Admin** or an active **PM Lead for the project**. “PM” in the UI copy means an authorized PM planner, not a blanket bypass of project operational authorization.
- Altering existing deliverable records, other than the trigger behavior needed for future inserts/updates.

## 3. Current-state diagnosis

Repository inspection establishes the following defects and constraints:

| Area | Current behavior | Defect |
| --- | --- | --- |
| Task creation | `TaskCreateDialog` creates only `tasks`; no child-deliverable draft state exists. | Users must leave the task flow to create related work. |
| Task assignees | `TaskAssigneeSelect` lists all active project members regardless of `task_type`. | It visually permits invalid assignments; only the database trigger rejects them. |
| Standalone related task | `DeliverableCreateDialog` filters `tasks` to `has_deliverables = true`. New ordinary tasks default to `false`; task creation has no way to set it. | Legitimate tasks disappear from the dropdown. |
| Standalone workflow | `CreateDeliverableSchema` accepts only `workflow_type: "production"`; the dialog filters assignees to PM/Operator capacities and renders all three deadlines. | A Client cannot receive a deliverable for a `client_request` task. |
| Database trigger | `private.sync_and_validate_deliverable()` treats `has_deliverables` as a hard admission gate and permits a production deliverable beneath a client-request task. | Database semantics do not match the requested task-type boundary. |
| Deadlines | Production rows require internal-review and client-delivery deadlines, and the DB constraint requires `submission_deadline_at IS NULL`. Client-submission rows require only `submission_deadline_at`. | The production UI shows an invalid, misleading “submission deadline” field. |

The generated schema already contains the needed entities and enums: `tasks.task_type`, `deliverables.workflow_type`, `project_members.member_type`, and the three deadline columns. New columns or enums are not needed.

## 4. Canonical workflow model

### 4.1 Task type controls deliverable workflow and capacity

The parent task is the authoritative workflow discriminator. The client must derive options from it; the database must enforce the same result independently.

| Parent task type | Parent task assignee | Deliverable workflow | Deliverable assignee | Required deadline fields | Forbidden deadline fields |
| --- | --- | --- | --- | --- | --- |
| `internal_work` | Active project `pm_lead`, `pm_watcher`, or `operator` | `production` | Active project `pm_lead`, `pm_watcher`, or `operator` | `internal_review_deadline_at`; on a client project, `client_delivery_deadline_at` on/after the review deadline | `submission_deadline_at` |
| `client_request` | Active project `client` | `client_submission` | Active project `client` | `submission_deadline_at` | `internal_review_deadline_at`, `client_delivery_deadline_at` |

A `client_request` task remains valid only on a client project with a linked client organization, as current task validation requires. A client-submission deliverable additionally requires that same client-project readiness boundary.

### 4.2 Internal-project production deliverables

An internal-work task may receive a production deliverable on an internal or client project:

- Every production deliverable requires an internal-review deadline.
- On a client project, it also requires a client-delivery deadline no earlier than internal review.
- On an internal project, client delivery is irrelevant and therefore hidden and stored as `NULL`.

This is the minimum consistent model for the requested “internal work task + deliverable” convenience flow. It retains the established client-facing production gates and does not invent a client-delivery date for internal work.

### 4.3 `has_deliverables` compatibility rule

`tasks.has_deliverables` must no longer block later deliverable creation. It becomes only a positive denormalized marker: inserting a child deliverable sets it to `true`; a task created with at least one bundle child begins `true`.

No UI control exposes this obsolete gate. A task without current deliverables remains selectable in the standalone dialog. The implementation does not claim that `false` proves historical absence after data repair/archival; current child rows are the authoritative relation.

## 5. UX contract

### 5.1 Task-create dialog

The existing task dialog remains the single task-entry surface. Its visual order is:

1. **Task type** segmented control (`Internal work` / `Client request`; Client request is disabled on an internal project with the existing explanation).
2. **Task details:** title, description, priority, task deadline.
3. **Task assignee:** label must explicitly say “Task assignee.” Its menu contains only compatible active project members for the selected task type.
4. **Deliverables section:** initially collapsed/absent except for a secondary `Add deliverable` button.
5. **One draft deliverable card per click**, in insertion order. A draft can be removed before submission. There is no arbitrary “related task” selector in this dialog.
6. Cancel/Create controls.

When there are draft child cards, the section title includes their count. The related-task context is a compact non-editable line such as **“Will be linked to this task when created.”** It must not repeat project ID, task type, task title, or a selectable task field.

### 5.2 Draft deliverable card

Each card contains only fields that are not already task-level facts:

| Field | Internal-work / production card | Client-request / client-submission card |
| --- | --- | --- |
| Title | required | required |
| Specifications | required | required |
| Assignee control | Defaults to “Same as task assignee.” When disabled, reveal a **Deliverable assignee** selector of compatible internal members. | Defaults to “Same as task assignee.” When disabled, reveal a **Deliverable assignee** selector of compatible Client members. |
| Deadline(s) | Internal review required; client delivery required only on client projects | Submission deadline required |
| Related task | Non-editable inherited context | Non-editable inherited context |

The “Same as task assignee” toggle prevents redundant duplicate fields in the common case while preserving multi-contributor delivery planning. The task field label is “Task assignee”; an overridden child label is “Deliverable assignee.”

A task-assignee change updates cards still marked “Same as task assignee.” Overridden cards retain their distinct assignee. If the task type changes while drafts exist, show a destructive-change confirmation; accepting it clears all draft deliverables and the incompatible assignee selection before the new type is applied. Never silently reinterpret or submit an internal draft as a client submission, or vice versa.

### 5.3 Combined submission behavior

- With no draft deliverables, the dialog uses the existing task-only create path.
- With one or more draft deliverables, it calls `create_task_with_deliverables` once.
- The RPC transaction either creates the task and every card or creates nothing. The dialog remains open on failure, preserves drafts, maps safe returned errors to the form, and never presents a partial-success toast.
- On success, reset and close the dialog, refresh Admin/PM project workspace paths, and show one localized success message reporting the task and count of deliverables created.
- Disable all mutable controls during submission; keyboard focus returns to the invoking control after the dialog closes.

### 5.4 Standalone Deliverables-tab dialog

Separate creation is retained for tasks that need new deliverables later.

1. The related-task dropdown lists every non-deleted task supplied for the current project; it does **not** filter by `has_deliverables`.
2. Each option displays task title plus a localized type badge/text. The selected task is the source of truth for all following fields.
3. Selecting a task derives workflow, clears incompatible stale form values, filters assignees, and shows a concise workflow explanation.
4. The assignee menu contains only the capacities in Section 4.1. It initially defaults to the task assignee **only if that assignee remains compatible**; otherwise it selects no person and requires an explicit valid choice.
5. The dialog displays only deadline fields applicable to the selected workflow. It never renders all three at once.
6. No user-selectable workflow-type control is exposed. The relationship determines it.
7. On submission, the existing standalone action creates exactly one deliverable; the database trigger sets the parent marker and verifies project, task, workflow, deadline, and assignee integrity.

Empty-state copy should say no eligible task exists only when no non-deleted project tasks exist, not because no task had the historic boolean flag.

## 6. Deadline semantics and labels

The existing Spanish “Fecha límite de envío” maps to `submission_deadline_at`. It is **not** a third production milestone. It is the deadline by which the Client assignee must submit their requested material/version for a `client_submission` deliverable attached to a `client_request` task.

Therefore:

- Client submission: show **Submission deadline / Fecha límite de envío** with help text stating it is the Client’s deadline to send the requested material.
- Production deliverable: do not render this field. Show **Internal review deadline / Fecha límite de revisión interna** and, for client projects, **Client delivery deadline / Fecha límite de entrega a cliente**.
- Internal project production deliverable: show only the internal-review deadline; client-delivery is hidden and `NULL`.

This directly explains why the current dialog is confusing: it renders submission deadline for a production deliverable even though the existing database production constraint requires it to be null.

## 7. Database migration

### 7.1 Required source

`supabase/migrations/20260827123000_s09-04-task-deliverable-bundle-and-workflow-integrity.sql`

The migration source is drafted with this specification. It is **not applied** by creating the file. Before remote application, the Project Owner must review the exact source, commit it, explicitly authorize the `jsf-pm-dev` target, apply it through Supabase MCP, regenerate `src/lib/database.types.ts` unchanged, and commit generated types separately if the selected workflow requires it.

### 7.2 Migration responsibilities

1. Replace `deliverables_production_ck` so a production deliverable requires internal review, forbids submission deadline, and permits a nullable client-delivery field. The trigger supplies project-aware required/forbidden behavior.
2. Replace `private.sync_and_validate_deliverable()` so it:
   - derives `project_id` from the parent task;
   - rejects deleted/cancelled task/project state and inactive/non-member assignees;
   - maps `internal_work → production → internal capacity`;
   - maps `client_request → client_submission → client capacity`;
   - enforces the exact per-project deadline contract;
   - sets `tasks.has_deliverables = true` without using it as a prerequisite.
3. Add `public.create_task_with_deliverables(...)`, a `SECURITY DEFINER` transactional command with fixed search path, caller-derived Admin/PM-Lead authority, maximum twenty child payload entries, and authenticated-only execute permission.
4. Let the normal task and deliverable triggers continue enforcing membership and task/project compatibility. The RPC is convenience/atomicity; it is not a bypass.

### 7.3 RPC response contract

The RPC returns exactly:

```ts
{
  task: Database["public"]["Tables"]["tasks"]["Row"];
  deliverable_ids: string[];
}
```

The application validates the response before using it. It does not display raw database errors, trust raw IDs as user-visible content, or bypass the existing action/session boundary.

### 7.4 Generated types

After a successful development application, invoke Supabase MCP generation against that resulting schema and write `src/lib/database.types.ts` **unchanged**. The generated function argument/return declarations are source of truth. Do not hand-edit them to make typecheck pass.

## 8. Application implementation targets

| Target | Required change |
| --- | --- |
| `src/lib/projects/schemas.ts` | Add a bounded discriminated `CreateTaskWithDeliverablesSchema`; preserve task-only schema compatibility. Validate child fields, type-specific deadline nullability, and max 20 items. |
| `src/lib/deliverables/schemas.ts` | Replace production-only creation contract with a task-derived union accepting `production` and `client_submission`; retain edit restrictions appropriate to the persisted workflow. |
| `src/lib/projects/commands.ts` | Add a typed RPC adapter for bundled creation; validate its DTO rather than casting. |
| `src/lib/projects/task-actions.ts` | Add combined action with `requireSession`, server validation, role/capacity ownership, safe error mapping, and Admin/PM localized workspace revalidation. Preserve task-only action. |
| `src/lib/deliverables/auth-checks.ts` | Make eligibility task-type-aware; remove `has_deliverables` as an admission condition; validate Client readiness for client submissions and internal readiness for production. |
| `src/lib/deliverables/commands.ts` / `actions.ts` | Persist task-derived workflow, permit Client submission creation through the authorized standalone path, and make update-assignee validation task-type-aware. |
| `src/components/shared/projects/project-tasks/task-assignee-select.tsx` | Accept an eligibility mode or prefiltered member list; never show incompatible capacities. Make placeholder/empty state explicit. |
| `src/components/shared/projects/project-tasks/task-create-dialog.tsx` | Implement the combined draft-card UX in Section 5. Keep the component below the repository’s 400-line limit by extracting focused child card/state components. |
| `src/components/shared/projects/project-deliverables/deliverable-create-dialog.tsx` | Include every project task; derive workflow, capacities, assignee default, fields, and help text from selected task. |
| `src/components/shared/projects/project-deliverables/deliverable-edit-dialog.tsx` | Render/edit only deadline fields valid for the persisted workflow; never expose a production submission deadline or client-submission production dates. |
| `src/lib/database.types.ts` | Owner-generated only after migration application. |
| `messages/en-US.json`, `messages/es-MX.json` | Add exact parallel localized copy for the new labels, type/workflow descriptions, inherited relation line, same-assignee toggle, no-compatible-member state, type-change warning, deadline help, and success/error messages. Do not leave Spanish-only wording in components. |
| Focused tests under `__tests__/projects/` and `__tests__/deliverables/` | Update/add only contracts affected by this behavior. |

No browser Supabase writes, service-role access, dynamic arbitrary SQL, raw database errors, hidden duplicate controls, or client-side authorization inference are permitted.

## 9. Server and database invariants

1. The browser is never authoritative for task type, workflow type, project relation, member capacity, or deadline validity.
2. The standalone dialog’s selected task and bundle RPC both rely on database enforcement after UI filtering.
3. A `client_request` task can never produce a `production` deliverable or have an internal assignee.
4. An `internal_work` task can never produce a `client_submission` deliverable or have a Client assignee.
5. Forged `project_id` on a deliverable is overwritten from the parent task by the database trigger.
6. A task created without child cards remains valid and can receive deliverables later.
7. A combined create is atomic. Any invalid child rolls back the task and all sibling children.
8. Existing record visibility and lifecycle rules remain unchanged; only creation/edit form admissibility changes.
9. Date comparisons use stored `timestamptz`; local datetime inputs must be converted to offset-bearing ISO strings before action validation.
10. User-visible error messages are localized safe categories; diagnostics remain server-side and do not disclose unauthorized project/member state.

## 10. Accessibility and responsive requirements

- The task-type control is a labeled, keyboard-operable single-choice control with a programmatic selected state.
- Add/remove deliverable controls have explicit accessible names including card ordinal where required.
- A draft card is a labelled region; validation summary and field errors are announced without focus traps.
- Disabled Client request selection on internal projects retains the existing accessible explanation.
- The mobile layout is a single-column stacked form. No horizontal clipping of assignee menus, date controls, or cards.
- Avoid duplicated mounted controls across breakpoints. Each logical input has one live accessible control.
- Do not use color alone to distinguish task type or invalid state.

## 11. Verification

### Automated

Run only the focused checks approved for S09 work:

```bash
npm run typecheck
npm run lint
```

Update focused unit/component tests only where existing coverage owns these contracts; do not add E2E, coverage, broad `npm test`, `npm run verify`, or full build requirements.

Focused assertions must cover:

1. `internal_work` filters task and deliverable assignees to PM/Operator capacities.
2. `client_request` filters both to Client capacity.
3. A client-request card exposes submission deadline only; a production card exposes the applicable internal-review/client-delivery fields only.
4. New task bundle payload preserves inherited assignee unless an explicit child override exists.
5. Type change with existing draft cards requires confirmation and clears drafts only after acceptance.
6. Standalone task options include a non-deleted task whose existing `has_deliverables` is false.
7. Standalone selection derives workflow/assignee/deadlines from task type and rejects stale incompatible field values.
8. Combined action handles safe RPC success/failure and does not report partial success.

### Manual authenticated journeys

1. **Client project — internal work:** Admin or active PM Lead creates an internal-work task and two production deliverables, leaving one inherited and overriding one to another internal member. Verify only internal members are selectable, client submission deadline is absent, and the workspace displays all links/assignees.
2. **Client project — client request:** Create a client-request task and one client-submission deliverable. Verify only Client members are selectable and only submission deadline appears. Verify the Client sees the existing task/submission flow without gaining production permissions.
3. **Standalone later addition:** Create a task alone, then use Deliverables tab to select it and add a compatible deliverable. Verify it was selectable despite previously having no deliverables.
4. **Invalid boundary attempt:** Change type after drafting a child and verify confirmation/clearing; verify a forged or stale incompatible assignee/workflow returns a safe failure and creates no combined records.
5. **Internal project:** Create an internal-work task with a production deliverable. Verify internal-only assignment, internal-review deadline, no client-delivery/submission deadline, and no Client task option.

The Project Owner separately verifies the migration in `jsf-pm-dev`: function ownership/grants/search path, rollback on invalid child, assignment boundary for both task types, trigger-derived project ID, later standalone addition, production/client-submission constraint behavior, and no mutation from unrelated read paths.

## 12. Completion criteria

1. Authorized planners can intentionally choose task-only or task-plus-multiple-deliverables creation from one dialog.
2. The common inherited-assignee path has no redundant second assignee field; an override is explicit and clearly labelled.
3. Standalone creation remains available and lists compatible internal-work and client-request tasks without the obsolete boolean gate.
4. Assignee menus and server/database enforcement agree with the task-type matrix.
5. Every deadline field is semantically correct, workflow-specific, localized, and never shown when the stored contract forbids it.
6. Combined creation is atomic, existing independent creation remains functional, and task type cannot be silently transformed after draft data exists.
7. Migration source is reviewed/applied only through the stated schema workflow; generated types follow only after application.
8. Typecheck, lint, focused contract tests, and manual journeys produce factual recorded evidence.

## 13. Implementation order

1. Obtain Project Owner acceptance of this draft, especially the Section 4.2 internal-project production-deliverable decision.
2. Review the migration source; commit it and explicitly authorize application to `jsf-pm-dev`.
3. Apply through Supabase MCP; regenerate and commit generated declarations unchanged.
4. Implement schemas/adapters/actions before UI components.
5. Implement the shared type-aware assignee selector, bundled task dialog, then standalone dialog/edit alignment.
6. Add locale parity and focused tests.
7. Run required checks and the five manual journeys.

Until Step 2 is explicitly authorized, this specification and migration are planning artifacts only; no remote database state has been changed.
