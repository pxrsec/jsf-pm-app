---
document_id: S07-E09-SPRINT-PLAN-02
sprint_id: S07
epic_id: E09
status: final-work-item-active-closeout-pending
reconciled_at: 2026-08-24T11:24:44-06:00
target_environment: jsf-pm-dev
---

# Sprint 07 — E09 Visibility, Reporting, and Operational Administration

## 1. Purpose and delivery posture

Sprint 07 completes Epic 09's **localhost development demonstration capability**. It is not a provider activation, deployment, production, or release sprint. External email, WhatsApp, QStash/Workflow, hosted environments, DNS, backup/restore, legal publication, and production Supabase remain explicitly deferred.

The target is a truthful, role-safe localhost walkthrough for Admin, PM Lead, PM Watcher, Operator, and Client: calendar, finalized archive, notification history, metrics, and bounded operations administration. `jsf-pm-dev` remains the approved persistent development environment. Named reference projects are inspection-only by convention; `Acme Sandbox Campaign` is the only normal mutation corpus.

## 2. Authority and permanent boundaries

1. Direct Project Owner direction.
2. Applied migration sources and MCP-regenerated database types for schema/RPC behavior.
3. Accepted S07 implementation specifications for route, DTO, authorization, and presentation behavior.
4. This plan and the S07 capability map for execution state and remaining sequence.
5. Repository instruction files and live `package.json` scripts.

Retain these non-negotiable boundaries:

- Spanish is canonical; English is locale-preserving under `/en/`.
- `profiles.role` is application authority. PM Lead/Watcher are membership capacities. The all-active-PM calendar exception does not broaden archive, metrics, queue, or Admin authority.
- RSC/server authorization and role-safe RPCs are authoritative. UI/navigation do not grant access.
- No direct browser base-table access, service-role browser access, `select("*")`, raw error/identifier disclosure, provider activation, scheduler, Realtime expansion, API/OpenAPI work, materialized metrics, offline behavior, or Playwright.
- External notification suppression remains terminal: not sent, not pending, no automatic replay/retry.
- Charts require visible semantic tables. Primary S07 controls must meet the accepted 44px touch-target standard; status meaning cannot rely on color alone.

## 3. Applied migration/type baseline

The Project Owner reports the following S07 migrations applied to `jsf-pm-dev`, with the generated type artifact regenerated through Supabase MCP after the applicable changes:

1. S07-M0 security baseline: `20260823083000` through `20260823130000`.
2. M1 calendar: `20260823140000_s07_e09_calendar-role-safe-feed-and-milestones.sql`.
3. M1 direct-read remediation: `20260823143000_s07_e09_scope_calendar_events_direct_select.sql`.
4. M1-R task-scoped milestones: `20260823144000_s07_e09_calendar-task-scoped-milestones-and-pm-authority.sql`.
5. M2 archive/incidents: `20260823141000_s07_e09_finalized-production-archive-and-link-incidents.sql`.
6. M3 metrics/admin projections: `20260823142000_s07_e09_scoped-operations-metrics-and-admin-projections.sql`.
7. M4 notification history: `20260824080000_s07_e09_notification_history_window_and_filters.sql`.
8. M5 metrics trend: `20260824110000_s07_e09_scoped-operations-metrics-trend-projection.sql`.

No additional migration is required or authorized for S07-07. If a live schema/type discrepancy is discovered, stop and create a reviewed forward-migration specification rather than compensating in application code.

## 4. Work-item reconciliation

| Item | Outcome | Evidence status |
| --- | --- | --- |
| S07-M0 | Security-definer hardening and related dispositions completed. | Historical closeout records retained. |
| S07-01 | Capability map created. | Reconciled by this revision. |
| S07-02 | Role-safe calendar/manual milestones implemented. | Implementation complete; manual closeout evidence remains S07-07 scope. |
| S07-03 | Finalized-production archive and link-incident views implemented. | Implementation complete; target-size refactor/manual closeout evidence remains S07-07 scope. |
| S07-04 | Bounded notification history/operations consolidation implemented. | Implementation complete; target-size refactor/manual closeout evidence remains S07-07 scope. |
| S07-05 | Scoped metrics and accessible tables/trend dashboard implemented. | Implementation complete; integrated evidence remains S07-07 scope. |
| S07-06 | Read-only Admin operations, diagnostics, user/invitation state, and navigation implemented. | Implementation complete; integrated evidence remains S07-07 scope. |
| S07-07 | Corpus, accessibility integration, locale/navigation audit, runbook, closeout, and changelog. | Active; mandatory final work item. |

