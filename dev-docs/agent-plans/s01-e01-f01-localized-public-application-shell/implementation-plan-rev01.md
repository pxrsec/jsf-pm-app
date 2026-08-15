---
artifact_schema_version: 1
artifact_type: antigravity-implementation-plan
plan_id: PLAN-S01-E01-F01-REV01
spec_id: S01-E01-F01
feature_slug: s01-e01-f01-localized-public-application-shell
sprint: S01
epic: E01
feature: F01
plan_revision: 1
status: proposed
created: 2026-08-15
created_by: antigravity
dispatcher_profile: fullstack-dispatcher
conversation_id: plan-s01-e01-f01-rev01
supersedes: null
spec_path: dev-docs/specs/s01/localized-public-application-shell-v0.1.md
spec_version: 0.1
p3_contract_ref: __tests__/i18n/P3-G2-TEST-EVIDENCE-SUMMARY.md @ 70aa48c
---

# Implementation Plan: Localized Public Application Shell (S01-E01-F01)

## Objective

Implement the localized public application shell per the accepted specification v0.1, satisfying all 10 verification criteria (VC-I18N-001 through VC-I18N-010) and making the P3/G2 test contracts pass GREEN.

## Accepted Scope (from spec Section 3)

- Next.js App Router locale-aware routing with `next-intl` middleware
- Message catalogs at `messages/es-MX.json` and `messages/en-US.json` with keys under `shell` and `privacy` namespaces
- Canonical routes: `/`, `/privacidad`, `/en/`, `/en/privacidad`
- Locale middleware that enforces canonical mapping and rejects unsupported locales via not-found
- Sitemap generation (`app/sitemap.ts`) listing only canonical public routes
- Robots configuration (`app/robots.ts`) with non-production posture
- Root layout and page components consuming translations via `next-intl`
- Privacy page component at `/privacidad` and `/en/privacidad`
- Focused verification tests proving Spanish at `/` and English at `/en/`
- TypeScript types for message catalog structure

## Explicit Non-Goals (from spec Section 4)

- Authenticated/application routes (invite-token auth, dashboard, project workspace)
- `/es-MX/` alias route or redirect from `/` to `/es-MX/`
- Additional locales beyond `es-MX` and `en-US`
- WhatsApp/email notification integration
- Admin operational views
- Database schema changes (non-schema route)
- Server-side Supabase/RLS/RPC changes
- Production deployment configuration
- Legal/privacy policy content beyond placeholder notice

## REQ/VC/TC Mapping

| REQ                        | VC          | TC          | Verification Mode  | Test/Procedure Path                                    |
| -------------------------- | ----------- | ----------- | ------------------ | ------------------------------------------------------ |
| REQ-I18N-001               | VC-I18N-001 | TC-I18N-001 | strict-test-first  | `__tests__/i18n/spanish-shell.test.tsx`                |
| REQ-I18N-002               | VC-I18N-002 | TC-I18N-002 | strict-test-first  | `__tests__/i18n/english-shell.test.tsx`                |
| REQ-I18N-003               | VC-I18N-003 | TC-I18N-003 | strict-test-first  | `__tests__/i18n/unsupported-locale.test.tsx`           |
| REQ-I18N-004               | VC-I18N-004 | TC-I18N-004 | strict-test-first  | `__tests__/i18n/unsupported-locale.test.tsx`           |
| REQ-I18N-005               | VC-I18N-005 | TC-I18N-005 | strict-test-first  | `__tests__/i18n/sitemap.test.ts`                       |
| REQ-I18N-005               | VC-I18N-006 | TC-I18N-006 | strict-test-first  | `__tests__/i18n/robots.test.ts`                        |
| REQ-I18N-006               | VC-I18N-007 | TC-I18N-007 | strict-test-first  | `__tests__/i18n/message-catalogs.test.ts`              |
| REQ-I18N-007, REQ-I18N-008 | VC-I18N-008 | TC-I18N-008 | strict-test-first  | `__tests__/i18n/key-naming.test.ts`                    |
| REQ-I18N-009               | VC-I18N-009 | TC-I18N-009 | verification-first | `__tests__/i18n/VC-I18N-009-verification-procedure.md` |
| REQ-I18N-010               | VC-I18N-010 | TC-I18N-010 | strict-test-first  | `__tests__/i18n/privacy-page.test.tsx`                 |

## Affected Files (New and Modified)

### New Files

