---
document_id: S07-01-E09-CAPABILITY-MAP-02
sprint_id: S07
work_item: S07-01
status: completed-reconciled
source_plan: dev-docs/specs/s07/s07-e09-visibility-reporting-and-operational-administration-demo-completion-sprint-plan.md
reconciled_at: 2026-08-23T20:00:00-06:00
target_environment: jsf-pm-dev
---

# S07 E09 Capability Contract Mapping Reference

## 1. Purpose and authority

This repository-local map reconciles the S07 plan with committed migrations, generated types, and the Project Owner’s calendar-scope decisions. It is the implementation map for S07 work; it does not itself apply a migration or change remote state.

Authority is: Project Owner direction, accepted provider-deferral posture, repository migration sources/current applied catalog, repository OpenAPI contract, the reconciled S07 plan, and the work-item implementation specifications.

The calendar reconciliation is controlled by `s07-02-calendar-and-manual-milestones-implementation-spec.md`. It assumes the forward migration at `20260823144000_s07_e09_calendar-task-scoped-milestones-and-pm-authority.sql` is applied and types are regenerated before S07-02 application implementation begins.

## 2. Migration order and application baseline

| Order | Source | State at S07-02 application implementation |
| --- | --- | --- |
| M0 | `20260823083000` through `20260823130000` | Applied security baseline. |
| M1 | `20260823140000_s07_e09_calendar-role-safe-feed-and-milestones.sql` | Applied original calendar RPC boundary. |
| M1 direct-read remediation | `20260823143000_s07_e09_scope_calendar_events_direct_select.sql` | Applied. |
| M1-R | `20260823144000_s07_e09_calendar-task-scoped-milestones-and-pm-authority.sql` | Must be reviewed, committed, applied to `jsf-pm-dev`, and followed by unchanged MCP-generated types before application work. |
| M2 | `20260823141000_s07_e09_finalized-production-archive-and-link-incidents.sql` | Applied/current; not consumed by S07-02. |
| M3 | `20260823142000_s07_e09_scoped-operations-metrics-and-admin-projections.sql` | Applied/current; not consumed by S07-02. |

M1-R is append-only. It does not edit M1 or the direct-read remediation, add an HTTP endpoint, alter OpenAPI, enable external providers, add Realtime/scheduling, or alter deadline source records.

## 3. Shared role and data-boundary facts

| Capability | Calendar interpretation | Non-calendar authority |
| --- | --- | --- |
| Admin | Calendar-wide feed and manual milestone management. | Existing Admin authority remains unchanged. |
| PM Lead | Calendar-wide feed and manual milestone management. | Existing project/workspace authority remains unchanged. |
| PM Watcher | Calendar-wide feed and manual milestone management. | Existing non-calendar Watcher limits remain unchanged. |
| Operator | Own-work deadlines and task-scoped milestones only for directly assigned tasks. | No project-wide calendar browsing inferred. |
| Client | Existing safe deadline-only, read-only calendar. | No manual milestones or manager contracts. |

The calendar exception granting all active PM users calendar-wide management is limited to M1-R calendar RPCs. It does not silently broaden PM directory, project workspace, archive, metrics, queue, membership, or administration authority.

Every public S07 RPC remains postgres-owned `SECURITY DEFINER`, has `search_path = pg_catalog, public`, revokes `PUBLIC` and `anon`, grants only its needed authenticated execution, derives the caller from `auth.uid()`, and returns purpose-limited output. `service_role` is not a substitute for session authorization.

## 4. Calendar and milestones — M1 plus M1-R

### 4.1 Canonical storage and integrity

`public.calendar_events` remains the only manual milestone table. Deadlines remain in `projects`, `tasks`, and `deliverables`; no deadline is copied to manual storage.

M1-R adds nullable `calendar_events.task_id`:

- null means a project-scoped milestone;
- non-null means a task-scoped milestone;
- a trigger requires that the task is active and belongs to the same project;
- existing records remain project-scoped;
- audit facts record scope/task ID but never description text.

### 4.2 Calendar feed contract

`list_role_safe_calendar_events(p_from, p_to, p_project_id default null)` remains the only general calendar feed. It validates authenticated active profile, `p_from < p_to`, maximum 93 days, overlap semantics, optional filter, and deterministic `starts_at`, `event_type`, `entity_id` ordering.

M1-R output is:

