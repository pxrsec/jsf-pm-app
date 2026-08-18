# S02-E02 Data Plane Manual Verification Checklist

**Document Version:** 1.2  
**Feature:** Authoritative Data Platform and Access Controls (S02-E02-03)  
**Target Environment:** `jsf-pm-dev` (Persistent Development & Localhost Demonstration Corpus)

---

## 1. Overview and Operational Purpose

This document provides a concise engineering checklist for milestone-based manual verification of the Supabase PostgreSQL data plane and access controls. 

It exercises the persistent synthetic development-demo corpus populated by `scripts/bootstrap-dev-demo-data.ts` (`npm run db:bootstrap`) across all 9 synthetic role personas:

| Persona Email | Display Name | Application Role | Primary Demonstration Scope |
|---|---|---|---|
| `demo-admin@demo.jsf.internal` | Demo Admin | `admin` | Full system visibility, administrative project recovery |
| `demo-pm-lead-a@demo.jsf.internal` | Demo PM Lead A | `pm` | Primary PM Lead on `Acme Brand Relaunch` & `Acme Sandbox Campaign`, Lead on `Internal Workflow Automation` |
| `demo-pm-lead-b@demo.jsf.internal` | Demo PM Lead B | `pm` | Co-Lead on `Acme Brand Relaunch` & `Acme Sandbox Campaign`, Primary Lead on `Starlight Summer Campaign` |
| `demo-watcher-a@demo.jsf.internal` | Demo Watcher A | `pm` | Advisory Watcher on `Acme Brand Relaunch` & `Acme Sandbox Campaign` |
| `demo-operator-a@demo.jsf.internal` | Demo Operator A | `operator` | Assigned to `Brand Identity Guidelines` (Task 1 / Deliverable 1) and `Brand Asset Archiving` (Task 4) |
| `demo-operator-b@demo.jsf.internal` | Demo Operator B | `operator` | Assigned to `Hero Promo Video Production` (Task 2 / Deliverable 2) & Starlight tasks |
| `demo-client-a1@demo.jsf.internal` | Demo Client A1 | `client` | Acme Corp member; assigned to `Client Vector Logo Assets` (Task 3 / Deliverable 3) |
| `demo-client-a2@demo.jsf.internal` | Demo Client A2 | `client` | Acme Corp member; second client reviewer on `Acme Brand Relaunch` |
| `demo-client-b1@demo.jsf.internal` | Demo Client B1 | `client` | Starlight Media member; member of `Starlight Summer Campaign`; isolated from all Acme Corp projects |

> [!NOTE]
> This checklist is an engineering reference executed as milestone reviews when corresponding application interaction paths, Server Actions, or controlled database inspection are available. It is not an automated CI suite and is not exhaustive live-database proof.

### 1.1 Operating modes — reference evidence and usable demo

`jsf-pm-dev` is a persistent development and localhost client-demonstration environment. It is meant to be used, not frozen. The application must allow every normal, authorized product mutation when its UI/API path exists: project and task changes, reviews, recovery, comments, client submissions, and similar behavior all remain usable under the actual role/RLS/RPC policy.

- **Reference scenarios:** named historical records below (`Acme Brand Relaunch`, `Internal Workflow Automation`, `Acme Commercial Q1`, `Acme Teaser 2025`, `Starlight Summer Campaign`) are preserved for read-only inspection and intentionally rejected authorization/lifecycle calls. Do not perform successful mutations on them during routine verification, because that changes the evidence being inspected.
- **Interactive sandbox:** a separately designated sandbox project/corpus (`Acme Sandbox Campaign`) is used for successful UI/UX demonstrations. Demo users and a client may create, transition, review, and mutate data normally. The Project Owner may delete or clean up sandbox/application records and rerun the bootstrap as development requires.
- **Suppressed external effects:** no WhatsApp, Resend email, webhook, or scheduled-worker provider is activated. A user-visible in-app state must accurately show the deferred/suppressed outcome; it must never claim an external message was delivered.