1. `messages/es-MX.json` — Spanish message catalog (source language)
2. `messages/en-US.json` — English message catalog (translation)
3. `src/app/[locale]/page.tsx` — Localized home page component
4. `src/app/[locale]/privacidad/page.tsx` — Localized privacy page component
5. `src/app/[locale]/layout.tsx` — Localized route layout
6. `src/middleware.ts` — next-intl locale middleware
7. `src/app/sitemap.ts` — Sitemap generation
8. `src/app/robots.ts` — Robots configuration
9. `src/i18n/request.ts` — next-intl request configuration
10. `src/i18n/routing.ts` — next-intl routing configuration
11. `src/i18n/types.ts` — Message catalog TypeScript types

### Modified Files

1. `src/app/layout.tsx` — Update to work with locale routing (becomes root layout above [locale])
2. `src/app/page.tsx` — Remove or convert to redirect/not-found (root now served by middleware rewrite)

## Ordered Implementation Steps

### Step 1: Create i18n Configuration

- Create `src/i18n/routing.ts` with locale definitions, default locale, and pathnames
- Create `src/i18n/request.ts` for server-side translation loading
- Create `src/i18n/types.ts` for message catalog type safety

### Step 2: Create Message Catalogs

- Create `messages/es-MX.json` with `shell` and `privacy` namespaces (Spanish source language)
- Create `messages/en-US.json` with identical key structure (English translations)
- Keys must follow semantic naming: dot-delimited, lower camel case, UI concepts

### Step 3: Create Locale Middleware

- Create `src/middleware.ts` using `createMiddleware` from `next-intl/middleware`
- Configure to serve `es-MX` at root (no prefix) and `en-US` under `/en/`
- Reject unsupported locales via not-found (no `/es-MX/` alias)

### Step 4: Create Localized Route Structure

- Create `src/app/[locale]/layout.tsx` — consumes translations, sets html lang
- Create `src/app/[locale]/page.tsx` — home page using `useTranslations('shell')`
- Create `src/app/[locale]/privacidad/page.tsx` — privacy page using `useTranslations('privacy')`

### Step 5: Update Root Layout

- Modify `src/app/layout.tsx` to be the root layout (above [locale] segment)
- Remove hardcoded English metadata; use dynamic metadata from translations where applicable

### Step 6: Create Sitemap and Robots

- Create `src/app/sitemap.ts` exporting `MetadataRoute.Sitemap` with canonical routes only
- Create `src/app/robots.ts` exporting `MetadataRoute.Robots` with `disallow: /` for non-production

### Step 7: Update Root Page

- Modify `src/app/page.tsx` to handle root access (middleware rewrites to it for es-MX)

### Step 8: Run Verification

- Run `npm run test` — all test contracts must pass GREEN
- Run `npm run typecheck` — must pass
- Run `npm run lint` — must pass
- Run `npm run build` — must pass

## Verification Commands

```bash
# Unit/integration tests (RED → GREEN)
npm run test

# Type checking
npm run typecheck

# Linting
npm run lint

# Build verification
npm run build

# Format check
npm run format:check
```

## Risk and Rollback Considerations

| Risk                                               | Mitigation                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| Middleware misconfiguration breaks all routes      | Test locally with `npm run dev` before committing; middleware is isolated |
| Message catalog key mismatch causes runtime errors | TypeScript types from `src/i18n/types.ts` enforce compile-time safety     |
| next-intl version incompatibility                  | Package.json locks `next-intl@4.13.5`; use documented v4 APIs only        |
| Hardcoded strings remain in components             | VC-I18N-009 verification procedure (grep) catches violations              |

## Assumptions

1. `next-intl@4.13.5` APIs match the v4 documentation (middleware, routing, request configs)
2. Next.js 16.3.0 App Router supports the `[locale]` segment pattern with middleware rewrites
3. The `messages/` directory at repository root is the standard convention for `next-intl`
4. TypeScript types for message catalogs can be generated or manually declared in `src/i18n/types.ts`
5. No database/schema changes required (spec confirms non-schema route)

## Open Decisions / Stop Conditions

- **OQ-001** (from spec): Privacy page placeholder notice content — use minimal placeholder text for now; can be refined in downstream work item
- If any VC test contract is found to be misaligned with the accepted specification, **STOP** and route to architect/engineering-manager
- If `next-intl` v4 APIs differ materially from expected usage, **STOP** and route for decision
- If middleware routing causes unexpected redirect loops or 404s on canonical routes, **STOP** and route for decision

## Plan Artifact Location

`dev-docs/agent-plans/s01-e01-f01-localized-public-application-shell/implementation-plan-rev01.md`
