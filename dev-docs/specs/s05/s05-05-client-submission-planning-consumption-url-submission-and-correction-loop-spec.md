# S05-05 — Deliver Client-Submission Planning Consumption, URL Submission, and Correction Loop

**Sprint:** S05  
**Work item:** S05-05  
**Status:** Migration source authored; pending review, development-only application, generated types, and focused schema evidence before application implementation  
**Last reviewed:** 2026-08-22  
**Spec authority:** `dev-docs/specs/s05/s05-e06-e07-operator-and-client-execution-sprint-plan.md`, especially Sections 4–7 and 9; `dev-docs/specs/s05/s05-e06-e07-contract-mapping-reference.md`, especially Sections 2, 5.3, 6.2, and 7.4; `dev-docs/specs/s05/s05-04-client-portal-safe-project-dashboard-and-direct-request-queue-spec.md`; `dev-docs/specs/s02/s02-e02-authoritative-data-platform-and-access-controls-v1.0.md`; committed migrations and generated types.  
**Dependencies:** completed S05-01 mapping; completed S05-04 Client portal/request/review baseline at `22bacad9c2a2f2b8e94a9ae27aec306957342ad3`; accepted S02 external-URL and immutable-client-submission policy.  
**Migration operation:** the reviewed, committed source is applied only to `jsf-pm-dev` through the project’s controlled Supabase MCP route. The resulting `src/lib/database.types.ts` output is regenerated through MCP and committed unchanged. No application worker may use dashboard/direct SQL workarounds.

---

## 1. Objective

Extend the existing Client request detail so the direct Client assignee can submit a requested external asset as a **raw, lexically validated public HTTPS URL**, see the authoritative terminal `submitted` result, and provide a replacement URL only after an authorized PM Lead/Admin correction reopen.

This is a deliberately separate external-input workflow:

```text
initial input:     pending ──submit_client_deliverable()──> submitted
correction input:  submitted ──reopen_client_deliverable()──> pending
                   pending ──submit_client_deliverable()──> submitted
```

Each accepted Client submission creates an immutable `deliverable_versions` row. The Client never edits a historical URL, self-reopens, reviews, approves, requests changes, delivers, or otherwise enters the production-deliverable lifecycle.

The feature is complete only when the direct Client can see the safe planning context and permitted immutable history for their assigned input, enter one conforming URL, review an explicit truthful confirmation, submit through the constrained RPC, and recover correctly from validation, permission, stale-state, and connection failure without a false local result.

---

## 2. Scope and explicit exclusions

### 2.1 In scope

1. Consume the existing direct-assignee `client_submission_view` only through the Client query layer and attach the interactive submission affordance only to direct child submissions already returned on `/cliente/tareas/[task-id]`.
2. Add the Client public-HTTPS lexical validation contract at the TypeScript feedback boundary and, as a prerequisite, make the database/RPC boundary enforce the same accepted/rejected corpus.
3. Add a Client-specific submission schema, narrow command adapter, and direct async Server Action that call `submit_client_deliverable()` exactly once with server-derived identity and browser-owned URL plus an optional Client note.
4. Add a focused interactive Client Component for URL entry, confirmation, pending/double-submit protection, safe error mapping, terminal-state presentation, and correction replacement submission.
5. Extend the Client-safe projection with the narrowly required correction-history representation so historical immutable versions and the Client-safe audited reopen context can be rendered without direct audit/version-table queries.
6. Revalidate the concrete Spanish and English Client request/project routes affected by a successful submission, then use `router.refresh()` only as the UI follow-up.
7. Extend the existing Client focused test suites with validator, query-model, action, rendering, isolation, correction, localization, and accessibility coverage.

### 2.2 Explicitly excluded

- A Client route or global navigation item for submissions. Submission remains inside the canonical parent request detail; no dead deep link is introduced.
- Client self-reopen, PM/Admin reopen UI, reason authoring, assignment/planning edits, task status changes, project administration, Client-member enumeration, comments, audit-log UI, notification history, link-incident reporting, archive/search, metrics, or calendar work.
- Production submission, production review, Client production-review actions, formal feedback, approval, `changes_requested`, internal review, client-review deadlines, delivery, or review-inactivity UI on a `client_submission` record.
- File upload/storage, provider authentication, Drive/Dropbox/OneDrive/WeTransfer/Frame.io API access, remote URL resolution, DNS lookup, HTTP request, preview, proxy, redirect following, download, scan, content inspection, hosting, reachability check, or a claim that external content was uploaded, verified, safe, received, or delivered.
- Offline caches, persisted form/mutation queues, replay, service workers, background synchronization, polling, broad Realtime, provider activation, email/WhatsApp dispatch, webhooks, schedules, hosted-environment work, OpenAPI changes, direct DDL, dashboard edits, destructive reset, or generic SQL.
- `CHANGELOG.md`, final S05 closeout, sprint-wide manual journeys, and full integrated repository verification; S05-07 owns those aggregate artifacts.

### 2.3 Non-negotiable security and truthfulness rules

