# S04-02 — Reconcile the First Workspace Command Boundary

**Sprint:** S04  
**Work Item:** S04-02  
**Status:** Ready for implementation  
**Last reviewed:** 2026-08-19  
**Spec authority:** Sprint plan `s04-e04-e05-project-workspace-and-production-deliverable-lifecycle-sprint-plan.md`, Section 5 (work item S04-02).

---

## 1. Purpose and scope

This spec governs the bounded design and reconciliation task that must be completed **before any S04-03 through S04-07 route or UI code is written**. It establishes:

1. A canonical, exact map from every Sprint 04 mutation and read to the committed database command (RPC) or safe view projection that backs it.
2. The feature data-layer architecture (`src/lib/projects/`, `src/lib/deliverables/`, `src/lib/comments/`, `src/lib/clients/`) that provides typed server reads, Zod input schemas, command adapter functions, and safe error mapping.
3. The route-handler / server-action contract pattern (request validation → actor derivation → command call → safe response) applied consistently across any new `/api/v1` endpoints or server action modules that S04 actually requires.
4. A formal record of discovered gaps, invariant violations, or schema discrepancies that constitute stop conditions for dependent work items.

**The work ends when:**

- Every Sprint 04 operation in the command/representation table (Section 4) has a confirmed committed command or safe projection and a corresponding typed adapter.
- The `src/lib/projects/`, `src/lib/deliverables/`, `src/lib/comments/`, and `src/lib/clients/` feature data layers exist with their full schema/adapter/read/error-mapping surface.
- Any route handlers or mutation boundaries required by the confirmed command map are drafted and verified to compile clean with strict TypeScript.
- Stop conditions and schema discoveries are explicitly recorded in Section 9 so that S04-03 and later proceed only against confirmed database boundaries.

### Explicitly out of scope for this work item

- Building any route UI, page component, form, or Kanban interaction (S04-03 through S04-07).
- Supabase MCP operations, schema migrations, RLS changes, or type regeneration.
- Editing `src/lib/database.types.ts` (MCP-generated; never manually edited).
- Implementing the Client portal, Operator execution portal, or E6/E7/E8 boundaries.
- Adding notification delivery, webhooks, or background worker configuration.

---

## 2. Baseline: authoritative schema facts

All facts below are derived directly from the committed `src/lib/database.types.ts` and the migration file `supabase/migrations/20260818143500_s02_e02_authoritative_data_platform.sql`. These are the ground truth. If any prose document, previous spec, or AI-produced plan contradicts these facts, **the generated types and committed SQL win**.

### 2.1 Enums (authoritative)

```ts
app_role                  "admin" | "pm" | "operator" | "client"
project_type              "client" | "internal"
project_status            "planning" | "in_progress" | "paused" | "completed" | "cancelled"
project_member_type       "pm_lead" | "pm_watcher" | "operator" | "client"
task_type                 "internal_work" | "client_request"
task_status               "pending" | "in_progress" | "in_review" | "completed" | "blocked"
task_priority             "low" | "medium" | "high" | "blocking"
deliverable_status        "pending" | "awaiting_internal_review" | "awaiting_client_review"
                          | "approved" | "changes_requested" | "delivered" | "submitted"
deliverable_workflow_type "production" | "client_submission"
review_decision           "approved" | "changes_requested"
review_stage              "internal" | "client"
collaboration_author_capacity  "admin" | "pm_lead" | "pm_watcher" | "operator"
collaboration_target_type      "project" | "task" | "deliverable"
link_report_status        "open" | "resolved" | "dismissed"
entity_type               "profile" | "client" | "project" | "project_member" | "task"
                          | "deliverable" | "deliverable_version" | "feedback"
                          | "calendar_event" | "notification" | "invite_token"
                          | "collaboration_comment" | "link_report"
submission_provider       "google_drive" | "dropbox" | "onedrive" | "wetransfer"
                          | "frame_io" | "other_https"
```

### 2.2 Core tables used by E4/E5 (key columns only)

**`projects`**

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid PK | No | Auto-generated default |
| `name` | text | No | Project display name |
| `project_type` | `project_type` enum | No | `client` or `internal` |
| `status` | `project_status` enum | No | Default: `planning` |
| `client_id` | uuid FK → `clients.id` | Yes | Required if `project_type = 'client'`; prohibited if `internal` |
| `client_scope` | text | Yes | Client-visible summary |
| `internal_description` | text | No | Detailed internal context |
| `deadline_at` | timestamptz | No | Mandatory target completion |
| `drive_folder_url` | text | Yes | Google Drive folder link |
| `completed_at` | timestamptz | Yes | Set by `transition_project_status` |
| `archived_at` | timestamptz | Yes | Set by `soft_delete_entity` |
| `created_by` / `updated_by` | uuid | No / Yes | Audit user references |
| `created_at` / `updated_at` | timestamptz | No | Automatic timestamps |

**`project_members`**

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid PK | No | Auto-generated default |
| `project_id` | uuid FK → `projects.id` | No | Target project |
| `user_id` | uuid FK → `profiles.id` | No | Assigned user |
| `member_type` | `project_member_type` enum | No | `pm_lead`, `pm_watcher`, `operator`, `client` |
| `is_primary` | boolean | No | Default `false`. Exactly one primary `pm_lead` per project |
| `receives_notifications` | boolean | No | Default `true` |
| `joined_at` | timestamptz | No | Default `now()` |
| `deleted_at` | timestamptz | Yes | Soft-delete support |

**`tasks`**

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid PK | No | Auto-generated default |
| `project_id` | uuid FK → `projects.id` | No | Parent project |
| `assignee_id` | uuid FK → `profiles.id` | No | Active project member with compatible role |
| `title` | text | No | Task name |
| `description` | text | No | Task details |
| `task_type` | `task_type` enum | No | `internal_work` or `client_request` |
| `status` | `task_status` enum | No | Default `pending` |
| `priority` | `task_priority` enum | No | `low`, `medium`, `high`, `blocking` |
| `deadline_at` | timestamptz | No | Required task deadline |
| `has_deliverables` | boolean | No | Set when deliverable attached |
| `started_at` / `completed_at` | timestamptz | Yes | Managed by state machine |
| `deleted_at` | timestamptz | Yes | Soft-delete support |

