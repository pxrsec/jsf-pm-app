---
document_id: S09-03-METRICAS-TABS-AND-GLOBAL-PM-AUTHORITY-IMPLEMENTATION-SPEC-02
sprint_id: S09
work_item: S09-03
status: blocked-pending-metrics-project-options-migration-and-types
created_at: 2026-08-27T00:00:00-06:00
branch: feature/metrics-expansion
target_environment: jsf-pm-dev
required_applied_migrations:
  - supabase/migrations/20260826110000_s09_user-scoped-operations-metrics.sql
  - supabase/migrations/20260827100000_s09-project-metrics-scope-filter.sql
  - supabase/migrations/20260827101000_s09-pm-global-user-metrics-authority.sql
  - supabase/migrations/20260827102000_s09-metrics-project-filter-options.sql
---

# S09-03 — Métricas Tabs and Global PM Metrics Authority

## Objective

Refine the protected **Métricas** surface into two URL-addressable tabs:

1. **Project metrics:** established aggregate summary, distributions, cycle metrics, and trend.
2. **User metrics:** operational evidence per user, defaulting to all users and filterable by project and user.

Both active `admin` and `pm` accounts may audit **All projects** or one selected non-deleted project in both tabs. PM authority is global because PM accounts are the company owners. Project membership, `pm_lead`, and `pm_watcher` must never gate PM metrics access.

This changes only metrics read authority and metrics presentation. It does not promote PM membership capacity into an app role, mutate lifecycle permissions, expose raw audit data, introduce exports, or create Operator/Client metrics access.

## Prerequisites and order

Before implementation, the Project Owner applies these exact migrations to `jsf-pm-dev`, in filename order, then regenerates and commits `src/lib/database.types.ts` unchanged:

1. `20260826110000_s09_user-scoped-operations-metrics.sql` — already applied.
2. `20260827100000_s09-project-metrics-scope-filter.sql` — already applied.
3. `20260827101000_s09-pm-global-user-metrics-authority.sql` — already applied.
4. `20260827102000_s09-metrics-project-filter-options.sql` — required before implementation.

The fourth forward migration is required because `projects_select_policy` allows an ordinary PM to select only projects they are a member of. Reusing either archive project-options helper would silently reintroduce the rejected membership restriction. After applying migration 4, regenerate `src/lib/database.types.ts` again through Supabase MCP and commit it unchanged.

No migration may be edited after application. A failure requires a new reviewed forward migration; do not hand-edit generated types or work around an absent RPC with direct queries, casts, or service role access.

## Database authority contract

### Aggregate Project metrics RPCs

`20260827100000_s09-project-metrics-scope-filter.sql` replaces the bodies of:

```text
get_scoped_operations_metrics(p_project_id uuid, p_from timestamptz, p_to timestamptz)
list_scoped_operations_metric_trend(p_project_id uuid, p_from timestamptz, p_to timestamptz)
```

They preserve function names, signatures, DTO shapes, `STABLE SECURITY DEFINER`, `postgres` ownership, fixed search path, and authenticated-only execute grants.

For an active `admin` or `pm` profile:

- `p_project_id = null` returns the aggregate over all non-deleted projects.
- A selected non-deleted project ID narrows every aggregate and trend bucket to that project.
- An unknown/deleted selected ID produces an empty aggregate scope. The app prevents this by validating against its role-safe project option list before calling the RPC.
- Active PM accounts have the same global/selected scope as Admin. They do not require `project_members` membership, `private.is_project_pm`, or `private.is_project_lead`.
- Queue metrics are available to active PMs as company owners and are narrowed to a selected project when selected.
- Operator, Client, unauthenticated, inactive, or soft-deleted profiles are denied.

### User metrics RPC

`20260827101000_s09-pm-global-user-metrics-authority.sql` replaces the body of:

```text
list_scoped_user_operations_metrics(
  p_project_id uuid,
  p_user_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
```

It preserves the existing purpose-limited aggregate row shape and range semantics. It replaces only the old PM project-membership requirement with an active-role gate:

| Caller | Omitted project | Selected project | User filter |
| --- | --- | --- | --- |
| Active Admin | All non-deleted projects | Selected project | Optional, constrained to returned scope |
| Active PM | All non-deleted projects | Selected project | Optional, constrained to returned scope |
| Operator / Client / inactive / unauthenticated | Denied | Denied | Denied |

The UI continues to fetch the full validated permitted user result for the active project/range and derives the selector and selected-user detail from it. It does **not** send arbitrary user IDs to the RPC and does not aggregate base tables in the browser.

### Project filter options RPC

`20260827102000_s09-metrics-project-filter-options.sql` adds:

```text
list_scoped_metrics_project_filter_options()
```

It is the sole project-option source for **both** metrics pages. It returns only `(project_id, project_name)` for every non-deleted project, ordered by name then ID, and permits only active `admin`/`pm` callers. Implement one server-only metrics adapter around this RPC with fail-closed row validation and a metrics-local `{ id, name }` DTO. Do not call `fetchArchiveProjectFilterOptionsForAdmin` or `fetchArchiveProjectFilterOptionsForPm` from either metrics page: those helpers follow archive/RLS membership rules and cannot satisfy global PM metrics authority.

## Canonical URL state

```text
/admin/metricas?tab=projects|users&projectId=<optional UUID>&userId=<optional UUID>&from=<ISO>&to=<ISO>
/pm/metricas?tab=projects|users&projectId=<optional UUID>&userId=<optional UUID>&from=<ISO>&to=<ISO>
```

