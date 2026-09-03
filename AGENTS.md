Only Hermes agents ingest this file. Antigravity sessions use `GEMINI.md`.

Read this file before inspecting, planning, editing, reviewing, testing, or reporting on work in this repository. It defines repository-local operating rules; it does not replace accepted project requirements, architecture, or task authority.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- CODEGRAPH_START -->

## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

## Authority and project context

Resolve conflicts in this order:

1. Direct Project Owner instruction and accepted decisions.
2. The assigned Hermes task brief, accepted implementation specification, and accepted repository plan artifact.
3. This file and repository-local documentation.
4. General framework or tool documentation.

When required project context is missing or ambiguous, use the authorized `jsf-wiki` knowledge capability. Do not modify `jsf-wiki` unless separately authorized. Do not silently change requirements, architecture, security policy, database policy, API contracts, or scope; return a decision request instead.

Inspect `package.json` for current scripts and dependencies. Consult installed package documentation for framework-specific behavior rather than relying on assumed versions.

## Architecture and implementation rules

- Use the Next.js App Router. Prefer React Server Components; introduce client components only at browser-interaction boundaries.
- Keep feature components in route-local `_components/` directories, shared application components in `src/components/shared/`, and shadcn primitives in `src/components/ui/`.
- Use `@/*` for imports rooted at `src/`.
- Keep implementation files at or below 600 lines; split by responsibility and explain a necessary exception in task evidence. The MCP-generated `src/lib/database.types.ts` is an explicit tracked generated-source exception and must not be manually split or edited.
- Preserve strict TypeScript. Do not introduce `any`, broad suppressions, or disabled lint/type rules merely to pass a check.
- Localize user-visible text. Source code, identifiers, and stored enums remain English. Follow the repository's current locale architecture.
- Do not introduce service workers, offline caching, deferred mutation queues, runtime Prisma access, public signup, or Playwright E2E automation unless an accepted decision explicitly changes that boundary. Prisma is removed from this project; do not add it or another ORM/schema-migration system.

## Data, API, and security boundaries

- Use `@supabase/ssr` for runtime browser and server access under RLS. Supabase migrations under `supabase/migrations/` are the sole versioned schema source; do not introduce Prisma or another parallel schema/migration system.
- Keep privileged Supabase access narrowly isolated in server-only code. Secrets must never reach a client bundle, shared module, log, error response, test fixture, committed file, or external telemetry payload.
- Only explicitly `NEXT_PUBLIC_*` configuration may be browser-visible. Treat `.env.example` as a variable-name template; never add, read, print, or commit real environment values or credentials.
- Application API behavior is same-origin. Do not add broad CORS. Apply Origin/Host validation through the shared security boundary for unsafe cookie-authenticated routes.
- Validate untrusted input at the server boundary. Use Zod where the application contract requires schema validation. Return safe, non-leaking errors; never expose stack traces, secrets, provider payloads, or internal authorization details.
- Preserve RLS, server-side authorization, immutable audit evidence, idempotency requirements, and role-safe response shapes. A passing client test is not proof that an authorization rule is correct.
- External URLs must remain public HTTPS URLs and must not be server-dereferenced unless an accepted decision changes that boundary.

## Change discipline

1. Confirm that scope, acceptance evidence, responsible role, and dependencies are clear.
2. Inspect the current repository state and nearby code before changing anything.
3. Make the smallest coherent change that satisfies accepted work. Do not perform opportunistic refactors, dependency upgrades, configuration rewrites, or scope expansion.
4. Add or update focused tests for behavior changes, including negative-path coverage where appropriate and within assigned ownership.
5. Update repository documentation and task evidence when behavior, configuration, scripts, or operating instructions change.
6. Run applicable checks from `package.json` and the task's acceptance checks. Report exact commands with factual results; never claim checks that were not run.
7. Preserve unrelated work. Do not use destructive Git commands, force push, or bulk deletion without explicit Project Owner approval.

## Completion evidence

A completed task reports changed files, tests added or changed, exact verification commands and outcomes, security/accessibility/localization impact, documentation changes, known limitations, and follow-up or decision requests.

## Git and operational limits

- Follow the Project Owner's selected review path and the role permissions supplied with the work. Do not commit, merge, push, change branches, or modify remote state unless explicitly authorized for your role.
- Use the branch convention supplied with assigned work. Do not infer a branch name from this file.
- Do not provision external accounts, alter hosted-service settings, rotate credentials, submit legal/privacy content, or deploy without explicit authorization.
- Missing credentials or provider accounts are blockers, not permission to weaken controls, fabricate evidence, or add fake secrets.
- R0/R1 security findings block integration. Report them with reproducible evidence; do not suppress them to finish work.

## Stable documentation locations

- Repository implementation specifications: `dev-docs/specs/`
- Antigravity plan artifacts: `dev-docs/agent-plans/`
- Repository-local documentation uses lowercase kebab-case filenames.

Repository notes may explain implementation but must not silently supersede accepted project decisions.