**`deliverables`**

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid PK | No | Auto-generated default |
| `project_id` | uuid FK → `projects.id` | No | Must be `client` project for `production` workflow |
| `task_id` | uuid FK → `tasks.id` | No | Associated task |
| `assignee_id` | uuid FK → `profiles.id` | No | Task/deliverable contributor |
| `title` | text | No | Deliverable name |
| `specifications` | text | No | Requirements/guidance |
| `workflow_type` | `deliverable_workflow_type` enum | No | `production` (internal) or `client_submission` |
| `status` | `deliverable_status` enum | No | Default `pending` |
| `current_version_number` | integer | No | Default `0`, increments on each submission |
| `submission_deadline_at` | timestamptz | Yes | Expected upload date |
| `internal_review_deadline_at` | timestamptz | Yes | Internal signoff target |
| `client_delivery_deadline_at` | timestamptz | Yes | Client delivery target |
| `is_stalled` | boolean | No | Inactivity indicator |
| `last_activity_at` | timestamptz | No | Activity tracking timestamp |
| `approved_at` / `delivered_at` | timestamptz | Yes | Lifecycle completion timestamps |
| `deleted_at` | timestamptz | Yes | Soft-delete support |

**`deliverable_versions`** *(immutable — no Update shape)*

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid PK | No | Auto-generated default |
| `deliverable_id` | uuid FK → `deliverables.id` | No | Parent deliverable |
| `version_number` | integer | No | Exact 1-based version number |
| `submission_url` | text | No | Google Drive HTTPS share link |
| `submission_provider` | `submission_provider` enum | No | `google_drive` for production workflow |
| `submitted_by` | uuid FK → `profiles.id` | No | Submitting actor |
| `submission_note` | text | Yes | Submitter notes |
| `submitted_at` | timestamptz | No | Default `now()` |

**`deliverable_feedback`** *(immutable — no Update shape)*

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid PK | No | Auto-generated default |
| `deliverable_id` | uuid FK → `deliverables.id` | No | Target deliverable |
| `version_id` | uuid FK → `deliverable_versions.id` | No | Exact version evaluated |
| `stage` | `review_stage` enum | No | `internal` (Sprint 04) or `client` (E7) |
| `decision` | `review_decision` enum | No | `approved` or `changes_requested` |
| `comments` | text | Yes | Mandatory when `decision = 'changes_requested'` |
| `reviewed_by` | uuid FK → `profiles.id` | No | Reviewer profile |
| `reviewed_at` | timestamptz | No | Default `now()` |

**`collaboration_comments`**

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid PK | No | Auto-generated default |
| `project_id` | uuid FK → `projects.id` | No | Target project scope |
| `target_type` | `collaboration_target_type` enum | No | `project`, `task`, `deliverable` |
| `target_id` | uuid | No | Polymorphic ID matching `target_type` |
| `author_id` | uuid FK → `profiles.id` | No | Commenting user |
| `author_capacity_snapshot` | `collaboration_author_capacity` enum | No | Derived server-side from project membership |
| `body` | text | No | Comment text |
| `deleted_at` / `edited_at` | timestamptz | Yes | Soft-delete / edit tracking |

**`clients`**

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid PK | No | Auto-generated default |
| `display_name` | text | No | Common business name |
| `legal_name` | text | No | Official corporate name |
| `slug` | text | No | URL-safe unique slug |
| `is_active` | boolean | No | Default `true` |
| `default_drive_folder_url` | text | Yes | Default storage folder |
| `notes` | text | Yes | Internal notes |
| `deleted_at` | timestamptz | Yes | Soft-delete support |

### 2.3 Safe view projections (authoritative — used by reads)

| View | Role-safe for | Key columns |
|---|---|---|
| `client_project_view` | client scope | `id, name, status, client_id, client_name, client_scope, deadline_at, drive_folder_url, completed_at, archived_at, last_deliverable_activity_at` |
| `project_completion_cycles_view` | admin/pm | `project_id, project_name, cycle_number, completed_at, completed_by, reopened_at, reopened_by, reopen_reason, override_confirmed, unfinished_task_count, unfinished_deliverable_count, current_project_status, cycle_duration_days` |
| `client_task_view` | client scope | `id, project_id, project_name, title, description, status, priority, assignee_id, deadline_at, started_at, completed_at, resources, child_submission_count` |
| `client_deliverable_view` | client scope | `id, project_id, project_name, task_id, title, specifications, status, current_version_number, current_submission_url, current_submission_provider, current_submission_note, current_submitted_at, approved_at, delivered_at, client_feedback_history, client_delivery_deadline_at` |
| `client_submission_view` | client scope | `id, project_id, project_name, task_id, task_title, title, specifications, status, current_version_number, current_submission_url, current_submission_provider, current_submission_note, current_submitted_at, last_activity_at, assignee_id, submission_deadline_at` |
| `operator_agenda_view` | operator/pm | `task_id, task_title, task_description, task_status, task_priority, task_deadline_at, task_started_at, project_id, project_name, deliverable_id, deliverable_title, deliverable_status, deliverable_workflow_type, current_version_number, internal_review_deadline_at, client_delivery_deadline_at, urgency_category` |
| `deliverable_cycle_metrics_view` | admin/pm analytics | `deliverable_id, title, status, workflow_type, project_id, current_version_number, first_submitted_at, client_review_started_at, client_acted_at, client_review_hours, delivered_at` |

### 2.4 Committed public RPCs (authoritative — the command layer)

Every public command enforces `security definer` + internal `private.*` authorization checks. **No application code may bypass these.**