- `requireSession()` and `profiles.role` remain the sole application-role authority. Route parameters, IDs in a form, current component state, provider labels, status badges, or a browser-supplied actor/project/task/version/reopen flag grant no authority.
- A Client reads a submission only through `client_submission_view`; that view/RLS establishes the direct-assignee boundary. Project membership is not sufficient to read or mutate a submission.
- Every query uses explicit least-privilege fields. `select("*")`, base-table reads, direct version reads, audit reads, internal workspace helpers, browser-side authorization filters, and type assertions that invent safe fields are prohibited.
- The database command remains authoritative for direct-assignee authorization, workflow type, `pending` state, row locking, provider classification, successor version number, immutable version insertion, terminal status, audit insertion, and notification-event creation.
- A browser component must not append a version, increment a version number, alter the terminal badge, mark a request completable, or claim success until it receives an accepted command result and refreshes the server-rendered representation.
- User-visible copy maps only stable result codes to localized catalog keys. It must never render raw RPC/PostgREST/SQL text, policy details, UUIDs, raw error payloads, audit metadata, internal roles, or a private/unreturned URL.
- A stored submission URL may be shown only through the Client-safe representation and only as an intentional outbound link after user action. The application does not treat lexical validity as proof of reachability, ownership, safety, content, or provider acceptance.

---

## 3. Reconciled baseline and discovered migration prerequisite

### 3.1 Existing application boundary to preserve

S05-04 already establishes the required Client-safe request surface:

| Existing asset | Confirmed responsibility | S05-05 treatment |
| --- | --- | --- |
| `src/lib/client/request-queries.ts` | `getClientRequestDetail()` reads `client_task_view` and direct child rows from `client_submission_view`, then returns `ClientRequestDetail.childSubmissions`. | Extend only the safe submission model/read selection after the migration. Do not create a broad project-deliverable query. |
| `src/lib/client/types.ts` | `ClientSubmissionRequirementSummary` holds the safe current title/specifications/deadline/status/version/provider/URL/note context. | Extend with a narrow, parsed correction-history field only when the updated view declares it. |
| `src/lib/client/schemas.ts` | Contains narrow Client request/review envelopes. | Add a submission envelope only; keep action-owned state fixed server-side. |
| `src/lib/client/actions.ts` | Direct async Client request/review Server Actions with role gate and concrete route revalidation. | Add one direct async Client-submission Action; do not broaden existing start/complete actions or create a generic lifecycle action. |
| `src/app/[locale]/(protected)/cliente/tareas/_components/client-request-detail.tsx` | Canonical request detail renders child `ClientSubmissionCard` summaries. | Wire a focused submission interaction only for a returned direct child record; preserve the request action boundary. |
| `client-submission-card.tsx` | Read-only card used by request and project details. | Keep it read-only in the project-detail context. Either add an explicit interaction slot used only by request detail or add a distinct request-detail submission component; it must not turn all project cards into mutable controls. |
| `src/lib/deliverables/commands.ts` | Existing low-level production command adapters and shared `CommandResult`/error mapping conventions. | Add a narrow `submitClientDeliverable()` RPC adapter; do not reuse production `submitDeliverableVersion()`. |

### 3.2 Confirmed database facts

The committed source declares:

- `submit_client_deliverable(p_deliverable_id uuid, p_submission_url text, p_submission_note text default null)`; it locks the logical deliverable, permits only the direct assignee on `workflow_type = 'client_submission'` while status is `pending`, writes a new immutable version, classifies a provider, sets `submitted`, writes audit/event evidence, and returns `{ deliverable_id, version_id, version_number, provider, status }`.
- `reopen_client_deliverable(p_deliverable_id uuid, p_reason text)` is an Admin/active PM Lead-only command. It moves `submitted → pending`, preserves versions, records the non-empty reason in audit/event data, and creates an in-app recipient record for the direct assignee.
- `client_submission_view` currently returns current-version fields only: direct submission/task/project identity, title, specifications, status, current version/provider/URL/note/submitted timestamp, last activity, and submission deadline. It does **not** expose immutable prior versions, a reopen event, a Client-safe reopen reason, or a correction-history representation.

### 3.3 Blocking contract mismatch

The current `submit_client_deliverable()` SQL uses only this permissive regex before inserting a version:

```text
^https://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$
```

That implementation does not enforce the accepted cross-project URL policy at the authoritative boundary. In particular, it does not impose the accepted 2,048-byte maximum and permits whitespace/control-like path content that the accepted policy prohibits. It also lacks the precise shared lexical contract required for all of the prohibited forms below. A browser-only validator would therefore create a security-relevant acceptance mismatch.

The current projection also cannot satisfy the item’s required safe correction history: it exposes only the current version and has no safe representation of prior immutable version records or the audited correction reason/context. Querying `deliverable_versions` or `audit_logs` directly would violate the Client-safe projection boundary.

**Conclusion:** S05-05 has a genuine, narrowly bounded database-policy/projection gap. A forward-only S05-05 migration is required and must be applied to `jsf-pm-dev` through Supabase MCP before implementation relying on this contract proceeds. This is not permission to broaden the schema or use a UI-only workaround.

---

## 4. Required migration contract — controlled prerequisite

### 4.1 Authorized migration scope

Create one append-only migration, named with its actual UTC timestamp and a lowercase kebab-case S05-05 slug. Its scope is limited to:

1. authoritative lexical validation and provider classification for `client_submission` URLs;
2. replacement/hardening of `submit_client_deliverable()` to use that policy before immutable insertion;
3. a Client-safe direct-assignee correction-history representation in `client_submission_view`; and
4. the minimum private security-definer helper necessary to derive the safe correction history from immutable records/audited reopen evidence without granting a Client raw table/audit access.

