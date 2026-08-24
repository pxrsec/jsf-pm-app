---
document_id: S07-E09-CAPABILITY-MAP-03
sprint_id: S07
status: reconciled-closeout-pending
source_plan: dev-docs/specs/s07/s07-e09-visibility-reporting-and-operational-administration-demo-completion-sprint-plan.md
reconciled_at: 2026-08-24T11:24:44-06:00
target_environment: jsf-pm-dev
---

# S07 E09 Capability Contract Mapping Reference

## 1. Purpose, authority, and current status

This is the repository-local execution map for Sprint 07. It reconciles the original plan with the S07 migration sources, the Project Owner's application/type provenance, and the completed S07-02 through S07-06 implementation reports. It does not apply database changes, regenerate types, establish provider capability, or constitute sprint closeout evidence.

**Authority by subject:** Project Owner direction; applied migration/type provenance for database contracts; accepted work-item specifications for application behavior; this document and the sprint plan for execution status and remaining closeout scope. A discrepancy in an applied function signature, generated type, route, safe DTO, or authorization boundary stops the affected work.

| Work item | Current implementation state | Remaining action |
| --- | --- | --- |
| S07-M0 | Completed earlier as the S07 security baseline. | Retain its findings and closed evidence; do not reopen as routine closeout work. |
| S07-02 | Completed: role-safe calendar and manual milestones. | S07-07 only verifies integration/manual evidence; no calendar authority redesign. |
| S07-03 / S07-04 | Completed: archive/incidents and bounded notification history. | S07-07 repairs only verified accessibility/corpus/documentation gaps. |
| S07-05 / S07-06 | Completed: metrics, trend dashboards, Admin operations, diagnostics, and navigation. | S07-07 repairs only verified accessibility/corpus/documentation gaps. |
| S07-07 | Not implemented. | Complete corpus reconciliation, bounded accessibility refactor, current documentation/runbook/closeout, and factual evidence. |

## 2. Applied migration and generated-type baseline

The Project Owner reports all of the following are applied to `jsf-pm-dev`, and `src/lib/database.types.ts` was regenerated through Supabase MCP after the applicable migrations:

| Order | Migration | State | Consumed capability |
| --- | --- | --- | --- |
| M0 | `20260823083000_s07_m0_revoke_rls_auto_enable_execute.sql` through `20260823130000_s07_m0_security_definer_command_hardening.sql` | Applied | S07 security baseline. |
| M1 | `20260823140000_s07_e09_calendar-role-safe-feed-and-milestones.sql` | Applied | Initial role-safe calendar contracts. |
| M1 direct-read remediation | `20260823143000_s07_e09_scope_calendar_events_direct_select.sql` | Applied | Direct calendar-event read restriction. |
| M1-R | `20260823144000_s07_e09_calendar-task-scoped-milestones-and-pm-authority.sql` | Applied | Task-scoped milestones and all-active-PM calendar authority. |
| M2 | `20260823141000_s07_e09_finalized-production-archive-and-link-incidents.sql` | Applied | Finalized archive and read-only incident projections. |
| M3 | `20260823142000_s07_e09_scoped-operations-metrics-and-admin-projections.sql` | Applied | Aggregate metrics, audit history, and user/invitation state projections. |
| M4 | `20260824080000_s07_e09_notification_history_window_and_filters.sql` | Applied | Self-only bounded notification history. |
| M5 | `20260824110000_s07_e09_scoped-operations-metrics-trend-projection.sql` | Applied | Bounded seven-day metrics trend projection. |

**S07-07 migration determination:** no migration is required or authorized. The remaining corpus obligations use existing table shape and the applied M1-R/M2/M3/M4/M5 contracts. A seed/reconciler change must not alter tables, functions, grants, policies, views, generated types, or migration history.

## 3. Capability, route, and authorization map