| RPC Name | Args | Returns | Auth |
|---|---|---|---|
| `get_project_completion_readiness` | `p_project_id uuid` | `jsonb` | Admin or `is_project_pm` |
| `transition_project_status` | `p_project_id, p_next_status, p_confirm_unfinished?, p_reopen_reason?` | `jsonb` | Admin or `is_project_lead` |
| `recover_project_status` | `p_project_id, p_target_status, p_reason` | `jsonb` | Admin only |
| `transition_task_status` | `p_task_id, p_next_status, p_reopen_reason?` | `jsonb` | Lead/Admin or task assignee (role-constrained) |
| `submit_deliverable_version` | `p_deliverable_id, p_submission_url, p_submission_note?` | `jsonb` | Deliverable assignee or Lead/Admin; `production` workflow only; URL must match `^https://(drive\.google\.com|docs\.google\.com)/` |
| `review_deliverable` | `p_deliverable_id, p_stage, p_decision, p_comments?` | `jsonb` | Internal stage: Lead/Admin; Client stage: `is_project_client` |
| `mark_deliverable_delivered` | `p_deliverable_id` | `jsonb` | Admin or Lead; deliverable must be `approved` |
| `create_collaboration_comment` | `p_project_id, p_target_type, p_target_id, p_body` | `jsonb` | Non-client project member |
| `report_broken_link` | `p_deliverable_id, p_version_id, p_reason` | `jsonb` | Project member |
| `soft_delete_entity` | `p_entity_id, p_entity_type, p_reason?` | `boolean` | Role-gated internally |
| `restore_entity` | `p_entity_id, p_entity_type, p_reason?` | `boolean` | Role-gated internally |

> **IMPORTANT — Database-Enforced Invariants via Triggers:**
> 1. `validate_project_memberships()`: Guarantees at least one active PM Lead, exactly one primary PM Lead, and capacity compatibility.
> 2. `validate_task()`: Enforces assignee active membership and capacity compatibility (`internal_work` assigned to internal roles, `client_request` to client roles).
> 3. `sync_and_validate_deliverable()`: Enforces that `production` deliverables exist only on `client` projects and maintains task/deliverable consistency.
> 4. `prevent_immutable_mutation()`: Rejects updates/deletions on audit logs, deliverable versions, and deliverable feedback.

---

## 3. Architecture: feature data layer

### 3.1 Directory structure

```
src/lib/
├── projects/
│   ├── queries.ts          # Typed server reads (select explicit columns, role-safe)
│   ├── schemas.ts          # Zod input schemas for all project/membership/task mutations
│   ├── commands.ts         # Adapter functions calling RPCs or typed inserts/updates
│   └── errors.ts           # Safe error mapping from Supabase errors to app error codes
│
├── deliverables/
│   ├── queries.ts          # Typed server reads for deliverables, versions, feedback
│   ├── schemas.ts          # Zod schemas for deliverable mutations
│   ├── commands.ts         # Adapter functions for submit/review/deliver/link-report
│   ├── validators.ts       # Google Drive URL validator (client and server)
│   └── errors.ts           # Safe error mapping for deliverables
│
├── comments/
│   ├── schemas.ts          # Zod schemas for collaboration comment mutations
│   ├── queries.ts          # Typed reads for comments by target
│   └── commands.ts         # Adapter functions for create_collaboration_comment
│
└── clients/
    └── queries.ts          # Typed reads for client org selection & creation
```

> **Placement rule:** these files are pure server-side TypeScript. They import `createClient` from `@/lib/supabase/server` and the `Database` type from `@/lib/database.types`. They must never be imported from a client component.

### 3.2 Standard type exports

Each feature module exports clean TypeScript interfaces derived from `Database` types:

```ts
import type { Database } from "@/lib/database.types";

// Tables
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
export type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"];
export type ProjectMember = Database["public"]["Tables"]["project_members"]["Row"];
export type ProjectMemberInsert = Database["public"]["Tables"]["project_members"]["Insert"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
export type Deliverable = Database["public"]["Tables"]["deliverables"]["Row"];
export type DeliverableInsert = Database["public"]["Tables"]["deliverables"]["Insert"];
export type DeliverableUpdate = Database["public"]["Tables"]["deliverables"]["Update"];
export type DeliverableVersion = Database["public"]["Tables"]["deliverable_versions"]["Row"];
export type DeliverableFeedback = Database["public"]["Tables"]["deliverable_feedback"]["Row"];
export type CollaborationComment = Database["public"]["Tables"]["collaboration_comments"]["Row"];
export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Views
export type ProjectCompletionCyclesView = Database["public"]["Views"]["project_completion_cycles_view"]["Row"];
export type ClientProjectView = Database["public"]["Views"]["client_project_view"]["Row"];
export type ClientTaskView = Database["public"]["Views"]["client_task_view"]["Row"];
export type ClientDeliverableView = Database["public"]["Views"]["client_deliverable_view"]["Row"];

// Enums
export type ProjectStatus = Database["public"]["Enums"]["project_status"];
export type ProjectType = Database["public"]["Enums"]["project_type"];
export type ProjectMemberType = Database["public"]["Enums"]["project_member_type"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];
export type TaskType = Database["public"]["Enums"]["task_type"];
export type DeliverableStatus = Database["public"]["Enums"]["deliverable_status"];
export type DeliverableWorkflowType = Database["public"]["Enums"]["deliverable_workflow_type"];
export type ReviewDecision = Database["public"]["Enums"]["review_decision"];
export type ReviewStage = Database["public"]["Enums"]["review_stage"];
export type CollaborationTargetType = Database["public"]["Enums"]["collaboration_target_type"];
export type CollaborationAuthorCapacity = Database["public"]["Enums"]["collaboration_author_capacity"];
```

---

## 4. Canonical operation-to-command map

This is the authoritative mapping every subsequent S04 work item must follow. A command adapter for each row must exist before dependent UI or route code is written.

### 4.1 Project domain