It must not change tables, roles, RLS policy intent, production Google Drive validation, production RPCs, workflow enums, notification dispatch, Realtime scope, public HTTP interfaces, or hosted environments other than the approved `jsf-pm-dev` application.

### 4.2 Authoritative Client URL contract

The raw submitted string is accepted only when all conditions are true:

1. It is at most **2,048 bytes** (`octet_length`), not merely JavaScript character length.
2. It contains no whitespace or control character anywhere in the raw value, and no backslash. The validator must not trim or otherwise silently normalize an unsafe raw value into an accepted URL.
3. It is an absolute URL with the `https:` scheme exactly; HTTP and scheme-relative values are rejected.
4. It has no username or password component; credential-bearing `https://user:pass@…` and `https://user@…` forms are rejected.
5. It has no explicit port, including `:443`; only the implicit HTTPS default is accepted.
6. Its host is a syntactically valid public DNS hostname. `localhost`, a single-label host, IPv4 literal, IPv6 literal, loopback, link-local, private, carrier-grade NAT, documentation, multicast, reserved, or any other IP literal is rejected without a DNS/network lookup.
7. The URL may include a normal path, query, and fragment. A non-empty path is **not** required for this Client-input workflow; `https://example.com`, `https://example.com?token=x`, and `https://example.com/#asset` are lexically valid if every other condition is met.
8. No remote request of any kind occurs while parsing, classifying, validating, rendering, or submitting the URL.

The contract is lexical. A syntactically valid public DNS hostname does not establish that it resolves publicly or that any resource exists.

### 4.3 Provider classification contract

The database must derive the `submission_provider`; the browser may show only its local preview after the same lexical validation and must treat the RPC result as final.

| Classification | Allowed hostname rule, case-insensitive after lexical hostname parsing |
| --- | --- |
| `google_drive` | exactly `drive.google.com` or `docs.google.com` |
| `dropbox` | exactly `dropbox.com` or a subdomain ending in `.dropbox.com` |
| `onedrive` | exactly `onedrive.live.com`, a subdomain ending in `.onedrive.live.com`, exactly `1drv.ms`, or a subdomain ending in `.1drv.ms` |
| `wetransfer` | exactly `wetransfer.com`, a subdomain ending in `.wetransfer.com`, exactly `we.tl`, or a subdomain ending in `.we.tl` |
| `frame_io` | exactly `frame.io`, a subdomain ending in `.frame.io`, exactly `f.io`, or a subdomain ending in `.f.io` |
| `other_https` | every other URL that satisfies Section 4.2 |

Look-alike/suffix hosts such as `drive.google.com.evil.example`, `notdropbox.com`, `frame.io.evil.example`, and `example-we.tl` must be `other_https`, not a named provider.

### 4.4 Optional Client note policy

The submission note is optional and is stored only on the new immutable `deliverable_versions` row.

1. The form accepts an empty value. After trim, an empty or whitespace-only value is normalized to `NULL`; it is not a validation error.
2. A non-empty note has a maximum of **1,000 Unicode characters after trimming**. The form uses a visible live counter; the Server Action and the authoritative RPC enforce the same limit.
3. Newlines and ordinary printable text are permitted. The note is plain text, not markup: render it as text with preserved line breaks and never interpret it as HTML/Markdown.
4. A note belongs to the submitted version and is immutable. A replacement submission may carry a different optional note, but it cannot edit an earlier note.
5. Exposure is least-privilege: the direct Client assignee may see it only through `client_submission_view` and safe correction history; existing authorized Admin/PM workspace readers may see it through their established immutable version representation. It is not project-wide Client information and never appears in production review, formal feedback, audit, notification, or external-provider output.
6. The note is not included in the submission command result, notification event payload, or any user-visible success toast. The refreshed safe view is the only presentation source.

### 4.5 Database implementation requirements

1. Create a private immutable/strict lexical helper, for example `private.is_valid_client_submission_url(text)`, with public execution revoked. It must enforce Section 4.2 without network access.
2. Create a private immutable/strict classifier, for example `private.classify_client_submission_provider(text)`, which is callable only from trusted SQL and returns the existing `submission_provider` enum according to Section 4.3.
3. Replace `public.submit_client_deliverable()` with a function of the same public signature and existing authorization/locking/audit/event behavior. Before version insertion it must call the validator; after validation it must use the classifier. It must return the same JSON keys and enum/provider meaning as the existing command.
4. Do not accept a caller-supplied provider, version number, actor, status, task/project relationship, or correction/reopen flag.
5. Keep `reopen_client_deliverable()` as the sole authorized `submitted → pending` operation. Do not make the Client-visible correction context a mutation capability.
6. Extend `client_submission_view` with exactly one safe correction-history representation, named `correction_history`, typed as `jsonb`. It must be direct-assignee scoped by the view/RLS plus any private helper’s own direct-assignee check.
7. `correction_history` must be an array in deterministic ascending event/version order. Each version entry may contain only `kind: "version"`, `version_number`, `submission_url`, `submission_provider`, `submission_note`, and `submitted_at`. Each authorized reopen entry may contain only `kind: "reopened"`, `reopened_at`, and the PM/Admin-authored `reason`. Do not include actor IDs/names, role/capacity, audit IDs, notification IDs, internal timestamps unrelated to the correction, or any unreturned table fields.
8. The safe correction history must not expose an audit row unless the current caller is still the direct Client assignee for that logical deliverable. A Client who is not directly assigned must receive no row through the view and no helper-derived leakage.
9. Preserve `security_invoker = true` for `client_submission_view`. The narrowly scoped `SECURITY DEFINER` history helper must set a safe search path, validate the current direct Client assignee internally, return only the fixed JSON schema above, have execution revoked from `public` and `anon`, and grant `authenticated` only the minimal execution required for projection resolution. Its direct result for any non-assignee is the empty history array, never audit detail.
10. Do not expose or query correction history in `client_project_view`, `client_task_view`, `client_deliverable_view`, internal workspace views, or a general audit endpoint.