This separation protects stable examples without artificially limiting the application. It does not authorize schema resets, policy bypasses, or production/preproduction operations.

---

## 2. Milestone Verification Scenarios

### Scenario 1: Admin Visibility and Management Access
- **Actor:** `demo-admin@demo.jsf.internal` (`admin`)
- **Inspection / Action:**
  1. Query `projects`, `clients`, `profiles`, and `audit_logs` base tables.
  2. In the interactive sandbox (`Acme Sandbox Campaign`), invoke `recover_project_status` with a mandatory reason.
- **Expected Outcome:**
  - Admin receives full unfiltered rows across all client organizations, internal projects, and immutable audit logs.
  - Admin is permitted to invoke administrative recovery functions with mandatory reason logging in the interactive sandbox.

---

### Scenario 2: PM Lead Scope and Isolation
- **Actor:** `demo-pm-lead-a@demo.jsf.internal` (`pm`)
- **Inspection / Action:**
  1. Query `projects` and `tasks` for assigned project `Acme Brand Relaunch`.
  2. Query projects where the PM holds no active membership (e.g. `Starlight Summer Campaign` where PM Lead B is lead).
  3. In the interactive sandbox, attempt `transition_project_status` or `transition_task_status` on a PM-led project.
- **Expected Outcome:**
  - PM Lead sees rows only for projects where they hold an active `pm_lead` or `pm_watcher` membership.
  - PM Lead can successfully execute transitions and internal review decisions on led sandbox projects.
  - Direct queries or mutation attempts on non-member projects return empty sets or fail authorization.

---

### Scenario 3: Watcher Read and Collaboration Authority Limits
- **Actor:** `demo-watcher-a@demo.jsf.internal` (`pm` / capacity `pm_watcher`)
- **Inspection / Action:**
  1. Query `projects` and `operator_agenda_view` for `Acme Brand Relaunch`.
  2. In the interactive sandbox, create a collaboration comment on a task.
  3. Attempt `transition_project_status` or `review_deliverable` on Deliverable 1.
- **Expected Outcome:**
  - Watcher can view project details and task statuses in read mode.
  - Watcher can create collaboration comments in the sandbox stamped with `author_capacity_snapshot = 'pm_watcher'`.
  - Watcher cannot execute lifecycle transitions, review decisions, or project completion commands (calls fail at the database boundary).

---

### Scenario 4: Operator-to-Operator Isolation
- **Actor:** `demo-operator-a@demo.jsf.internal` (`operator`)
- **Inspection / Action:**
  1. Query `operator_agenda_view`.
  2. Query `tasks` directly for Task 2 (`Hero Promo Video Production`, assigned to Operator B).
  3. Query `project_members` to enumerate other project members.
- **Expected Outcome:**
  - `operator_agenda_view` returns only Task 1 (`Brand Identity Guidelines`), Task 4 (`Brand Asset Archiving`), and Deliverable 1.
  - Task 2 is completely excluded from Operator A's visibility.
  - Operator A receives 0 rows when attempting to enumerate project memberships.

---

### Scenario 5: Client Organization A vs. Client Organization B Isolation
- **Actor:** `demo-client-b1@demo.jsf.internal` (`client` / Starlight Media)
- **Inspection / Action:**
  1. Query `client_project_view` and `client_deliverable_view`.
  2. Query `client_contacts` or `tasks` referencing Acme Corp projects.
- **Expected Outcome:**
  - Client B1 receives zero rows referencing `Acme Brand Relaunch`, `Acme Commercial Q1`, or Acme Corp contacts.
  - Client B1 has access strictly to Starlight Media records (`Starlight Summer Campaign`, `Display Banner Suite`).

---

### Scenario 6: Same-Project Client Task and Submission Isolation
- **Actor:** `demo-client-a2@demo.jsf.internal` (`client` / Acme Corp)
- **Inspection / Action:**
  1. Query `client_task_view` and `client_submission_view`.
  2. Attempt `submit_client_deliverable` on Deliverable 3 (`Vector Logo Package`, assigned to Client A1).