| Operation | Command / Projection | Module | Notes |
|---|---|---|---|
| List projects (Admin) | `projects` table select with explicit columns | `src/lib/projects/queries.ts` → `listProjectsForAdmin()` | Select: `id, name, project_type, status, client_id, deadline_at, completed_at, archived_at, created_at`. Admin sees all non-deleted projects. |
| List projects (PM) | `project_members` join `projects` | `src/lib/projects/queries.ts` → `listProjectsForPm(userId)` | Only projects where `project_members.user_id = userId AND deleted_at IS NULL`. Same explicit columns. |
| Get project detail | `projects` join `project_members` join `profiles` | `src/lib/projects/queries.ts` → `getProjectDetail(projectId, actorId, actorRole)` | Must verify actor is Admin or active member; returns project + member list. |
| Get project completion cycles | `project_completion_cycles_view` | `src/lib/projects/queries.ts` → `getCompletionCycles(projectId)` | Used by S04-05 audit display. |
| Create project | `projects` typed insert via Supabase SSR | `src/lib/projects/commands.ts` → `createProject(input, actorId)` | Fields: `project_type`, `client_id`, `name`, `internal_description`, `deadline_at`, `drive_folder_url`. RLS + DB triggers enforce invariants. |
| Update project | `projects` typed update | `src/lib/projects/commands.ts` → `updateProject(projectId, input, actorId)` | Same field set minus `project_type` (immutable after creation). Actor must be Admin or Lead. |
| Soft-delete project | `soft_delete_entity(p_entity_id, 'project', reason?)` | `src/lib/projects/commands.ts` → `archiveProject(projectId, reason?)` | Calls public RPC. |
| Restore project | `restore_entity(p_entity_id, 'project', reason?)` | `src/lib/projects/commands.ts` → `restoreProject(projectId, reason)` | Admin only (enforced by RPC). |
| Transition project status | `transition_project_status(p_project_id, p_next_status, p_confirm_unfinished?, p_reopen_reason?)` | `src/lib/projects/commands.ts` → `transitionProjectStatus(input)` | Covers pause/resume/cancel and reopen. |
| Recover project from cancelled | `recover_project_status(p_project_id, p_target_status, p_reason)` | `src/lib/projects/commands.ts` → `recoverProjectStatus(input)` | Admin only. |
| Get completion readiness | `get_project_completion_readiness(p_project_id)` | `src/lib/projects/commands.ts` → `getCompletionReadiness(projectId)` | Returns structured `{ is_ready, unfinished_task_count, unfinished_tasks[], unfinished_deliverable_count, unfinished_deliverables[] }`. |
| Complete project | `transition_project_status(p_project_id, 'completed', p_confirm_unfinished, null)` | reuses `transitionProjectStatus` | UI must call `getCompletionReadiness` first, show warning if not ready, pass `confirm_unfinished=true` when user confirms. |
| Reopen project | `transition_project_status(p_project_id, 'in_progress', false, p_reopen_reason)` | reuses `transitionProjectStatus` | `reopen_reason` is required; RPC enforces non-empty. |

### 4.2 Membership domain

| Operation | Command / Projection | Module | Notes |
|---|---|---|---|
| List eligible PM users | `profiles` select where `role = 'pm' AND is_active = true AND deleted_at IS NULL` | `src/lib/projects/queries.ts` → `listEligiblePmUsers()` | Used to populate member-add select/combobox. |
| List eligible Operator users | `profiles` select where `role = 'operator' AND is_active = true AND deleted_at IS NULL` | `src/lib/projects/queries.ts` → `listEligibleOperators()` | |
| List eligible Client contacts | `client_contacts` join `profiles` for project's `client_id` | `src/lib/projects/queries.ts` → `listEligibleClientMembers(clientId)` | Only for `client` project type. |
| List project members | `project_members` join `profiles` where `project_id = X AND deleted_at IS NULL` | `src/lib/projects/queries.ts` → `getProjectMembers(projectId)` | Returns `member_type, is_primary, user_id, full_name, role, is_active`. |
| Add project member | `project_members` typed insert | `src/lib/projects/commands.ts` → `addProjectMember(input, actorId)` | Input: `project_id, user_id, member_type, is_primary?`. DB trigger `validate_project_memberships()` enforces Lead cardinality and primary-lead constraint. |
| Update member type/primary | `project_members` typed update | `src/lib/projects/commands.ts` → `updateProjectMember(memberId, input, actorId)` | Can change `member_type`, `is_primary`, `receives_notifications`. Trigger re-validates. |
| Remove project member | `soft_delete_entity(memberId, 'project_member', reason?)` | `src/lib/projects/commands.ts` → `removeProjectMember(memberId, reason?)` | Trigger re-validates Lead cardinality after soft-delete. |
| Set primary PM Lead | Uses `updateProjectMember` with `is_primary: true` on target | `src/lib/projects/commands.ts` → `setPrimaryPmLead(projectId, targetMemberId)` | Must update target to primary, then demote former primary if distinct. |

### 4.3 Client organization domain

| Operation | Command / Projection | Module | Notes |
|---|---|---|---|
| List active client orgs | `clients` select where `is_active = true AND deleted_at IS NULL` | `src/lib/clients/queries.ts` → `listActiveClients()` | Returns `id, display_name, legal_name, slug, default_drive_folder_url`. |
| Get client detail | `clients` select by `id` | `src/lib/clients/queries.ts` → `getClientById(clientId)` | |
| Create client org | `clients` typed insert | `src/lib/clients/queries.ts` → `createClient(input, actorId)` | Admin or PM Lead only. Fields: `display_name, legal_name, slug, notes, default_drive_folder_url?`. |
| List client contacts | `client_contacts` select where `client_id = X AND deleted_at IS NULL` | `src/lib/clients/queries.ts` → `listClientContacts(clientId)` | |

### 4.4 Task domain