1. Missing, malformed, or unsupported `tab` defaults in memory to `projects`; do not redirect just to canonicalize it.
2. Missing `projectId` is **All projects** for both Admin and PM.
3. For either role, validate a supplied `projectId` against a narrow role-safe all-project option list. An invalid value normalizes to absent; never pass it to an RPC.
4. `userId` applies only to the User metrics tab. It is opaque, never rendered/copied/logged, and may be selected only from the current validated user result.
5. A project change clears `userId` in the same locale-preserving navigation. A range change retains it only while it is present in the newly returned result.
6. Keep existing offset-bearing Mexico City `[from,to)` normalization and 93-day maximum. No local storage, client RPC, background refresh, or all-time range option.

## Tab composition

- Use one installed tabs primitive with exactly one mounted `TabsList` and one set of `TabsTrigger` elements. Do not render hidden duplicate tabs at a breakpoint.
- Active tab state is URL-derived; a tab click changes `tab` and preserves valid filters.
- Localize tab labels, filter labels, badges, empty/unavailable states, and data semantics in both supported catalogs.
- Render only the active data-heavy tab. Do not render both tab panels and hide one with CSS.
- Keep server page data ownership. Client components may own controls, sort order, disclosures, and URL navigation only.
- Preserve independent section failure isolation: a failed user RPC does not hide project metrics, and vice versa.

## Project metrics tab

### Adapter

Update `src/lib/operations-metrics/schemas.ts` so Admin **and PM** metrics query schemas accept optional `projectId` UUIDs. Update both aggregate RPC calls in `src/lib/operations-metrics/queries.ts` to pass:

```ts
p_project_id: query.projectId ?? undefined
```

Remove the current role branch that strips an Admin project ID. Do not change existing DTO validation, range equality checks, bucket checks, null/zero behavior, or formulas.

### UI

- The project selector for both Admin and PM starts with localized **All projects**, represented by no `projectId`, followed by the validated result of `list_scoped_metrics_project_filter_options()`.
- The scope badge says All projects or the selected project name for either role and is derived from the validated project ID, never the raw URL value.
- **Project metrics tab:** `MetricsFilterBar` renders the range controls and the project selector.
- **User metrics tab:** `MetricsFilterBar` renders range controls only; `UserMetricsScopeControl` renders the project and user selectors. Introduce an explicit prop such as `showProjectSelector` so the selected-project control cannot be rendered twice on the User tab.
- Preserve the existing cards, distributions, cycle summary, and trend presentation; the selected scope must now be reflected by all four.
- Changing project clears `userId`; selecting All projects deletes `projectId`.
- `normalizeMetricsSearchState` may retain a syntactically valid UUID candidate for either role, but each page must construct the query passed to every RPC as `{ ...normalizedRange, projectId: validatedProjectId }`. The validated ID comes only from the metrics project-options RPC; invalid/missing values become `undefined`. Do not pass `currentQuery` before this replacement.

## User metrics tab

- Defaults to **All users** in the all-project scope for both Admin and PM.
- Provides the same all-project/selected-project selector to both roles, and a user selector containing All users plus only users returned by the validated user RPC.
- The selected user filters the returned table/card rows and opens the existing detail panel. Do not send the selected user ID to the fetch query.
- Retain the existing desktop semantic table and narrow-width explicit stacked cards.
- Retain all field semantics: zero is a real zero; null averages are “No measured observations”; current active tasks are a current snapshot; notification `read_at` is only in-app acknowledgement evidence.
- Do not add performance scores, rankings, percentages, SLAs, attendance claims, “ignored” language, raw audit IDs, emails, contact data, provider payloads, or exports.

## Expected implementation targets

```text
src/lib/database.types.ts                                      (owner-generated only)
src/lib/operations-metrics/schemas.ts
src/lib/operations-metrics/queries.ts                          (add metrics project-options adapter here or a focused sibling)
src/lib/operations-metrics/types.ts                            (metrics-local project option DTO if needed)
src/lib/operations-metrics/date-utils.ts
src/lib/user-operations-metrics/schemas.ts
src/app/[locale]/(protected)/admin/metricas/page.tsx
src/app/[locale]/(protected)/pm/metricas/page.tsx
src/components/shared/metrics/metrics-filter-bar.tsx
src/components/shared/metrics/user-operational-audit-section.tsx
src/components/shared/metrics/user-metrics-scope-control.tsx
src/components/shared/metrics/<one focused tabs component if required>
messages/en.json
messages/es.json
```

Do not add a duplicate route, browser table reads, service-role client, new PM application role, project-membership authorization branch, export, provider behavior, broad refactor, or test harness.

## Focused verification only

No TDD expansion, fixtures, broad test suite, coverage, E2E automation, `npm run verify`, or full build is required.

Run only:

```bash
npm run typecheck
npm run lint
```

Then manually verify the two authenticated journeys:

1. **Admin:** Each tab defaults to All projects; selected project changes all project metrics and user rows; User metrics defaults to All users and a selected returned user filters correctly.
2. **PM:** The exact same All projects and selected-project controls/functions are available without project membership. Both tabs show global data by default; a selected project/user changes only the requested scope.

The Project Owner separately verifies the deployed migration catalog: all three function definitions, owner/grants/search path, global and selected scopes for active Admin and PM, denial for inactive/Operator/Client callers, 93-day range rejection, and no mutation from read calls.

## Completion criteria

1. Two accessible, URL-derived tabs are available only on Admin and PM metrics routes.
2. Active PM and Admin accounts can audit All projects or one selected project in both tabs without any project-membership gate.
3. User metrics defaults to all users and safely supports project/user filtering.
4. Invalid project/user state fails closed by normalization; changing project clears user selection.
5. Existing user-metrics privacy/data-semantics limits remain intact.
6. Only the focused typecheck, lint, and manual evidence above is recorded.