### 4.6 Required migration evidence and generated types

The controlled schema workflow must:

1. review the committed migration source and focused static/database test contract before remote application;
2. apply the exact reviewed migration to **`jsf-pm-dev` only** using Supabase MCP;
3. regenerate `src/lib/database.types.ts` through Supabase MCP and commit the untouched generated output. The expected type delta is the `client_submission_view.correction_history: Json | null` declaration; no hand-edit is permitted;
4. record source migration, applied environment, generated-type provenance, and accepted/rejected corpus results distinctly; and
5. stop if the generated types, deployed function/view, or corpus results differ from the reviewed migration.

### 4.7 Migration acceptance corpus

The exact corpus must run against both the TypeScript validator and the authoritative applied database command. Every case must produce the same acceptance/rejection result; accepted cases must produce the listed provider.

| Case | Expected result |
| --- | --- |
| `https://drive.google.com/file/d/abc/view` | accept, `google_drive` |
| `https://www.dropbox.com/s/example/asset.mov` | accept, `dropbox` |
| `https://1drv.ms/u/s!example` | accept, `onedrive` |
| `https://we.tl/t-example` | accept, `wetransfer` |
| `https://f.io/example` | accept, `frame_io` |
| `https://assets.example-cdn.com/client/file.mp4?download=1#preview` | accept, `other_https` |
| `https://assets.example-cdn.com` | accept, `other_https` |
| `http://assets.example-cdn.com/file` | reject |
| `//assets.example-cdn.com/file` | reject |
| `https://user:pass@assets.example-cdn.com/file` | reject |
| `https://user@assets.example-cdn.com/file` | reject |
| `https://assets.example-cdn.com:443/file` | reject |
| `https://localhost/file` | reject |
| `https://127.0.0.1/file` | reject |
| `https://[::1]/file` | reject |
| `https://10.0.0.1/file` | reject |
| `https://192.0.2.10/file` | reject |
| a raw whitespace/control-character URL | reject |
| a URL containing `\\` | reject |
| a valid-looking URL longer than 2,048 bytes | reject |
| `https://drive.google.com.evil.example/file` | accept, `other_https` |
| `https://notdropbox.com/file` | accept, `other_https` |

A mismatch is a security stop condition. Do not weaken the browser validator, apply an exception in a component, or claim a known-host classification without the authoritative function result.

---

## 5. Application data, schema, command, and action contract

### 5.1 Safe Client read model

After the migration/type generation, extend `ClientSubmissionRequirementSummary` with a parsed safe field such as:

```ts
correctionHistory: Array<
  | {
      kind: "version";
      versionNumber: number;
      submissionUrl: string;
      provider: SubmissionProvider;
      note: string | null;
      submittedAt: string;
    }
  | {
      kind: "reopened";
      reopenedAt: string;
      reason: string;
    }
>;
```

The parser must accept only the declared JSON shape and valid known provider/status values. A malformed/null/unexpected history payload becomes a safe `unavailable` representation; it must not trigger a base-table/audit fallback, an unsafe cast, or a partially fabricated history. The current summary continues to contain only the direct-assignee-safe fields already used by S05-04.

`getClientRequestDetail()` must:

1. validate the task route UUID before querying;
2. query only `client_task_view` for the direct request and `client_submission_view` constrained to the returned task ID;
3. select the explicit existing fields plus `correction_history` after it exists in generated types;
4. associate only returned submission rows whose `task_id` matches the visible returned direct request; discard inconsistent rows;
5. return `null` for malformed, absent, foreign, or non-visible task IDs; and
6. preserve the advisory request completion summary. Its calculation treats only `submitted` children as terminal; it never treats a correction context as a production review state.

Add a separate safe target lookup, for example `getClientSubmissionForSubmission(supabase, deliverableId)`, which:

- validates the UUID;
- reads only `client_submission_view` with explicit `id, task_id, project_id, status, current_version_number` fields required for preflight/revalidation;
- returns `null` for absent/non-visible/foreign/malformed data;
- returns only direct-assignee-safe target fields; and
- does not query the parent task, base deliverable, versions, audit, project membership, or an internal detail helper.

The target lookup is an explanatory stale-state preflight. The RPC remains final authority.

### 5.2 Browser envelope and TypeScript validator

Add a narrow schema in `src/lib/client/schemas.ts`:

```text
{
  deliverable_id: UUID,
  submission_url: raw string,
  submission_note: optional string
}
```