- **Expected Outcome:**
  - Client A2 cannot view or mutate Client A1's directly assigned `client_request` task (Task 3) or `client_submission` deliverable (Deliverable 3).
  - Client A2 can view shared project-level released deliverables (Deliverable 1 in `awaiting_client_review`) through `client_deliverable_view`.

---

### Scenario 7: Client-Safe Projections and Column Protection
- **Actor:** `demo-client-a1@demo.jsf.internal` (`client`)
- **Inspection / Action:**
  1. Query `client_project_view`, `client_task_view`, `client_submission_view`, and `client_deliverable_view`.
  2. Attempt direct `SELECT * FROM projects` or `SELECT * FROM deliverable_feedback`.
- **Expected Outcome:**
  - Projection views return only client-safe columns.
  - `internal_description`, internal collaboration comments, internal review feedback, internal deadlines, and task resources are strictly excluded.

---

### Scenario 8: Production Re-Review Chain Integrity
- **Actor:** `demo-operator-a@demo.jsf.internal`, `demo-pm-lead-a@demo.jsf.internal`, `demo-client-a1@demo.jsf.internal`
- **Inspection / Action:**
  1. Inspect historical feedback on Deliverable 1 (`Brand Guidelines Master PDF`).
  2. Verify sequence:
     - Version 1 received `changes_requested` during `internal` review.
     - Deliverable returned to `pending`.
     - Version 2 was submitted by Operator A (`submit_deliverable_version`).
     - Deliverable transitioned to `awaiting_internal_review`.
     - PM Lead A approved Version 2 (`review_deliverable` with stage `internal`, decision `approved`).
     - Deliverable transitioned to `awaiting_client_review`.
  3. Attempt direct transition bypassing `awaiting_internal_review` back to `awaiting_client_review`.
- **Expected Outcome:**
  - The complete re-review chain is reflected in immutable `deliverable_versions` and `deliverable_feedback`.
  - Direct skip to `awaiting_client_review` without internal review is rejected by `transition_task_status` / `review_deliverable`.

---

### Scenario 9: Client Submission Lifecycle Boundary
- **Actor:** `demo-client-a1@demo.jsf.internal` (`client`)
- **Inspection / Action:**
  1. Inspect Deliverable 3 (`Vector Logo Package`).
  2. Verify submission provider is resolved from URL (`wetransfer`).
  3. Check status is `submitted`.
  4. Attempt `review_deliverable` on Deliverable 3.
- **Expected Outcome:**
  - Deliverable terminates at `submitted`.
  - No `review_deliverable` calls or feedback rows can be created for `client_submission` workflows.

---

### Scenario 10: Completed and Archived Project Representation
- **Actor:** `demo-admin@demo.jsf.internal` / `demo-pm-lead-a@demo.jsf.internal`
- **Inspection / Action:**
  1. Inspect `Acme Commercial Q1` (`status = 'completed'`, `completed_at` populated, canonical completion `audit_logs` record).
  2. Inspect `Acme Teaser 2025` (`status = 'completed'`, `completed_at` and `archived_at` populated).
- **Expected Outcome:**
  - `project_completion_cycles_view` derives completion cycle metrics using the canonical completion audit log.
  - Archived projects are readable for localhost UI/UX demonstrations while segregated from active operational pipelines.

---

### Scenario 11: Notification Queues & Collaboration Comments Visibility
- **Actor:** `demo-client-a1@demo.jsf.internal`, `demo-operator-b@demo.jsf.internal`, `demo-pm-lead-a@demo.jsf.internal`
- **Inspection / Action:**
  1. Query `notification_unread_counts_view` as Client A1 and Operator B.
  2. Inspect `collaboration_comments` on `Acme Brand Relaunch` across capacities (`pm_lead`, `pm_watcher`, `operator`).
- **Expected Outcome:**
  - `notification_unread_counts_view` accurately reflects unread `in_app` notifications for Client A1, Client A2, and Operator B.
  - Collaboration comments display appropriate `author_capacity_snapshot` stamps and are accessible strictly to authorized team roles (denied to clients).