| Operation | Command / Projection | Module | Notes |
|---|---|---|---|
| List tasks for project | `tasks` select where `project_id = X AND deleted_at IS NULL` | `src/lib/projects/queries.ts` → `listProjectTasks(projectId, filters?)` | Explicit columns: `id, project_id, assignee_id, title, description, task_type, status, priority, deadline_at, has_deliverables, started_at, completed_at`. |
| Get task detail | `tasks` join `profiles` for assignee | `src/lib/projects/queries.ts` → `getTaskDetail(taskId, actorId, actorRole)` | Verify actor has project membership. |
| List task resources | `task_resources` select where `task_id = X AND deleted_at IS NULL` | `src/lib/projects/queries.ts` → `listTaskResources(taskId)` | |
| Create task | `tasks` typed insert | `src/lib/projects/commands.ts` → `createTask(input, actorId)` | Fields: `project_id, title, description, task_type, priority, deadline_at, assignee_id`. DB trigger `validate_task()` checks assignee capacity. Default `status = 'pending'`. |
| Update task | `tasks` typed update | `src/lib/projects/commands.ts` → `updateTask(taskId, input, actorId)` | Same field set. Trigger re-validates assignee. |
| Move task status | `transition_task_status(p_task_id, p_next_status, p_reopen_reason?)` | `src/lib/projects/commands.ts` → `transitionTaskStatus(input)` | Valid internal transitions: `pending → in_progress | blocked`, `in_progress → pending | in_review | blocked`, `in_review → in_progress | completed`, `blocked → pending | in_progress`, `completed → in_progress` (Lead/Admin only + reason). |
| Soft-delete task | `soft_delete_entity(taskId, 'task', reason?)` | `src/lib/projects/commands.ts` → `archiveTask(taskId, reason?)` | |

### 4.5 Deliverable domain

| Operation | Command / Projection | Module | Notes |
|---|---|---|---|
| List deliverables for project | `deliverables` select where `project_id = X AND deleted_at IS NULL` | `src/lib/deliverables/queries.ts` → `listProjectDeliverables(projectId, filters?)` | Explicit columns: `id, project_id, task_id, assignee_id, title, specifications, workflow_type, status, current_version_number, submission_deadline_at, internal_review_deadline_at, client_delivery_deadline_at, is_stalled, last_activity_at, created_at`. |
| Get deliverable detail | `deliverables` + versions + feedback join | `src/lib/deliverables/queries.ts` → `getDeliverableDetail(deliverableId, actorId, actorRole)` | Returns deliverable, all immutable versions, all feedback entries grouped by version. Actor must be Admin or project member. |
| List deliverable versions | `deliverable_versions` select where `deliverable_id = X` order by `version_number desc` | `src/lib/deliverables/queries.ts` → `listDeliverableVersions(deliverableId)` | |
| List feedback for version | `deliverable_feedback` select where `version_id = X` order by `reviewed_at asc` | `src/lib/deliverables/queries.ts` → `listVersionFeedback(versionId)` | |
| Create deliverable | `deliverables` typed insert | `src/lib/deliverables/commands.ts` → `createDeliverable(input, actorId)` | Fields: `project_id, task_id, assignee_id, title, specifications, workflow_type, submission_deadline_at?, internal_review_deadline_at?, client_delivery_deadline_at?`. Only `production` workflow for Sprint 04. Trigger enforces `project_type = 'client'`. |
| Update deliverable planning fields | `deliverables` typed update | `src/lib/deliverables/commands.ts` → `updateDeliverable(deliverableId, input, actorId)` | Fields: `title, specifications, assignee_id, submission_deadline_at, internal_review_deadline_at, client_delivery_deadline_at`. Trigger re-validates. Only allowed when status is `pending` or `changes_requested`. |
| Submit production version | `submit_deliverable_version(p_deliverable_id, p_submission_url, p_submission_note?)` | `src/lib/deliverables/commands.ts` → `submitDeliverableVersion(input)` | URL must pass Google Drive validator before calling RPC. RPC validates again server-side. |
| Internal review (approve) | `review_deliverable(p_deliverable_id, 'internal', 'approved', null)` | `src/lib/deliverables/commands.ts` → `reviewDeliverable(input)` | RPC enforces status = `awaiting_internal_review`; transitions to `awaiting_client_review`. |
| Internal review (changes requested) | `review_deliverable(p_deliverable_id, 'internal', 'changes_requested', p_comments)` | reuses `reviewDeliverable` | `p_comments` is mandatory and non-empty; RPC enforces. Transitions to `pending` for resubmission. |
| Mark delivered | `mark_deliverable_delivered(p_deliverable_id)` | `src/lib/deliverables/commands.ts` → `markDeliverableDelivered(deliverableId)` | RPC enforces status = `approved`; transitions to `delivered`. Lead/Admin only. |
| Soft-delete deliverable | `soft_delete_entity(deliverableId, 'deliverable', reason?)` | `src/lib/deliverables/commands.ts` → `archiveDeliverable(deliverableId, reason?)` | |
| Report broken link | `report_broken_link(p_deliverable_id, p_version_id, p_reason)` | `src/lib/deliverables/commands.ts` → `reportBrokenLink(input)` | Creates `deliverable_link_reports` record. Does NOT change deliverable status. |

### 4.6 Collaboration comments domain

| Operation | Command / Projection | Module | Notes |
|---|---|---|---|
| Create collaboration comment | `create_collaboration_comment(p_project_id, p_target_type, p_target_id, p_body)` | `src/lib/comments/commands.ts` → `createComment(input, actorId)` | `target_type`: `project | task | deliverable`. Client role is rejected by RPC. |
| List comments for target | `collaboration_comments` select where `target_id = X AND deleted_at IS NULL` order by `created_at asc` | `src/lib/comments/queries.ts` → `listComments(targetId, targetType)` | Returns `id, body, author_id, author_capacity_snapshot, created_at, edited_at`. Join `profiles` for `full_name`. |

---

## 5. Zod schema definitions

All schemas live in their respective feature module `schemas.ts` files. Use `z.infer<typeof SchemaName>` for input types.

### 5.1 `src/lib/projects/schemas.ts`