The S07-05/S07-06 implementation report recorded: 10 adapter tests, 7 migration-contract tests, 19 navigation tests, 3 i18n-key tests, typecheck with zero errors, and 80 test files / 729 tests passing with 4 / 9 skips. This is owner-provided execution provenance; it is not a substitute for S07-07's final factual closeout record.

## 5. S07-07 scope and gates

S07-07 is governed by `s07-07-localhost-demo-corpus-accessibility-and-sprint-closeout-implementation-spec.md` and must do all of the following:

1. Reconcile only the Sandbox corpus to create deterministic calendar, archive, incident, notification-history, metric-cycle, and user/invitation-state scenarios.
2. Correct proven primary-control target-size violations in S07 calendar, archive, and notification-history interaction leaves. No data/authorization architecture refactor is authorized.
3. Reconcile the development persona guide with the actual bootstrap membership data.
4. Audit desktop/mobile role navigation, locale parity, keyboard/focus behavior, themes, status semantics, chart/table alternatives, and direct-route denial; repair only proven S07 integration defects.
5. Create a local stakeholder demo runbook, a factual S07 closeout verification record, and a truthful CHANGELOG entry after actual evidence exists.

### Mandatory blocker

The 44px primary-target remediation is **not optional**. It must be complete before final manual accessibility evidence and before closeout. The current inspected sub-44px S07 controls constitute a bounded refactor phase, but not a migration, data-boundary, or architecture phase.

## 6. Final verification and evidence discipline

Do not rerun verification now merely to recreate already accepted S07-05/S07-06 evidence. S07-07 implementation must execute only its specified focused checks after its changes, then one final repository gate derived from the live `package.json` after all implementation/runbook/changelog artifacts exist. The closeout record must contain actual outputs only.

The final evidence must keep these categories separate:

- source and Project Owner-reported migration/type application provenance;
- focused mocked/static application tests;
- final local repository command result;
- localhost manual observations using authentic demo sessions; and
- absent provider/hosted/production evidence.

No passing UI test proves deployed database/RLS behavior; no local stored-link action proves the external resource exists; no diagnostics card proves activation or delivery.

## 7. Definition of Done

Sprint 07 is complete only when:

1. S07-02 through S07-06 routes remain real, role-safe, localized, and integrated with no dead/unauthorized navigation.
2. S07-07 reconciles the required Sandbox scenarios without mutating named reference/isolation projects.
3. The bounded 44px remediation is complete for all specified S07 primary calendar, archive, and notification-history controls.
4. Calendar, archive, notification, metric, incident, audit, identity, and diagnostic boundaries retain the applied safe contracts.
5. All required S07 catalog keys retain exact semantic parity across `es-MX` and `en-US`.
6. Direct routes remain independently guarded and Client/Operator/PM Watcher visibility remains restricted as specified.
7. A concise stakeholder runbook gives a truthful role order, sandbox reset/reseed procedure, and provider-inactive wording.
8. The closeout document records actual focused checks, final gate, migration/type provenance, manual evidence, known limits, and deferrals.
9. `CHANGELOG.md` claims only completed localhost capability; it makes no provider, deployment, external-link validity, or production claim.
10. The final repository gate has passed in the documented supported environment, or the sprint is recorded as blocked.

## 8. Required final sequence

1. Antigravity plans and executes the exact S07-07 specification.
2. Project Owner runs `npm run db:bootstrap` against `jsf-pm-dev` to reconcile the new Sandbox corpus, if implementation changed the bootstrap script.
3. Run S07-07 focused checks and resolve only verified S07-07 defects.
4. Perform and record the S07-07 manual matrix using `Acme Sandbox Campaign` for mutations.
5. Run the final integrated repository gate once all implementation/runbook/changelog artifacts exist.
6. Write the factual closeout record only after all results are known; do not prefill outcomes.
7. Project Owner reviews the closeout, then performs any chosen Git operation separately.

## 9. Deferred successors

External-provider activation program and E10 retain ownership of provider configuration/dispatch, receipts, schedules, hosted deployment, DNS, backup/restore drill, production database validation, legal/privacy, real-device/performance testing, release, and handover.