| Capability | Canonical routes | Eligible callers | Authoritative boundary | Status |
| --- | --- | --- | --- | --- |
| Calendar | `/calendario` | All active roles; only Admin/PM manage milestones | M1-R RPCs; Operator only direct-task milestones; Client no manual milestones | Implemented. |
| Finalized archive | `/admin/archivo`, `/pm/archivo`, `/operador/archivo`, `/cliente/archivo` | Role-safe per M2 | M2 archive RPC; Operator is direct-assignee-only with no project/Drive expansion | Implemented. |
| Link incidents | `/admin/incidentes-enlaces`, `/pm/incidentes-enlaces` | Admin and database-authorized PM scope | M2 incident RPC; read-only; no Client/Operator route | Implemented. |
| Personal history | `/notificaciones` | Every active role | M4 self-only history RPC and recipient-owned read actions | Implemented. |
| Notification operations | `/admin/notificaciones`, `/pm/notificaciones` | Admin; active PM Lead only | Existing S06 operations authorization and projection | Implemented. |
| Metrics | `/admin/metricas`, `/pm/metricas` | Admin global; PM selected permitted project | M3/M5 RPCs; no Operator/Client route | Implemented. |
| Admin operations | `/admin/operaciones` | Admin only | M3 safe projections and closed diagnostics DTO | Implemented. |

All desktop/mobile navigation items must remain role-real and locale-aware. The protected server layout derives `canAccessNotificationOperations` fail-closed. Navigation is never authorization evidence.

## 4. Security and presentation invariants retained through closeout

1. Application role and project membership capacity remain separate. Calendar's all-active-PM exception is restricted to calendar RPCs.
2. RPC actor derivation, RLS, grants, and safe projections remain the data authority. Server route guards and navigation are defense in depth.
3. Browser DTOs omit database identifiers and sensitive metadata. Raw audit, identity, provider, configuration, and recipient details do not cross presentation boundaries.
4. S07 uses `America/Mexico_City` date normalization, explicit offset-bearing half-open ranges, and a 93-day maximum where the relevant RPC contract requires it.
5. External delivery remains inactive. `suppressed` means not sent, not pending, and not subject to automatic retry or replay.
6. Stored external archive URLs are outbound user actions only. They are never server-fetched, previewed, proxied, or treated as reachability evidence.
7. A chart is supplemental to its visible semantic table. Null, zero, empty, unavailable, and authority-limited states remain distinct.

## 5. S07-07 reconciliation findings

### 5.1 Corpus gap requiring an application-tooling change

The current bootstrap script creates personas, reference/sandbox projects, basic tasks/deliverables, in-app notification rows, one project-scoped reference milestone, and a completion audit. It does **not** reconcile all S07 demo requirements:

- no deterministic finalized `approved` and `delivered` production archive pair;
- no deterministic safe `deliverable_link_reports` incident;
- no task-scoped manual milestone to demonstrate Operator visibility isolation;
- no explicit overdue sandbox task alongside an upcoming sandbox task;
- no explicit M4 older-history and suppressed-external-recipient scenarios;
- no explicit project completion/reopen-cycle corpus; and
- no deliberate invitation-state scenario.

S07-07 must add these only to `Acme Sandbox Campaign`, preserving every named reference and isolation project.

### 5.2 Accessibility refactor required before closeout

Repository inspection found several primary S07 interaction leaves still explicitly sized below the accepted 44px target: archive external-link actions and archive filter/reset controls, notification-history filter presets, calendar header/navigation controls and milestone edit/delete controls. These are concrete implementation defects against the sprint's accessibility contract, not optional styling work.

S07-07 must make the bounded 44px remediation described in its implementation specification before any final manual accessibility matrix, closeout verdict, or sprint completion claim. No architecture, data, or authorization refactor is required.

### 5.3 Documentation drift requiring correction

The old plan still labels M2/M3 as candidate/unapplied and omits M4/M5. The old mapping does not record S07-03 through S07-06 implementation. The older persona guide also inaccurately describes PM Lead A as a Sandbox Watcher, while the bootstrap source gives that persona a `pm_lead` Sandbox membership. S07-07 owns the bounded documentation correction.

## 6. Implementation and closeout readiness

S07-07 can start immediately. Its only prerequisite is the applied migration/type baseline listed above; no additional database work is needed. Sprint 07 cannot be closed until S07-07 completes its corpus and accessibility corrections, documentation/runbook, focused verification, final manual journey matrix, and factual closeout record.