The Server Action receives `unknown`, validates this envelope, and rejects malformed input before it creates a Supabase client or invokes any adapter. The browser may supply only the raw URL and optional note; it must not supply provider, status, current version, task ID, project ID, assignee, actor, role, reopen reason, redirect, or any lifecycle target.

Create one shared pure lexical utility, for example `src/lib/client/submission-url.ts`, with:

```text
validateClientSubmissionUrl(raw):
  { ok: true; provider: SubmissionProvider } |
  { ok: false; reason: stable validator reason }
```

It must use the exact raw input. It may use the platform URL parser only for lexical parsing and hostname extraction; it must not fetch. It must implement the Section 4.2/4.3 corpus, reject before trimming/normalizing unsafe raw input, and return no user-facing prose. The Zod schema and interactive form both call this utility. The database is still authoritative.

The form exposes the raw URL and the optional note defined in Section 4.4. The Zod schema accepts `submission_note` as a string of at most 1,000 characters after trimming; an omitted, empty, or whitespace-only value becomes `null`. The adapter passes the normalized note to the RPC. URL validation remains strict: it uses the raw URL and never trims or normalizes an unsafe URL into acceptance.

### 5.3 Command adapter

Add a typed `submitClientDeliverable()` adapter in `src/lib/deliverables/commands.ts` or a focused server-only Client command module if that better preserves file-size ownership. Its input is the already-validated narrow command shape:

```text
{ deliverable_id, submission_url, submission_note: string | null }
```

It calls `supabase.rpc("submit_client_deliverable", { p_deliverable_id, p_submission_url, p_submission_note })` exactly once and maps the JSON result to:

```text
{
  deliverableId: string;
  versionId: string;
  versionNumber: number;
  provider: SubmissionProvider;
  status: "submitted";
}
```

Reject/mask malformed returned JSON as `UNKNOWN`; never pass it to the browser as raw JSON. Extend the shared safe error mapper so known client-submission conditions map deterministically:

| Condition | Result code |
| --- | --- |
| direct-assignee/RLS failure | `UNAUTHORIZED` |
| absent/non-visible target | `NOT_FOUND` |
| target not pending, stale/replay, or workflow/state mismatch | `INVALID_TRANSITION` or `CONFLICT` according to existing mapper convention |
| authoritative lexical URL rejection | `VALIDATION_FAILED` |
| malformed unexpected RPC result or interrupted request | `UNKNOWN` |

The adapter must never write `deliverables` or `deliverable_versions` directly, derive provider in trusted state, or reuse `submitDeliverableVersion()`.

### 5.4 Direct Client submission Server Action

Add a direct async declaration in `src/lib/client/actions.ts`, conceptually:

```text
submitClientSubmissionAction(rawInput)
```

It must:

1. obtain `cookies()` and call `requireSession()`; invalid/missing session behavior remains fail-closed;
2. return safe `UNAUTHORIZED` for a valid non-Client session without querying/mutating;
3. validate the narrow browser envelope and shared raw URL contract before any target lookup/adapter call;
4. resolve the target only through `getClientSubmissionForSubmission()`; return generic `NOT_FOUND` if absent/non-visible;
5. require returned status `pending` only as a safe preflight; otherwise return `INVALID_TRANSITION` without adapter execution;
6. call `submitClientDeliverable()` exactly once with the safe target ID, raw URL, and normalized optional note;
7. on success, revalidate exactly:
   - `/cliente/tareas` and `/en/cliente/tareas`;
   - `/cliente/tareas/[task-id]` and `/en/cliente/tareas/[task-id]` using the safe returned parent task ID;
   - `/cliente/proyectos` and `/en/cliente/proyectos`;
   - `/cliente/proyectos/[project-id]` and `/en/cliente/proyectos/[project-id]` using the safe returned project ID; and
8. return `CommandResult<ClientSubmissionResult>` only.

The Action does not call `reopen_client_deliverable()`, `transition_task_status()`, production submit/review actions, internal workspace actions, or a generic arbitrary command handler.

---

## 6. User-interface contract

### 6.1 Placement and ownership

The canonical surface remains `/cliente/tareas/[task-id]` and its locale equivalent. It is the only S05-05 interactive location.

- On the Client request detail, a returned direct child submission with `status = "pending"` renders an explicit **Submit requested asset** control and the focused form/confirmation interaction.
- A returned direct child submission with `status = "submitted"` renders a terminal, read-only state and safe immutable history. It has no edit/re-submit/reopen control.
- A returned direct child submission with `status = "pending"` **and** `current_version_number > 0` renders the correction state: a localized explanation that a replacement link is requested, the safe latest reopen reason/context from `correctionHistory`, prior immutable version entries, and the same replacement submission form.
- Any other/null/malformed status/history is a generic safe unavailable/recovery state with no mutation control.
- Project-dashboard submission cards stay read-only even if `pending`; they link only to the existing canonical request detail if a safe parent request route is already available. Do not create a standalone deliverable route or make the dashboard a mutation surface.

### 6.2 Submission form and confirmation

Use one focused Client Component, such as `client-submission-actions.tsx`, rendered from request detail only. A dialog is preferred because the action is terminal and must be deliberate; use existing accessible shadcn dialog primitives, not hand-rolled modal semantics.

The form contains:

1. persistent localized URL label and help text explaining that the application records a link only;
2. one URL input with `type="url"`, no auto-submission, raw-value preservation, associated inline validation, and no provider/network preview;
3. an optional persistent-label note textarea with a 1,000-character live counter, plain-text help, and no required indicator; an empty/whitespace-only note is explicitly accepted and submitted as no note;
4. a provider preview only after successful lexical validation; the preview labels it as a lexical classification, not an accessibility/content check;
5. a confirmation step/dialog showing only deliverable title, raw entered URL, optional note when non-empty, preview provider label, and the no-upload/no-verification truthfulness statement;
6. localized cancel/return/confirm controls and a pending label that prevents duplicate submission; and
7. a safe live-region result/error area.

On confirmation, invoke the Client Action once. On success, clear the raw URL and note from component state, close the confirmation dialog, announce only that the link submission was recorded, and call `router.refresh()`. Do not say the file was uploaded, inspected, accepted by the provider, or delivered.

### 6.3 Terminal and correction presentation

For an authoritative `submitted` result, show:

- localized `submitted` terminal label with text and icon/non-color cue;
- the returned/current version number when safely available;
- provider label when safely available;
- the current stored URL only as a deliberate external link using `target="_blank"`, `rel="noopener noreferrer"`, and localized accessible text that identifies it as an external destination;
- submission timestamp and note only when returned by the safe view; and
- immutable-history items from `correctionHistory`, each visually marked as historical/read-only.

For an authorized reopen now represented as `pending`, show only the safe reason/context provided by `correctionHistory`, not raw audit data. State that a replacement creates a new immutable version and the old submitted link remains unchanged. Do not label it as a production change request, formal feedback, or review outcome.

### 6.4 UI error/recovery matrix

| Condition | Required behavior |
| --- | --- |
| invalid raw URL | Do not invoke Action. Associate localized inline error with input; do not trim/normalize into acceptance. |
| no Client session | Preserve existing fail-closed auth behavior. |
| non-Client role | No command call; safe localized denial. |
| non-visible/foreign/malformed deliverable | Generic safe unavailable state; no ownership/existence detail; refresh current route. |
| preflight status no longer `pending` | Close/disable mutation state, show localized state-changed copy, refresh. |
| RPC validation rejection | Retain raw non-sensitive URL for correction, show localized field-level validation message, no local version/status update. |
| unauthorized/not found | Close stale confirmation, show generic safe denial/unavailable copy, refresh. |
| invalid transition/conflict/replay | No success/history fabrication; show state-changed copy and refresh. |
| unknown/interrupted online failure | Clear pending state, retain only ephemeral raw form input, show retry guidance. Do not persist/replay it. |
| accepted submission | Close interaction, clear raw input, announce recorded `submitted` state, refresh authoritative server data. |

A successful Client submission may cause the parent request completion prerequisite to become satisfied, but it does not complete the task automatically and must not claim it does.

### 6.5 Accessibility and responsive behavior

At a 375px viewport and with keyboard-only operation, the Client must be able to identify a pending/reopened requirement, enter a URL, understand local validation/provider classification, cancel or confirm intentionally, understand terminal/correction state, and deliberately open a stored URL without horizontal scrolling.

Required details:

- dialog title/description, focus containment, Escape/cancel, visible focus, and focus restoration to the invoking submission control;
- persistent field label, associated help/validation/error IDs, `aria-invalid`, and live pending/result feedback;
- 44×44px minimum primary controls/touch targets;
- status/provider/version/correction meaning expressed with text plus icons, never color alone;
- safe history uses semantic list/article markup and wraps long URLs without forcing horizontal page scroll;
- no tooltip/hover-only essential content; and
- complete `es-MX`/`en-US` semantic-key and interpolation parity.

---

## 7. File structure

Every production implementation file remains at or below 400 lines. Split by ownership rather than creating a Client lifecycle mega-module.

```text
supabase/migrations/
└── 20260822095500_s05_05_harden_client_submission_urls_and_correction_history.sql  # NEW; source authored in this work item

src/lib/database.types.ts                                        # MCP-generated only after migration
src/lib/client/
├── submission-url.ts                                             # NEW: pure lexical validator/classifier
├── schemas.ts                                                    # MODIFY: narrow submission envelope
├── types.ts                                                      # MODIFY: parsed correction history/result types/error-key map
├── request-queries.ts                                            # MODIFY: safe correction-history selection/parser and target lookup
├── queries.ts                                                    # MODIFY only as required to re-export existing focused responsibilities
└── actions.ts                                                    # MODIFY: direct submitClientSubmissionAction

src/lib/deliverables/
└── commands.ts                                                   # MODIFY: narrow submitClientDeliverable RPC adapter

src/app/[locale]/(protected)/cliente/tareas/_components/
├── client-request-detail.tsx                                    # MODIFY: request-detail-only action slot and safe history context
└── client-submission-actions.tsx                                # NEW: interactive form/confirmation leaf

src/app/[locale]/(protected)/cliente/proyectos/_components/
└── client-submission-card.tsx                                   # MODIFY only for reusable terminal/history display props; no dashboard mutation control

messages/es-MX.json                                              # MODIFY
messages/en-US.json                                              # MODIFY
__tests__/client/client-queries.test.ts                           # MODIFY
__tests__/client/client-actions.test.ts                           # MODIFY
__tests__/client/client-portal.test.tsx                           # MODIFY
__tests__/client/client-submission-url.test.ts                    # NEW: shared corpus only
```

