# JSF PM App Development Changelog

## [2026-08-18 @ 08:55]

**🚀 Features**

- Implemented authoritative Postgres data platform and access control schema (`supabase/migrations/20260818143500_s02_e02_authoritative_data_platform.sql`) covering 22 enums, 18 tables, 12 private authorization functions, 18 transactional RPCs, 24 partial/unique indexes, and 9 security-invoker views
- Enforced strict RLS policies across all public tables with `auth.uid()` subquery encapsulation and immutable audit/event triggers
- Applied migration to `jsf-pm-dev` remote Supabase database and generated untouched TypeScript database contract (`src/lib/database.types.ts`)
- Added realtime publication for `notification_recipients` and seeded initial WhatsApp notification templates

**🧪 Tests**

- Updated `__tests__/config/credential-exposure.test.ts` key regex boundary patterns to prevent substring false-positives on identifier tokens like `task_resources_task_id_fkey`

## [2026-08-17 @ 16:15]

**🛠 Architecture**

- Migrated deprecated Next.js `middleware.ts` to `proxy.ts` (`src/proxy.ts`) in accordance with Next.js 16 file conventions
- Updated ESLint restricted imports config (`eslint.config.mjs`) to include `proxy.ts` in structural isolation rules for privileged admin client

## [2026-08-17 @ 16:02]

**🚀 Features**

- Added global browser-security response headers in `next.config.ts` (Content-Security-Policy, X-Frame-Options, Referrer-Policy, Permissions-Policy, X-Content-Type-Options, Strict-Transport-Security)
- Created typed catalog-backed error copy helper (`src/lib/error-copy.ts`) with pathname-based locale selection
- Added localized route-segment error boundary (`src/app/[locale]/error.tsx`) and root error boundary (`src/app/global-error.tsx`)
- Added `errors` namespace to `messages/es-MX.json` and `messages/en-US.json`
- Implemented structured JSON logger (`src/lib/logger.ts`) with recursive sensitive-data redaction, circular reference handling, and request-scoped logger factory
- Implemented Sentry capture seam (`src/lib/sentry.ts`) with no-op handling for unconfigured environments and sanitized exception formatting

**🧪 Tests**

- Added unit tests for structured logger serialization, redaction, request correlation, and safe unusual values (`src/lib/__tests__/logger.test.ts`)
- Added unit tests for Sentry DSN resolution, environment fallback, and unconfigured no-op behavior (`src/lib/__tests__/sentry.test.ts`)
- Updated message catalog key-naming test to recognize `errors` namespace (`__tests__/i18n/key-naming.test.ts`)

## [2026-08-17 @ 14:45]

**🚀 Features**

- Implemented public runtime configuration boundary (`src/config/app.config.ts`) validating only `NEXT_PUBLIC_*` environment variables using Zod with presence-only check for `NEXT_PUBLIC_APP_URL` and HTTPS validation for `NEXT_PUBLIC_SUPABASE_URL`
- Implemented server-only configuration boundary (`src/config/server.config.ts`) validating `SUPABASE_SECRET_KEY` synchronously at load time with secret redaction
- Added browser Supabase client factory (`src/lib/supabase/browser.ts`) using `@supabase/ssr` `createBrowserClient`
- Added request-context server Supabase client factory (`src/lib/supabase/server.ts`) using `@supabase/ssr` `createServerClient` and modern `getAll`/`setAll` cookie adapter
- Added privileged server-only admin Supabase client factory (`src/lib/supabase/admin.ts`) using `@supabase/supabase-js` `createClient`

**🛠 Architecture**

- Configured ESLint structural restricted import rules (`eslint.config.mjs`) forbidding `@prisma/client` and `prisma` across application code and restricting privileged admin client (`src/lib/supabase/admin`) from client components, shared modules, and middleware
- Added Vitest configuration (`vitest.config.mts`) with path alias resolution

## [2026-08-17 @ 14:34]

**🧪 Tests**

- Corrected `__tests__/config/server.config.test.ts` (TC-CFG-002) Test 1 to assert successful module resolution and `serverConfig` validation when a valid `SUPABASE_SECRET_KEY` is present, aligning with REQ-CFG-004 fail-closed specification.

## [2026-08-15 @ 13:40]

**🚀 Features**

- Implemented localized public application shell using `next-intl`
- Added canonical routes `/`, `/privacidad`, `/en/`, and `/en/privacidad`
- Set `es-MX` as the default locale served without a prefix
- Added `messages/es-MX.json` and `messages/en-US.json` message catalogs
- Generated localized sitemap (`sitemap.ts`) reflecting canonical routes
- Configured robots.txt (`robots.ts`) with `Disallow: /` for non-production environments
- Added localized layout and privacy pages

**🛠 Architecture**

- Added `next-intl` configuration (`routing.ts`, `request.ts`, `types.ts`)
- Configured locale-aware Next.js middleware to enforce canonical routing paths
- Injected dynamic metadata translation support into the root layout
- Migrated standard page structure into `[locale]` segment