```ts
import { z } from "zod";

// ── Project ──────────────────────────────────────────────────────────────────

export const CreateProjectSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
    project_type: z.enum(["client", "internal"]),
    internal_description: z
      .string()
      .trim()
      .min(1, "Internal description is required")
      .max(2000, "Description is too long"),
    deadline_at: z.string().datetime({ offset: true, message: "Valid ISO datetime required" }),
    client_id: z.string().uuid("Invalid client ID").nullable().optional(),
    client_scope: z.string().trim().max(1000, "Client scope is too long").nullable().optional(),
    drive_folder_url: z.string().url("Invalid Drive URL").nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.project_type === "client" && !data.client_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Client project requires a client organization",
        path: ["client_id"],
      });
    }
    if (data.project_type === "internal" && data.client_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Internal project cannot have a client organization",
        path: ["client_id"],
      });
    }
  });

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  internal_description: z.string().trim().min(1).max(2000).optional(),
  deadline_at: z.string().datetime({ offset: true }).optional(),
  client_scope: z.string().trim().max(1000).nullable().optional(),
  drive_folder_url: z.string().url().nullable().optional(),
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export const TransitionProjectStatusSchema = z.object({
  project_id: z.string().uuid(),
  next_status: z.enum(["planning", "in_progress", "paused", "completed", "cancelled"]),
  confirm_unfinished: z.boolean().optional().default(false),
  reopen_reason: z.string().trim().min(1).max(500).nullable().optional(),
});

export type TransitionProjectStatusInput = z.infer<typeof TransitionProjectStatusSchema>;

export const RecoverProjectStatusSchema = z.object({
  project_id: z.string().uuid(),
  target_status: z.enum(["planning", "in_progress", "paused", "completed", "cancelled"]),
  reason: z.string().trim().min(1, "Reason is mandatory").max(500),
});

export type RecoverProjectStatusInput = z.infer<typeof RecoverProjectStatusSchema>;

// ── Membership ───────────────────────────────────────────────────────────────

export const AddProjectMemberSchema = z.object({
  project_id: z.string().uuid(),
  user_id: z.string().uuid(),
  member_type: z.enum(["pm_lead", "pm_watcher", "operator", "client"]),
  is_primary: z.boolean().optional().default(false),
  receives_notifications: z.boolean().optional().default(true),
});

export type AddProjectMemberInput = z.infer<typeof AddProjectMemberSchema>;

export const UpdateProjectMemberSchema = z.object({
  member_id: z.string().uuid(),
  member_type: z.enum(["pm_lead", "pm_watcher", "operator", "client"]).optional(),
  is_primary: z.boolean().optional(),
  receives_notifications: z.boolean().optional(),
});

export type UpdateProjectMemberInput = z.infer<typeof UpdateProjectMemberSchema>;

// ── Task ─────────────────────────────────────────────────────────────────────

export const CreateTaskSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(5000),
  task_type: z.enum(["internal_work", "client_request"]),
  priority: z.enum(["low", "medium", "high", "blocking"]),
  deadline_at: z.string().datetime({ offset: true, message: "Valid ISO datetime required" }),
  assignee_id: z.string().uuid("Invalid assignee ID"),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(5000).optional(),
  priority: z.enum(["low", "medium", "high", "blocking"]).optional(),
  deadline_at: z.string().datetime({ offset: true }).optional(),
  assignee_id: z.string().uuid().optional(),
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const TransitionTaskStatusSchema = z.object({
  task_id: z.string().uuid(),
  next_status: z.enum(["pending", "in_progress", "in_review", "completed", "blocked"]),
  reopen_reason: z.string().trim().min(1).max(500).nullable().optional(),
});

export type TransitionTaskStatusInput = z.infer<typeof TransitionTaskStatusSchema>;
```

### 5.2 `src/lib/deliverables/validators.ts`

```ts
/**
 * Google Drive URL validator.
 *
 * Mirrors the server-side SQL check in submit_deliverable_version:
 *   p_submission_url ~* '^https://(drive\.google\.com|docs\.google\.com)/'
 *
 * Used in both client-side Zod schema validation and server-side Zod validation.
 * The server RPC is the authoritative boundary; this is a complement.
 *
 * NEVER: fetch, resolve, or request the URL. Validation is lexical only.
 */
export const GOOGLE_DRIVE_URL_REGEX =
  /^https:\/\/(drive\.google\.com|docs\.google\.com)\//i;

export function isValidGoogleDriveUrl(url: string): boolean {
  return GOOGLE_DRIVE_URL_REGEX.test(url);
}
```

### 5.3 `src/lib/deliverables/schemas.ts`

```ts
import { z } from "zod";
import { GOOGLE_DRIVE_URL_REGEX } from "./validators";

export const CreateDeliverableSchema = z.object({
  project_id: z.string().uuid(),
  task_id: z.string().uuid(),
  assignee_id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(200),
  specifications: z.string().trim().min(1, "Specifications are required").max(5000),
  workflow_type: z.enum(["production"]), // Sprint 04: production only
  submission_deadline_at: z.string().datetime({ offset: true }).nullable().optional(),
  internal_review_deadline_at: z.string().datetime({ offset: true }).nullable().optional(),
  client_delivery_deadline_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export type CreateDeliverableInput = z.infer<typeof CreateDeliverableSchema>;

export const UpdateDeliverableSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  specifications: z.string().trim().min(1).max(5000).optional(),
  assignee_id: z.string().uuid().optional(),
  submission_deadline_at: z.string().datetime({ offset: true }).nullable().optional(),
  internal_review_deadline_at: z.string().datetime({ offset: true }).nullable().optional(),
  client_delivery_deadline_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export type UpdateDeliverableInput = z.infer<typeof UpdateDeliverableSchema>;

export const SubmitDeliverableVersionSchema = z.object({
  deliverable_id: z.string().uuid(),
  submission_url: z
    .string()
    .trim()
    .regex(
      GOOGLE_DRIVE_URL_REGEX,
      "Submission URL must be a valid Google Drive share link (https://drive.google.com/... or https://docs.google.com/...)"
    ),
  submission_note: z.string().trim().max(1000).nullable().optional(),
});

export type SubmitDeliverableVersionInput = z.infer<typeof SubmitDeliverableVersionSchema>;

export const ReviewDeliverableSchema = z
  .object({
    deliverable_id: z.string().uuid(),
    stage: z.enum(["internal"]), // Sprint 04: internal stage only
    decision: z.enum(["approved", "changes_requested"]),
    comments: z.string().trim().max(5000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === "changes_requested") {
      if (!data.comments || data.comments.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A comment is required when requesting changes",
          path: ["comments"],
        });
      }
    }
  });

export type ReviewDeliverableInput = z.infer<typeof ReviewDeliverableSchema>;

export const ReportBrokenLinkSchema = z.object({
  deliverable_id: z.string().uuid(),
  version_id: z.string().uuid(),
  reason: z.string().trim().min(1, "Reason is mandatory").max(1000),
});

export type ReportBrokenLinkInput = z.infer<typeof ReportBrokenLinkSchema>;
```

