# JSF PM App Development Changelog

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