```text
entity_id, project_id nullable, project_name nullable, task_id nullable,
title, event_type, starts_at, ends_at nullable, is_all_day, color_override nullable
```

Project IDs are route/filter candidates only. Project names are human-readable display values where authorized; UUIDs are never UI labels.

| Caller | Feed inclusion |
| --- | --- |
| Admin / active PM | All role-safe project, task, review, delivery, submission, and manual-milestone rows across all projects. |
| Operator | Directly assigned task deadlines, directly assigned production-deliverable deadlines, and only manual milestones whose `task_id` is directly assigned to caller. |
| Client | Existing safe project deadline, direct client-request task, direct client-submission, and client-delivery deadline scope; no manual milestone. |

### 4.3 Management contracts

Only Admin and active PM users execute:

```text
list_calendar_milestone_targets()
get_calendar_milestone_for_edit(p_event_id)
create_calendar_milestone(... p_project_id, p_task_id, ...)
update_calendar_milestone(... p_event_id, p_project_id, p_task_id, ...)
soft_delete_calendar_milestone(p_event_id)
```

Targets contain only project/task IDs and names. Edit detail contains the manager-only description needed to preserve it during update. The general feed never contains description. Operator and Client receive a safe generic denial for forged management calls.

Commands enforce Admin/PM authority, title 1–160, nullable trimmed description <=2,000, valid timestamps, non-inverted end, required boolean, finite chart token/null, active same-project task scope, milestone-only update/delete, actor/audit derivation, and soft deletion.

A false soft delete is a safe no-op/missing outcome. It is not success.

### 4.4 Direct access disposition

M1-R revokes direct authenticated `SELECT` on `calendar_events` and removes its select policy. Application code consumes only calendar RPCs. This prevents base-table description exposure and avoids a parallel browser/PostgREST calendar authority.

## 5. Other E09 contracts retained

### M2 archive and incidents

M2 remains unchanged: finalized production archive is purpose-limited, excludes client submissions/nonterminal rows, and supports the accepted direct-assignee Operator archive restriction. Link incidents remain read-only for the authorized internal scope. S07-02 does not consume M2.

### M3 metrics, administration, audit, user/invitation state

M3 remains unchanged: scoped metrics, Admin audit/user-invitation projections, and server-only configuration posture are separate S07 consumers. S07-02 does not consume M3.

## 6. Route, module, and test inventory

| Area | S07 destination |
| --- | --- |
| Calendar | Shared `/calendario` RSC route, server-only calendar queries/actions, client interaction leaves, optional server-fed Admin/PM workspace context. |
| Archive | S07-03 consumes M2. |
| Notifications | S07-04 consumes S06 contracts. |
| Metrics | S07-05 consumes M3. |
| Admin state/audit | S07-06 consumes M3. |
| Locale/accessibility | Every S07 route preserves Spanish canonical routing, `/en/`, catalog parity, and an accessible alternative. |

Calendar tests cover M1-R static contract/type shape after application, server RPC argument/error/revalidation behavior, role-safe UI projections, all four views/list equivalence, existing navigation/route guard updates, and manual 375px/keyboard evidence. Component tests do not replace live migration/RLS evidence.

## 7. OpenAPI reconciliation and adoption trigger

The existing calendar OpenAPI declaration remains stale deferred vocabulary. M1-R does not create a same-origin HTTP endpoint; therefore it does not update OpenAPI.

Adoption trigger: a later approved item proposes an actual same-origin calendar HTTP route. Before implementation, reconcile OpenAPI first for task-scoped milestones, calendar-wide Admin/PM authority, Client/Operator scope, project-name DTO, 93-day range, title/description/token constraints, and safe errors. Do not invent an HTTP endpoint merely because server-only code calls a Supabase RPC.

## 8. Stop conditions

1. If M1-R cannot enforce task/project integrity in the database, stop; do not rely on UI validation.
2. If generated types or live catalog differ after application, stop and reconcile before app work.
3. If manager targets/edit detail expose data to Operator/Client, narrow the RPC; do not hide it only in UI.
4. If a deep link cannot prove destination authorization independently, omit it.
5. If a change requires OpenAPI/REST, scheduler, Realtime, broad direct table access, or provider activity, open a new decision/work item.

## 9. Implementation readiness

After M1-R is applied and types regenerated unchanged, the reconciled S07-02 specification is the sole implementation-plan input for Antigravity. It must inspect exact repository paths and consume only the applied contracts; it must not modify migration SQL, generated types, or remote state.