### 5.4 `src/lib/comments/schemas.ts`

```ts
import { z } from "zod";

export const CreateCommentSchema = z.object({
  project_id: z.string().uuid(),
  target_type: z.enum(["project", "task", "deliverable"]),
  target_id: z.string().uuid(),
  body: z.string().trim().min(1, "Comment body cannot be empty").max(5000),
});

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
```

### 5.5 `src/lib/clients/schemas.ts`

```ts
import { z } from "zod";

export const CreateClientSchema = z.object({
  display_name: z.string().trim().min(1, "Display name is required").max(150),
  legal_name: z.string().trim().min(1, "Legal name is required").max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase alphanumeric characters and hyphens"),
  default_drive_folder_url: z.string().url("Invalid URL").nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type CreateClientInput = z.infer<typeof CreateClientSchema>;
```

---

## 6. Command adapter implementations & error mapping

### 6.1 Safe error mapping (`src/lib/projects/errors.ts`)

```ts
export type AppCommandErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "INVARIANT_VIOLATION"
  | "VALIDATION_FAILED"
  | "CONFLICT"
  | "UNKNOWN";

export type AppCommandError = {
  code: AppCommandErrorCode;
  message: string; // Safe, localized/displayable message
  detail?: string; // Internal logging detail only — never leaked to browser
};

export type CommandResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppCommandError };

/**
 * Maps Supabase PostgREST / RPC exceptions to structured, safe errors.
 * Never expose raw database error strings, function names, or internal schemas.
 */
export function mapSupabaseError(
  error: { code?: string; message?: string } | null
): AppCommandError {
  if (!error) return { code: "UNKNOWN", message: "An unexpected error occurred." };

  const msg = error.message ?? "";

  if (
    msg.includes("Not authorized") ||
    msg.includes("Only an active PM Lead") ||
    msg.includes("Only Admin") ||
    msg.includes("cannot post internal collaboration comments")
  ) {
    return { code: "UNAUTHORIZED", message: "You do not have permission to perform this action." };
  }
  if (msg.includes("not found or deleted")) {
    return { code: "NOT_FOUND", message: "The requested item could not be found." };
  }
  if (
    msg.includes("Illegal transition") ||
    msg.includes("cannot be transitioned") ||
    msg.includes("cannot submit version") ||
    msg.includes("is not in awaiting_internal_review") ||
    msg.includes("must be approved before marking delivered")
  ) {
    return { code: "INVALID_TRANSITION", message: "This action is not allowed in the current status." };
  }
  if (
    msg.includes("unfinished") ||
    msg.includes("requires a non-empty") ||
    msg.includes("Comments are mandatory") ||
    msg.includes("confirm_unfinished")
  ) {
    return { code: "INVARIANT_VIOLATION", message: "Required conditions or confirmation are missing." };
  }
  if (
    msg.includes("duplicate") ||
    msg.includes("already exists") ||
    msg.includes("unique") ||
    error.code === "23505"
  ) {
    return { code: "CONFLICT", message: "This item already exists or conflicts with existing data." };
  }

  return { code: "UNKNOWN", message: "An unexpected error occurred. Please try again." };
}
```

### 6.2 Adapter functions sketch

```ts
// src/lib/projects/commands.ts
import type { CookieStore } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { mapSupabaseError, type CommandResult } from "./errors";
import type {
  CreateProjectInput,
  UpdateProjectInput,
  TransitionProjectStatusInput,
  RecoverProjectStatusInput,
  AddProjectMemberInput,
  UpdateProjectMemberInput,
  CreateTaskInput,
  UpdateTaskInput,
  TransitionTaskStatusInput,
} from "./schemas";
import type { Project, ProjectMember, Task } from "./queries";

export async function createProject(
  cookieStore: CookieStore,
  input: CreateProjectInput,
  actorId: string
): Promise<CommandResult<Project>> {
  const supabase = createClient(cookieStore);
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: input.name,
      project_type: input.project_type,
      internal_description: input.internal_description,
      deadline_at: input.deadline_at,
      client_id: input.client_id ?? null,
      client_scope: input.client_scope ?? null,
      drive_folder_url: input.drive_folder_url ?? null,
      created_by: actorId,
    })
    .select(
      "id, name, project_type, status, client_id, client_scope, internal_description, deadline_at, drive_folder_url, completed_at, archived_at, created_at, updated_at, created_by, updated_by"
    )
    .single();

  if (error) return { ok: false, error: mapSupabaseError(error) };
  return { ok: true, data: data as Project };
}

export async function transitionProjectStatus(
  cookieStore: CookieStore,
  input: TransitionProjectStatusInput
): Promise<CommandResult<{ project_id: string; old_status: string; new_status: string }>> {
  const supabase = createClient(cookieStore);
  const { data, error } = await supabase.rpc("transition_project_status", {
    p_project_id: input.project_id,
    p_next_status: input.next_status,
    p_confirm_unfinished: input.confirm_unfinished ?? false,
    p_reopen_reason: input.reopen_reason ?? null,
  });

  if (error) return { ok: false, error: mapSupabaseError(error) };
  return { ok: true, data: data as { project_id: string; old_status: string; new_status: string } };
}

export async function getCompletionReadiness(
  cookieStore: CookieStore,
  projectId: string
): Promise<
  CommandResult<{
    project_id: string;
    is_ready: boolean;
    unfinished_task_count: number;
    unfinished_tasks: Array<{ id: string; title: string; status: string; assignee_id: string }>;
    unfinished_deliverable_count: number;
    unfinished_deliverables: Array<{
      id: string;
      title: string;
      status: string;
      workflow_type: string;
      assignee_id: string;
    }>;
  }>
> {
  const supabase = createClient(cookieStore);
  const { data, error } = await supabase.rpc("get_project_completion_readiness", {
    p_project_id: projectId,
  });

  if (error) return { ok: false, error: mapSupabaseError(error) };
  return { ok: true, data: data as any };
}
```