Do not modify navigation, review routes/actions, Operator code, PM/Admin reopen UI, internal detail/history queries, OpenAPI, environment files, or changelog/closeout artifacts in this item.

---

## 8. Localization contract

Use the established `projects.clientSubmissions` namespace. Add semantic leaves only as needed for:

- submission CTA, dialog title/description, URL label/help/placeholder, lexical provider label, confirmation title/body, and no-upload/no-verification truthfulness;
- pending/terminal/reopened/replacement labels, immutable-version/history labels, safe reopen-reason heading, and external-link accessible text;
- local URL error forms, state-changed/permission/unavailable/conflict/retry feedback, success announcement, cancel/confirm/pending labels;
- correction explanation that distinguishes replacement from a production review or formal change request; and
- accessible names/descriptions for URL field, provider indication, confirmation, close/cancel, submit, stored external link, and history sections.

Rules:

1. Preserve exact key-tree and interpolation-name parity between `messages/es-MX.json` and `messages/en-US.json`.
2. `es-MX` is default visible output; English is the exact semantic counterpart.
3. No component renders hard-coded user-facing prose, raw enum values, raw URL validation reason codes, RPC error strings, IDs, or audit data.
4. Reuse existing common/status keys when they exactly match meaning; do not duplicate visual/component names in message keys.

---

## 9. Focused verification contract

Use the existing Vitest, React Testing Library, and MSW conventions. The user has already completed and committed S05-04 verification; do not rerun it merely to create this specification. S05-05 implementation must add and execute its own focused evidence after the migration prerequisite is accepted and applied.

### 9.1 Migration/database evidence — controlled prerequisite

The migration evidence must prove:

1. each accepted/rejected corpus case in Section 4.6 has identical TypeScript and `jsf-pm-dev` authoritative-command outcomes;
2. accepted known/unknown providers store the expected provider enum; suffix/look-alike hosts are not misclassified;
3. direct Client assignee succeeds; another Client sharing the project cannot read the row/history or call submit; PM/Admin and unrelated users cannot submit as the Client;
4. only direct Client submission in `pending` creates one successor immutable version and `submitted` state; duplicate/stale attempts do not create another version;
5. only active PM Lead/Admin can reopen `submitted`; reason is non-empty; direct Client cannot self-reopen; reopen preserves prior version rows;
6. `client_submission_view` returns only the direct Client’s safe history and does not expose raw audit/actor/notification/internal fields; and
7. generated types reflect the deployed view exactly.

### 9.2 Application tests

#### `__tests__/client/client-submission-url.test.ts`

Cover the complete shared corpus from Section 4.6. Assert lexical-only behavior by mocking/guarding fetch-capable APIs and proving no remote call occurs. Test raw whitespace/control/backslash rejection without silent trimming and exact provider classification, including look-alikes as `other_https`.

#### `__tests__/client/client-queries.test.ts`

Extend to assert:

1. `getClientRequestDetail()` selects only explicit `client_submission_view` fields including migrated correction history;
2. malformed/non-visible task IDs return `null` without base-table fallback;
3. child submission rows are associated only to the returned direct request task;
4. valid safe correction history parses into the narrow presentation model;
5. malformed/unknown correction payload yields a safe unavailable result and no direct audit/version query; and
6. `getClientSubmissionForSubmission()` reads only the direct-assignee safe view and returns no target for absent/foreign/malformed IDs.

#### `__tests__/client/client-actions.test.ts`

Extend to assert:

1. unauthenticated handling preserves `AuthError`; non-Client roles return `UNAUTHORIZED` and invoke no lookup/RPC;
2. malformed envelope or invalid raw URL is rejected before target lookup/adapter invocation;
3. browser input cannot inject actor, provider, task/project, assignee, status, version, reopen reason, or redirect; the optional note is accepted only under the 1,000-character normalization policy;
4. the Action uses only Client-safe target lookup and invokes `submitClientDeliverable()` once with raw URL, normalized note, and target ID;
5. non-pending/stale/missing target produces safe code-based results without a command call;
6. accepted submission revalidates exactly the four route families in both locales with concrete safe task/project IDs;
7. validation, authorization, stale/invalid transition, conflict, and unknown outcomes do not fabricate local status/version/history or persistent replay state; and
8. the Action never calls production submit/review, task transition, or reopen commands.

#### `__tests__/client/client-portal.test.tsx`

Extend to assert:

1. the canonical request detail renders an interactive submit control only for a direct returned pending submission; project detail cards remain read-only;
2. the form provides local field feedback/provider preview without a network request and shows a truthful confirmation summary;
3. terminal `submitted` output contains no edit/reopen/review/approval/feedback/delivery control;
4. an authorized correction context displays only safe reason/history fields and permits replacement submission only while returned status is `pending`;
5. historical links/version entries are visibly read-only and a replacement success relies on refreshed server data;
6. raw-error/ID/internal audit/provider/reachability claims do not render;
7. confirmation focus, Escape/cancel/focus restoration, field error association, pending/double-submit prevention, external-link labeling, non-color status meaning, and narrow layout are represented; and
8. both catalogs retain semantic-key parity for every new leaf.

### 9.3 Implementation verification commands

After the prerequisite migration and focused implementation are complete, execute and report actual outcomes for:

```text
npm run test -- __tests__/client/client-submission-url.test.ts __tests__/client/client-queries.test.ts __tests__/client/client-actions.test.ts __tests__/client/client-portal.test.tsx
npm run typecheck
npm run build
npm run lint
npm run format:check
```

Do not run `npm run verify`, a full test suite, Playwright, S05-wide manual journeys, provider checks, or production/preproduction operations for this work item unless a later authorized owner task changes scope.

---

## 10. Acceptance criteria

- [ ] The required reviewed S05-05 migration is committed, applied only to `jsf-pm-dev` through Supabase MCP, and has untouched MCP-generated type provenance.
- [ ] The authoritative `submit_client_deliverable()` contract and the TypeScript lexical validator have identical outcomes for the Section 4.6 corpus; no browser-only URL acceptance policy remains.
- [ ] A Client submission accepts only raw absolute public HTTPS values meeting the accepted byte-length, credentials, control/whitespace, backslash, hostname/IP-literal, and port policy without remote access.
- [ ] Provider classification is authoritative and correctly distinguishes Google Drive, Dropbox, OneDrive, WeTransfer, Frame.io, and valid unknown `other_https` hosts without suffix/look-alike misclassification.
- [ ] `client_submission_view` provides only direct-assignee-safe current context and the specified parsed correction history; it does not expose raw audit, actor, notification, internal, or another Client’s records.
- [ ] The only Client mutation is a narrow Server Action that validates `{ deliverable_id, submission_url, submission_note? }`, derives session/role/target server-side, normalizes the optional note per Section 4.4, and calls `submit_client_deliverable()` once.
- [ ] A successful submission creates an authoritative immutable successor version, derives the provider, and transitions only `pending → submitted`; the UI refreshes server state before declaring success.
- [ ] `submitted` is terminal for Client action. The Client cannot edit URLs, self-reopen, choose review/delivery status, create feedback, or invoke production lifecycle controls.
- [ ] An authorized PM Lead/Admin reopen is represented only through the safe projection. The direct Client can submit a replacement from `pending`; prior immutable submissions remain safely visible and unchanged.
- [ ] The request-completion prerequisite remains advisory in the UI and authoritative in the task command; a recorded submission does not auto-complete the request.
- [ ] Project-dashboard child cards remain read-only; only canonical request detail contains mutation UI.
- [ ] No component/action fetches, previews, proxies, scans, downloads, stores, validates reachability of, or claims verification/upload/delivery for an external URL.
- [ ] All visible content has exact `es-MX`/`en-US` parity and the form/confirmation/history/external-link interaction is keyboard-operable, focus-safe, non-color-dependent, mobile-usable, and screen-reader labeled.
- [ ] Focused migration and application evidence passes with actual outcomes. No S05-07 closeout, provider, offline, broad-Realtime, navigation, production, or unrelated schema work is introduced.

---

## 11. Stop conditions and decision boundary

| Discovery | Required response |
| --- | --- |
| The migration/type generation does not establish exact URL corpus parity between browser feedback and authoritative database command | Block S05-05. Do not ship a browser-only validator or relax the accepted policy. |
| A migration implementation needs a new table, broad RLS redesign, generic audit endpoint, production workflow change, public API change, or external provider access | Stop and obtain a new scoped decision. These are outside this approved gap. |
| The Client-safe view cannot expose correction reason/history without leaking raw audit/actor/internal fields or another Client’s data | Block the correction presentation and redesign the narrow projection/helper with security review; never query audit/versions directly from application code. |
| A target/action can read or mutate another Client’s direct submission, including on a shared project | Block integration until projection/RLS/query evidence is corrected. Hiding a leaked card is insufficient. |
| A result creates a second immutable version after a stale/replayed submit, changes a historical URL, or permits Client self-reopen | Block integration as an immutable lifecycle defect. |
| Implementation requires remote URL access, upload/storage, provider API credentials, link reachability, or external dispatch | Reject/defer to the owning future scope. |
| A request introduces review, approval, change request, internal/client review deadline, feedback, delivery, or production re-review UI on a `client_submission` | Block it. This violates the terminal external-input workflow. |
| Note normalization, empty-note handling, 1,000-character enforcement, or least-privilege note exposure diverges between form, Action, RPC, and safe projection | Block implementation until every boundary follows Section 4.4. Do not add a second note store, expose notes project-wide, or edit a prior immutable note. |
| Focused tests reveal raw-error leakage, false success, no-refresh stale state, offline replay, catalog mismatch, inaccessible primary action, or URL dereference | Block implementation until fixed and re-verified. |

### Implementation-readiness conclusion

S05-05 is not yet application-implementation-ready because the migration source must complete review, controlled `jsf-pm-dev` application, generated-type regeneration, and the specified corpus evidence first. No new Project Owner product decision is required: the URL policy is accepted in S02/S05, and the optional Client-note policy is now fixed by Section 4.4. The next action is to complete the controlled migration sequence for `20260822095500_s05_05_harden_client_submission_urls_and_correction_history.sql`; application implementation then proceeds only against the resulting committed types and evidence.

---

*This specification was written on 2026-08-22 from the accepted S05 plan/mapping, completed S05-04 baseline, committed `submit_client_deliverable()` and `reopen_client_deliverable()` migration source, current `client_submission_view`/generated types, and the accepted S02 public-HTTPS/immutable external-input policy. It records the exact bounded migration prerequisite instead of permitting a Client-side workaround.*