---

## 7. Route handler & server action conventions

### 7.1 Architecture boundary

Mutations in Sprint 04 can be executed through:
1. **Server Actions (`"use server"`)**: Directly callable from form components and interactive dialogs.
2. **Route Handlers (`src/app/api/v1/...`)**: Used for explicit REST endpoints or programmatic client component calls.

Regardless of transport, the sequence is identical:
1. Obtain authenticated actor via `requireSession(cookieStore)` (fails closed).
2. Validate payload using strict Zod schema.
3. Call the dedicated command adapter.
4. Return role-safe result or safe mapped error.

---

## 8. Server read conventions (React Server Components)

1. **Explicit Column Selection**: Always request exact columns; avoid broad wildcard selects.
2. **Actor Scope Verification**: Server components must confirm actor authorization before rendering protected data.
3. **No Direct Audit Queries**: Use `project_completion_cycles_view` instead of raw `audit_logs` table.
4. **Clean Decoupling**: RSC calls queries in `src/lib/*/queries.ts` passing `await cookies()`.

---

## 9. Stop conditions & discovered boundaries

The following boundaries must be observed by all downstream work items:

1. **No RPC for Project/Task/Deliverable Creation**: Creation uses typed table inserts via `@supabase/ssr` under RLS with DB triggers enforcing invariants.
2. **Single Primary PM Lead Rule**: Handled by database trigger `validate_project_memberships()`.
3. **`production` Deliverables on `client` Projects Only**: Database trigger `sync_and_validate_deliverable()` forbids production deliverables on internal projects.
4. **Resubmission Flow**: Resubmitting a deliverable after an internal change request returns it to `awaiting_internal_review` from `pending`.
5. **No Client Portal Execution in S04**: The `client_submission` workflow and client review UI are deferred to E7.

---

## 10. File inventory

### Files to CREATE

| File | Contents |
|---|---|
| `src/lib/projects/queries.ts` | Server reads for projects, members, and tasks |
| `src/lib/projects/schemas.ts` | Zod validation schemas for projects, members, and tasks |
| `src/lib/projects/commands.ts` | Command adapters calling RPCs and table operations |
| `src/lib/projects/errors.ts` | Error mapping and command result types |
| `src/lib/deliverables/validators.ts` | `isValidGoogleDriveUrl` & lexical regex |
| `src/lib/deliverables/schemas.ts` | Deliverable Zod validation schemas |
| `src/lib/deliverables/queries.ts` | Server reads for deliverables, versions, and feedback |
| `src/lib/deliverables/commands.ts` | Deliverable command adapters (submit, review, deliver, link report) |
| `src/lib/deliverables/errors.ts` | Deliverable error re-exports/mappings |
| `src/lib/comments/schemas.ts` | Comment Zod schemas |
| `src/lib/comments/queries.ts` | Server reads for target comments |
| `src/lib/comments/commands.ts` | Comment creation command adapter |
| `src/lib/clients/schemas.ts` | Client organization Zod schemas |
| `src/lib/clients/queries.ts` | Server reads for client organizations and contacts |
| `src/lib/projects/__tests__/schemas.test.ts` | Unit tests for project/membership/task schemas |
| `src/lib/deliverables/__tests__/schemas.test.ts` | Unit tests for deliverable schemas |
| `src/lib/deliverables/__tests__/validators.test.ts` | Unit tests for Google Drive URL validator |
| `src/lib/projects/__tests__/errors.test.ts` | Unit tests for Supabase error mapping |

---

## 11. Focused automated test requirements

### Test coverage areas

1. **Zod Validation Schemas**:
   - `CreateProjectSchema`: Rejects client project without `client_id`; rejects internal project with `client_id`.
   - `ReviewDeliverableSchema`: Enforces non-empty `comments` when `decision = 'changes_requested'`.
   - `SubmitDeliverableVersionSchema`: Rejects non-Google Drive URLs.
2. **Google Drive Validator**:
   - Validates `https://drive.google.com/...` and `https://docs.google.com/...`.
   - Rejects HTTP, localhost, non-Google, credentialed, or malformed URLs without fetching.
3. **Error Mapper**:
   - Accurately categorizes unauthorized, not-found, invalid transition, invariant violation, and conflict errors.
   - Shields internal details and stack traces.

---

## 12. Acceptance criteria

- [ ] `src/lib/projects/` contains `queries.ts`, `schemas.ts`, `commands.ts`, and `errors.ts`.
- [ ] `src/lib/deliverables/` contains `validators.ts`, `schemas.ts`, `queries.ts`, `commands.ts`, and `errors.ts`.
- [ ] `src/lib/comments/` contains `schemas.ts`, `queries.ts`, and `commands.ts`.
- [ ] `src/lib/clients/` contains `schemas.ts` and `queries.ts`.
- [ ] All database types match `database.types.ts` without manual edits to generated files.
- [ ] Automated unit tests for schemas, validators, and error mappers pass cleanly.
- [ ] `npm run typecheck`, `npm run lint`, and `npm run test` pass with zero regressions.

---

## 13. Supabase MCP operations — explicit confirmation

**NO Supabase MCP operations are required or permitted for S04-02.**

S04-02 is purely an application data-layer and reconciliation work item.

---

*Spec written: 2026-08-19. Authority: Sprint S04 plan, Section 5 (S04-02).*
