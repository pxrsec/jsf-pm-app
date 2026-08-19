# S04-01 — Visual Foundation: shadcn/ui Initialization and Persisted Native Theming

**Sprint:** S04  
**Work Item:** S04-01  
**Status:** Ready for implementation  
**Last reviewed:** 2026-08-19  
**Spec authority:** Sprint plan `s04-e04-e05-project-workspace-and-production-deliverable-lifecycle-sprint-plan.md`, Section 4 (visual decisions COMPLETED) and Section 5 (work item S04-01).

---

## 1. Purpose and scope

This spec governs the complete initialization of shadcn/ui into the existing Tailwind v4 / Next.js 16.x project, the installation of the approved Sprint 04 primitive inventory, and the introduction of a flicker-resistant, accessible, persisted light/dark theme system powered by `next-themes`.

The work ends when:

- `components.json` is the single source of truth for shadcn CLI operations.
- All Sprint 04 UI primitives are installed under `src/components/ui/`.
- The application uses a class-based, CSS-variable-driven theme system where `light` is the first-visit default and explicit user selection persists in `localStorage`.
- The existing `prefers-color-scheme` global behavior is removed.
- The old Geist font imports are removed and replaced by the font(s) prescribed by preset `b2J0x9uLeE`.
- A `ThemeToggle` appears in both desktop and mobile authenticated navigation.
- Reusable semantic badge/status mapping utilities exist for project status, task status, task priority, deliverable state, and member capacity.
- The entire authenticated shell (AppNav, mobile drawer, protected layout, loading skeleton) uses token-based classes, not hardcoded neutral/zinc/amber classes.
- No auth flow, locale behavior, route, or existing component contract regresses.

### Explicitly out of scope for this work item

- Building any project, task, deliverable, or membership UI (S04-03 through S04-07).
- Creating route handlers, Supabase queries, or API contracts (S04-02).
- Installing components not listed in the approved inventory below.
- Modifying `src/lib/database.types.ts`.
- Any Supabase MCP operations (none are required — see Section 11).

---

## 2. Approved visual decisions (authoritative)

All decisions below were approved by the Project Owner and are not open for re-interpretation.

| Setting | Approved selection | Notes |
|---|---|---|
| Base palette | **Neutral** | Keeps production-status colors legible without a tinting baseline. |
| Component style | **Mira** | Compact/dense, suitable for dashboards and data tables. Do not mix with other styles. |
| Accent | **Indigo** mapped to semantic action tokens | Never encode raw hex values in components. |
| Icon set | **Lucide** (`lucide-react`) | Replace all hand-crafted SVG paths in AppNav/MobileNavToggle with Lucide equivalents. |
| Dark appearance | Same semantic token system, not an inverted one-off palette | Logo assets in `public/`: `joyalogo-purple.svg`, `joyalogo-yellow.svg`, `joya-icon.svg`. |
| Preset | **`--preset b2J0x9uLeE`** | Authoritative for CSS variables, font selection, and radius. Overrides previous Geist fonts. |

---

## 3. Pre-implementation baseline inventory

Factual record of what exists **before** S04-01 changes anything. Verify against live filesystem before implementing.

### 3.1 Currently installed relevant packages

| Package | Installed | Notes |
|---|---|---|
| `tailwindcss` v4 | YES | CSS-first config via `@import "tailwindcss"` and `@theme` |
| `@tailwindcss/postcss` v4 | YES | PostCSS plugin |
| `next` v16.3.1 | YES | App Router, RSC-first |
| `next/font/google` | YES (via Next.js) | Currently imports Geist Sans and Geist Mono |
| `clsx` | Transitive only | Via `recharts`; not a direct dependency |
| `class-variance-authority` | NO | Must be installed |
| `tailwind-merge` | NO | Must be installed |
| `lucide-react` | NO | Must be installed |
| `next-themes` | NO | Must be installed |
| `@radix-ui/*` | NO | Will be installed as shadcn component deps |
| `cmdk` | NO | Will be installed as shadcn `command` dep |
| `sonner` | NO | Must be installed as shadcn `sonner` dep |
| `shadcn` CLI | NO prod dep | Used via `npx shadcn@latest` at init time (v4.18.0 confirmed) |

### 3.2 Current `globals.css` — critical problems to fix

Three problems in `src/app/globals.css` must be resolved in Step 3c:

1. **`@media (prefers-color-scheme: dark)` block** — overrides CSS variables at `:root` based on OS preference, independent of `next-themes`. Conflicts with `defaultTheme="light"`. Must be removed entirely.
2. **`--font-geist-sans` / `--font-geist-mono` in `@theme inline`** — reference fonts that will be removed. Must be removed.
3. **`font-family: Arial, Helvetica, sans-serif` on `body`** — bypasses the token system. Must be replaced with `@apply bg-background text-foreground`.

### 3.3 Current root layout — problems to fix

`src/app/layout.tsx` currently:
- Imports `Geist` and `Geist_Mono` from `next/font/google` — must be replaced with preset font.
- Sets `--font-geist-sans` / `--font-geist-mono` CSS variables — must be replaced.
- `<html>` has no `suppressHydrationWarning` — must be added (ONLY on `<html>`).
- No `ThemeProvider` wrapping children — must be added.

### 3.4 Current protected layout — hardcoded classes

`src/app/[locale]/(protected)/layout.tsx` uses:
```
bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100
```
Must become `bg-background text-foreground`.

### 3.5 Current AppNav — classes to sweep

`src/components/shared/app-nav/app-nav.tsx` uses:
- `border-neutral-200 dark:border-neutral-800`
- `bg-white/95 dark:bg-neutral-900/95`
- `text-neutral-900 dark:text-white`
- `bg-amber-500 text-white` (brand icon — see Flag 3 in Section 6)
- `hover:text-amber-600 dark:hover:text-amber-400`
- `text-neutral-400 dark:text-neutral-500`
- `text-neutral-800 dark:text-neutral-200`, `text-neutral-500 dark:text-neutral-400`

All must be replaced with semantic token classes or shadcn primitives.

### 3.6 Current MobileNavToggle

Uses a hand-crafted SVG hamburger/close (no Lucide) and hardcoded class strings. The icon must be replaced with Lucide `Menu` / `X`.

### 3.7 Current sign-in form

`sign-in-form.tsx` uses `zinc-*` classes (`border-zinc-200 bg-white`, `text-zinc-900`, etc.). Must be swept to token classes and shadcn primitives.

### 3.8 Current CSP — CRITICAL CONSTRAINT

`next.config.ts` sets `font-src 'self' data:`. **Google Fonts CDN is NOT allowed.** Any font selected by the preset must be loaded via `next/font/google` (self-hosted at build time, served from `_next/static/`, covered by `font-src 'self'`). Never add `@import url(fonts.googleapis.com/...)` to CSS. Never relax the CSP.

---

## 4. Implementation sequence

Execute steps in order. Verify before proceeding to the next.

### Step 1 — Identify the preset font

Before touching any code, determine what font(s) preset `b2J0x9uLeE` specifies. The CLI reveals this during initialization (Step 2). Expected font: **Inter** (canonical for Mira style). Treat CLI output as authoritative.

**CSP constraint:** Font MUST be loaded only via `next/font/google`.

### Step 2 — Initialize shadcn/ui

```bash
npx shadcn@latest init --preset b2J0x9uLeE
```

**What the CLI does:**
- Creates `components.json` at the project root.
- Updates `src/app/globals.css` with the full shadcn CSS variable token set.
- Adds `tailwind-merge`, `class-variance-authority`, `lucide-react` to `package.json`.
- Creates `src/lib/utils.ts` with the `cn()` function.
- Targets `src/components/ui/` for component installation.

**Critical review after CLI runs:**

1. Open `components.json`. Confirm:
   - `"style": "mira"` (or equivalent Mira style variant)
   - `"tailwind": { "cssVariables": true }`
   - Aliases match tsconfig: `"utils": "@/lib/utils"`, `"ui": "@/components/ui"`, `"components": "@/components"`
   - `"rsc": true`

2. **CRITICAL:** If CLI wrote `@import url(fonts.googleapis.com/...)` into `globals.css`, **remove it immediately**. Font loading happens only in the root layout via `next/font`.

3. Verify `src/lib/utils.ts` exists and contains:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Step 3 — Resolve fonts and clean globals.css

#### 3a. Determine exact font from CLI output

Record the font name. If Inter, proceed. If different, adjust Step 3b accordingly.

#### 3b. Update `src/app/layout.tsx`

Remove Geist imports. Add the preset sans font and Geist Mono (monospace) via `next/font/google`. Add ThemeProvider. Add suppressHydrationWarning. Add Toaster.

```tsx
import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google"; // Replace "Inter" with actual preset sans font if different
import "./globals.css";
import { getLocale, getTranslations } from "next-intl/server";
import { ThemeProvider } from "@/components/shared/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const fontSans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Geist Mono: shadcn/ui includes Geist Mono as its standard monospace font.
// Load it here regardless of whether Sprint 04 features require it,
// so it is available for any future monospace display (code, API keys, etc.).
// CSP compliant: next/font/google self-hosts at build time via _next/static/.
const fontMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "shell.brand" });
  return {
    title: t("name"),
    description: t("name"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Rules:**
- `suppressHydrationWarning` goes ONLY on `<html>`. Never on body, main, or any other element.
- `ThemeProvider` wraps all children here — not in locale or protected layouts.
- `--font-sans` must match what shadcn expects (confirmed by CLI); `--font-mono` is set to Geist Mono per Project Owner decision.
- If the CLI init reveals a different preset font than Inter, replace the `Inter` import but keep the `Geist_Mono` import.
- `Toaster` is inside `ThemeProvider` so it picks up the active theme class.
- If the shadcn CLI already configures Geist Mono in `globals.css`, keep the CLI's `--font-mono` definition and ensure the `next/font/google` import uses the same variable name.

#### 3c. Clean `src/app/globals.css`

After CLI run, apply these changes:
- **REMOVE** the `@theme inline { ... }` block entirely (contains old Geist font variable references).
- **REMOVE** the `@media (prefers-color-scheme: dark) { ... }` block entirely.
- **REMOVE** `font-family: Arial, Helvetica, sans-serif` from `body`.
- **KEEP** `@import "tailwindcss";` as the first line.
- **KEEP** the CLI-generated `@layer base` blocks with `:root { ... }` and `.dark { ... }`.

The final `globals.css` structure should follow this pattern (CLI-generated values are authoritative; values shown are from the Neutral palette registry for reference):

```css
@import "tailwindcss";

/* shadcn/ui token system — generated by CLI; do not manually edit core vars */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 3.9%;
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    /* Indigo accent per approved decision — override if CLI generated different */
    --accent: 238 75% 60%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 89.8%;
    --input: 0 0% 89.8%;
    --ring: 238 75% 60%;
    --radius: 0.5rem;
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
  }

  .dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    --card: 0 0% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 0 0% 9%;
    --secondary: 0 0% 14.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.9%;
    --accent: 238 75% 60%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 14.9%;
    --input: 0 0% 14.9%;
    --ring: 238 75% 60%;
    --chart-1: 220 70% 50%;
    --chart-2: 160 60% 45%;
    --chart-3: 30 80% 55%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

> **NOTE on `--font-sans`:** This variable does not need to be in `@layer base`. Next.js `next/font` sets it as a CSS custom property on `<html>` via the `variable` option. Tailwind v4 reads it from there automatically.

> **NOTE on Indigo accent:** If the preset already includes Indigo, keep the CLI values. If the preset generated Neutral gray for accent, manually override `--accent` and `--ring` to the Indigo values (238 75% 60%) to honor the Project Owner decision.

### Step 4 — Install next-themes and create ThemeProvider

```bash
npm install next-themes
```

**Create `src/components/shared/theme/theme-provider.tsx`:**

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

/**
 * ThemeProvider — wraps next-themes for class-based light/dark mode.
 *
 * Contract:
 * - attribute="class": shadcn/ui uses .dark class on <html> to switch CSS vars.
 * - defaultTheme="light": first-time visitors see light mode.
 * - enableSystem={false}: OS preference does NOT override the light default.
 * - storageKey="jsf-pm-theme": stable project-specific localStorage key.
 *   IMPORTANT: Do not change this key after first deployment or users lose their preference.
 * - disableTransitionOnChange: suppresses page-wide flash during theme switch.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="jsf-pm-theme"
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
```

### Step 5 — Create ThemeToggle component

**Create `src/components/shared/theme/theme-toggle.tsx`:**

```tsx
"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * ThemeToggle — accessible theme selector for authenticated navigation.
 *
 * Accessibility contract:
 * - aria-label describes the NEXT ACTION (what happens on click).
 * - aria-pressed reflects boolean dark state.
 * - Icons are aria-hidden (accessible text in aria-label / sr-only).
 * - Dropdown items have aria-current marking the active selection.
 * - Fully keyboard-operable via Radix UI (Enter/Space, arrows, Escape).
 * - Icon + visible text per item (not color or icon shape alone).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("theme");

  const isDark = theme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={isDark ? t("switchToLight") : t("switchToDark")}
          aria-pressed={isDark}
          className="h-9 w-9"
          id="theme-toggle"
        >
          {isDark ? (
            <Moon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Sun className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="sr-only">
            {isDark ? t("currentDark") : t("currentLight")}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          aria-current={theme === "light" ? "true" : undefined}
        >
          <Sun className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("light")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          aria-current={theme === "dark" ? "true" : undefined}
        >
          <Moon className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("dark")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Step 6 — Install Sprint 04 primitive inventory

```bash
npx shadcn@latest add button input label textarea select checkbox badge card table tabs dialog alert-dialog sheet dropdown-menu popover command separator skeleton tooltip sonner form
```

**Notes:**
- `form` — include if it integrates cleanly with the existing `react-hook-form` + `@hookform/resolvers` + Zod pattern. Verify by checking `@hookform/resolvers` works with shadcn `form` after install.
- `sonner` — `Toaster` placement is handled in Step 3b (root layout).
- All components land in `src/components/ui/`. Do not move them.
- Do not install components not consumed in Sprint 04.

### Step 7 — Update AppNav

**File:** `src/components/shared/app-nav/app-nav.tsx`

Replace hardcoded classes with semantic token classes. Add ThemeToggle to desktop nav.

**Token replacement table:**

| Old class | Replacement |
|---|---|
| `border-neutral-200 dark:border-neutral-800` | `border-border` |
| `bg-white/95 dark:bg-neutral-900/95` | `bg-background/95` |
| `text-neutral-900 dark:text-white` | `text-foreground` |
| `hover:text-amber-600 dark:hover:text-amber-400` | `hover:text-accent` |
| `text-neutral-800 dark:text-neutral-200` | `text-foreground` |
| `text-neutral-500 dark:text-neutral-400` | `text-muted-foreground` |
| `text-neutral-400 dark:text-neutral-500` | `text-muted-foreground` |
| `focus:ring-amber-500` | `focus-visible:ring-ring` |

**ThemeToggle placement in the desktop nav section (hidden md:flex):**

```tsx
<LanguageSwitcher />
<ThemeToggle />
<NotificationBadge count={unreadCount} />
```

**Brand mark (DECIDED — Project Owner):** Use `<Image src="/joya-icon.svg" alt="Joya" width={32} height={32} />` from `next/image`.

> **SVG caveat with next/image:** `next/image` can display SVGs but requires the `width` and `height` props (no intrinsic dimensions from SVG viewBox). If the SVG uses CSS-only styling or `currentColor` that does not adapt to the dark theme, a plain `<img>` tag with `src="/joya-icon.svg"` and explicit dimensions may be simpler and equally valid since the asset is already in `public/` (no optimization benefit from `next/image` for SVGs). Choose whichever approach renders correctly at h-8 w-8 in both themes. If neither works, fall back to the amber circle placeholder and document the exception.

### Step 8 — Update MobileNavToggle

**File:** `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx`

Replace hand-crafted SVG with Lucide icons. Replace hardcoded classes. Add ThemeToggle to the drawer.

```tsx
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
```

Toggle button replacement:

```tsx
<Button
  ref={toggleRef}
  type="button"
  variant="ghost"
  size="icon"
  onClick={() => setIsOpen(!isOpen)}
  aria-expanded={isOpen}
  aria-controls="mobile-nav-drawer"
  aria-label={isOpen ? t("closeMenu") : t("openMenu")}
  className="h-9 w-9"
>
  {isOpen ? (
    <X className="h-5 w-5" aria-hidden="true" />
  ) : (
    <Menu className="h-5 w-5" aria-hidden="true" />
  )}
</Button>
```

Mobile drawer token classes:

```tsx
className="fixed inset-x-0 top-16 z-50 bg-background border-b border-border p-4 shadow-lg flex flex-col gap-4"
```

ThemeToggle in drawer header row:

```tsx
<div className="flex items-center gap-3">
  <LanguageSwitcher />
  <ThemeToggle />
  <NotificationBadge count={unreadCount} />
</div>
```

Preserve all existing keyboard behavior: Escape closes, focus returns to toggle button.

### Step 9 — Sweep remaining shell files

Convert hardcoded dark-mode classes to semantic tokens in:

#### 9a. `src/app/[locale]/(protected)/layout.tsx`

```diff
- className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
+ className="min-h-screen flex flex-col bg-background text-foreground"
```

#### 9b. `src/app/[locale]/(protected)/loading.tsx`

- `bg-neutral-50 dark:bg-neutral-950` → `bg-background`
- `bg-white dark:bg-neutral-900` → `bg-card`
- `bg-neutral-200 dark:bg-neutral-800` → `bg-muted`
- `border-neutral-200 dark:border-neutral-800` → `border-border`

Optionally replace manual animate-pulse divs with `<Skeleton />` from `@/components/ui/skeleton`.

#### 9c. `src/app/[locale]/(protected)/error.tsx`

Sweep hardcoded neutral/dark classes to token equivalents.

#### 9d. `src/components/shared/app-nav/_components/sign-out-button.tsx`

Sweep hardcoded classes to token equivalents.

#### 9e. `src/components/shared/app-nav/_components/notification-badge.tsx`

Replace `bg-amber-600` with `bg-destructive text-destructive-foreground`. Notification count badge is semantically alert/warning.

#### 9f. `src/components/shared/language-switcher/language-switcher.tsx`

Replace the full class string with token classes. Consider replacing raw `<button>` with `<Button variant="outline" size="sm">` from shadcn.

#### 9g. Auth form pages

Sweep `zinc-*` and hardcoded dark classes in:
- `src/app/[locale]/iniciar-sesion/_components/sign-in-form.tsx`
- Any reset-password, update-password, invitation form components

Key replacements:
- Raw `<input>` → `<Input>` from `@/components/ui/input`
- Raw `<label>` → `<Label>` from `@/components/ui/label`
- Raw `<button type="submit">` → `<Button type="submit">`
- `border-zinc-* bg-white dark:border-zinc-* dark:bg-zinc-*` → `bg-card border-border`
- `text-zinc-900 dark:text-zinc-50` → `text-card-foreground`

### Step 10 — Add i18n keys

Both `messages/es-MX.json` and `messages/en-US.json` must have **exact key parity**.

**`theme` namespace — es-MX.json:**

```json
"theme": {
  "light": "Claro",
  "dark": "Oscuro",
  "currentLight": "Tema actual: Claro",
  "currentDark": "Tema actual: Oscuro",
  "switchToLight": "Cambiar a tema claro",
  "switchToDark": "Cambiar a tema oscuro"
}
```

**`theme` namespace — en-US.json:**

```json
"theme": {
  "light": "Light",
  "dark": "Dark",
  "currentLight": "Current theme: Light",
  "currentDark": "Current theme: Dark",
  "switchToLight": "Switch to light theme",
  "switchToDark": "Switch to dark theme"
}
```

**`shell.nav` additions — es-MX.json (inside existing shell.nav object):**

```json
"openMenu": "Abrir menú de navegación",
"closeMenu": "Cerrar menú de navegación"
```

**`shell.nav` additions — en-US.json:**

```json
"openMenu": "Open navigation menu",
"closeMenu": "Close navigation menu"
```

> **IMPORTANT:** `taskStatus`, `deliverableStatus`, `members.capacity` namespaces referenced in `status-maps.ts` will be established in S04-03 and later. Do NOT add them in S04-01.

### Step 11 — Create semantic status mapping utilities

**Create `src/lib/status-maps.ts`:**

This file centralizes all visual/semantic mapping. No Sprint 04 UI should hardcode status-to-color mappings inline.

```ts
import type { LucideIcon } from "lucide-react";
import {
  Clock,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Flag,
  CircleDot,
  ArrowRight,
  Send,
  ThumbsUp,
  RotateCcw,
  Truck,
  AlertCircle,
  ShieldCheck,
  User,
  UserCheck,
  Users,
} from "lucide-react";

// ── Project status ────────────────────────────────────────────────────────────

export type ProjectStatus =
  | "planning"
  | "in_progress"
  | "paused"
  | "completed"
  | "cancelled";

export interface StatusConfig {
  badgeBg: string;
  badgeFg: string;
  icon: LucideIcon;
  labelKey: string;
}

export const PROJECT_STATUS_MAP: Record<ProjectStatus, StatusConfig> = {
  planning: {
    badgeBg: "bg-blue-100 dark:bg-blue-950/60",
    badgeFg: "text-blue-800 dark:text-blue-200",
    icon: Clock,
    labelKey: "planning",
  },
  in_progress: {
    badgeBg: "bg-yellow-100 dark:bg-yellow-950/60",
    badgeFg: "text-yellow-800 dark:text-yellow-200",
    icon: Play,
    labelKey: "inProgress",
  },
  paused: {
    badgeBg: "bg-muted",
    badgeFg: "text-muted-foreground",
    icon: Pause,
    labelKey: "paused",
  },
  completed: {
    badgeBg: "bg-green-100 dark:bg-green-950/60",
    badgeFg: "text-green-800 dark:text-green-200",
    icon: CheckCircle,
    labelKey: "completed",
  },
  cancelled: {
    badgeBg: "bg-red-100 dark:bg-red-950/60",
    badgeFg: "text-red-800 dark:text-red-200",
    icon: XCircle,
    labelKey: "cancelled",
  },
};

// ── Task status ───────────────────────────────────────────────────────────────

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "in_review"
  | "completed"
  | "blocked";

export const TASK_STATUS_MAP: Record<TaskStatus, StatusConfig> = {
  pending: {
    badgeBg: "bg-blue-100 dark:bg-blue-950/60",
    badgeFg: "text-blue-800 dark:text-blue-200",
    icon: Clock,
    labelKey: "taskStatus.pending",
  },
  in_progress: {
    badgeBg: "bg-indigo-100 dark:bg-indigo-950/60",
    badgeFg: "text-indigo-800 dark:text-indigo-200",
    icon: CircleDot,
    labelKey: "taskStatus.inProgress",
  },
  in_review: {
    badgeBg: "bg-purple-100 dark:bg-purple-950/60",
    badgeFg: "text-purple-800 dark:text-purple-200",
    icon: Eye,
    labelKey: "taskStatus.inReview",
  },
  completed: {
    badgeBg: "bg-green-100 dark:bg-green-950/60",
    badgeFg: "text-green-800 dark:text-green-200",
    icon: CheckCircle,
    labelKey: "taskStatus.completed",
  },
  blocked: {
    // IMPORTANT: blocked STATUS != blocking PRIORITY.
    // blocked = this task cannot proceed due to external blocker.
    // Uses AlertTriangle icon to distinguish from blocking priority (ShieldCheck).
    badgeBg: "bg-red-100 dark:bg-red-950/60",
    badgeFg: "text-red-800 dark:text-red-200",
    icon: AlertTriangle,
    labelKey: "taskStatus.blocked",
  },
};

// ── Task priority ─────────────────────────────────────────────────────────────

export type TaskPriority = "low" | "medium" | "high" | "blocking";

export const TASK_PRIORITY_MAP: Record<TaskPriority, StatusConfig> = {
  low: {
    badgeBg: "bg-green-100 dark:bg-green-950/60",
    badgeFg: "text-green-800 dark:text-green-200",
    icon: ArrowRight,
    labelKey: "priority.low",
  },
  medium: {
    badgeBg: "bg-yellow-100 dark:bg-yellow-950/60",
    badgeFg: "text-yellow-800 dark:text-yellow-200",
    icon: Flag,
    labelKey: "priority.medium",
  },
  high: {
    badgeBg: "bg-orange-100 dark:bg-orange-950/60",
    badgeFg: "text-orange-800 dark:text-orange-200",
    icon: AlertCircle,
    labelKey: "priority.high",
  },
  blocking: {
    // IMPORTANT: blocking PRIORITY != blocked STATUS.
    // blocking = this task blocks other work from proceeding.
    // Uses ShieldCheck icon and rose hue to distinguish from blocked status (AlertTriangle + red).
    badgeBg: "bg-rose-200 dark:bg-rose-950/80",
    badgeFg: "text-rose-900 dark:text-rose-100 font-semibold",
    icon: ShieldCheck,
    labelKey: "priority.blocking",
  },
};

// ── Deliverable lifecycle state ───────────────────────────────────────────────

export type DeliverableStatus =
  | "pending"
  | "awaiting_internal_review"
  | "awaiting_client_review"
  | "approved"
  | "changes_requested"
  | "delivered";

export const DELIVERABLE_STATUS_MAP: Record<DeliverableStatus, StatusConfig> = {
  pending: {
    badgeBg: "bg-blue-100 dark:bg-blue-950/60",
    badgeFg: "text-blue-800 dark:text-blue-200",
    icon: Clock,
    labelKey: "deliverableStatus.pending",
  },
  awaiting_internal_review: {
    badgeBg: "bg-indigo-100 dark:bg-indigo-950/60",
    badgeFg: "text-indigo-800 dark:text-indigo-200",
    icon: Eye,
    labelKey: "deliverableStatus.awaitingInternalReview",
  },
  awaiting_client_review: {
    badgeBg: "bg-purple-100 dark:bg-purple-950/60",
    badgeFg: "text-purple-800 dark:text-purple-200",
    icon: Send,
    labelKey: "deliverableStatus.awaitingClientReview",
  },
  approved: {
    badgeBg: "bg-green-100 dark:bg-green-950/60",
    badgeFg: "text-green-800 dark:text-green-200",
    icon: ThumbsUp,
    labelKey: "deliverableStatus.approved",
  },
  changes_requested: {
    badgeBg: "bg-orange-100 dark:bg-orange-950/60",
    badgeFg: "text-orange-800 dark:text-orange-200",
    icon: RotateCcw,
    labelKey: "deliverableStatus.changesRequested",
  },
  delivered: {
    badgeBg: "bg-teal-100 dark:bg-teal-950/60",
    badgeFg: "text-teal-800 dark:text-teal-200",
    icon: Truck,
    labelKey: "deliverableStatus.delivered",
  },
};

// ── Project membership capacity ───────────────────────────────────────────────

export type MemberCapacity = "pm_lead" | "pm_watcher" | "operator" | "client";

export interface CapacityConfig {
  icon: LucideIcon;
  labelKey: string;
}

export const MEMBER_CAPACITY_MAP: Record<MemberCapacity, CapacityConfig> = {
  pm_lead: { icon: UserCheck, labelKey: "capacity.pmLead" },
  pm_watcher: { icon: Eye, labelKey: "capacity.pmWatcher" },
  operator: { icon: User, labelKey: "capacity.operator" },
  client: { icon: Users, labelKey: "capacity.client" },
};
```

### Step 12 — Write focused automated tests

**Test files to create:**
- `src/components/shared/theme/__tests__/theme-provider.test.tsx`
- `src/components/shared/theme/__tests__/theme-toggle.test.tsx`

Using Vitest + React Testing Library + jest-axe (already installed).

**ThemeProvider test cases:**
1. Renders children correctly.
2. Light is the initial default (no localStorage entry → light mode).
3. An explicit `dark` selection in localStorage is honored on re-render (simulated).
4. System preference (`prefers-color-scheme: dark`) does NOT override the light default (`enableSystem={false}`).

**ThemeToggle test cases:**
1. Renders a keyboard-operable trigger button with a non-empty `aria-label`.
2. `aria-pressed` reflects the current theme state.
3. Dropdown presents Light and Dark options (localized labels).
4. Clicking Light option calls `setTheme("light")`.
5. Clicking Dark option calls `setTheme("dark")`.
6. Active theme option has `aria-current="true"`.
7. Component passes axe accessibility check (jest-axe, no violations).

**Constraint:** Mock `next-themes` hooks. Do not test shadcn/Radix internals. No authorization tests in S04-01.

---

## 5. File inventory

### Files to CREATE

| File | How created |
|---|---|
| `components.json` | CLI: `npx shadcn@latest init --preset b2J0x9uLeE` |
| `src/lib/utils.ts` | CLI (verify content after) |
| `src/components/ui/*` (all Sprint 04 primitives) | CLI: `npx shadcn@latest add ...` |
| `src/components/shared/theme/theme-provider.tsx` | Manual (Step 4) |
| `src/components/shared/theme/theme-toggle.tsx` | Manual (Step 5) |
| `src/lib/status-maps.ts` | Manual (Step 11) |
| `src/components/shared/theme/__tests__/theme-provider.test.tsx` | Manual (Step 12) |
| `src/components/shared/theme/__tests__/theme-toggle.test.tsx` | Manual (Step 12) |

### Files to MODIFY

| File | Change summary |
|---|---|
| `src/app/layout.tsx` | Remove Geist; add preset font + ThemeProvider + Toaster + suppressHydrationWarning |
| `src/app/globals.css` | CLI rewrites; then remove old font refs and prefers-color-scheme block |
| `src/components/shared/app-nav/app-nav.tsx` | Token sweep + add ThemeToggle to desktop nav |
| `src/components/shared/app-nav/_components/mobile-nav-toggle.tsx` | Lucide icons + token sweep + add ThemeToggle to drawer |
| `src/components/shared/app-nav/_components/notification-badge.tsx` | amber → destructive token |
| `src/components/shared/app-nav/_components/sign-out-button.tsx` | Token sweep |
| `src/components/shared/language-switcher/language-switcher.tsx` | Token sweep; optionally use shadcn Button |
| `src/app/[locale]/(protected)/layout.tsx` | Token sweep |
| `src/app/[locale]/(protected)/loading.tsx` | Token sweep or use Skeleton primitive |
| `src/app/[locale]/(protected)/error.tsx` | Token sweep |
| Auth form components (sign-in, reset, update, invitation) | Token sweep + shadcn Input/Label/Button |
| `messages/es-MX.json` | Add `theme` namespace + `shell.nav` aria keys |
| `messages/en-US.json` | Add `theme` namespace + `shell.nav` aria keys (exact parity) |

---

## 6. Known issues, conflicts, and Project Owner flags

### FLAG 1 — CONFLICT: CSP blocks Google Fonts CDN (HIGH)

`next.config.ts` sets `font-src 'self' data:`. If the shadcn CLI writes `@import url(fonts.googleapis.com/...)` into `globals.css`, it MUST be removed immediately. Use only `next/font/google` for all font loading.

**Implementer action required. No Project Owner action needed.**

### FLAG 2 — CONFLICT: Existing `prefers-color-scheme` behavior (MEDIUM)

`globals.css` has `@media (prefers-color-scheme: dark)` that overrides `:root` CSS variables independently of `next-themes`. This conflicts with `defaultTheme="light"`. Must be removed in Step 3c.

**Implementer action required. No Project Owner action needed.**

### FLAG 3 — RESOLVED: Brand mark in AppNav

**Decision (Project Owner, 2026-08-19):** Use `public/joya-icon.svg` loaded via `next/image` (`<Image src="/joya-icon.svg" alt="Joya" width={32} height={32} />`). If SVG rendering issues arise at the target size or with theme switching, fall back to a plain `<img src="/joya-icon.svg" width="32" height="32" alt="Joya" />` (both serve from `public/`, no additional CSP changes needed). If neither works, keep the amber circle as a documented brand exception.

**No further action needed. Implementer executes this decision.**

### FLAG 4 — RESOLVED: Monospace font

**Decision (Project Owner, 2026-08-19):** shadcn/ui includes Geist Mono as its standard monospace font. Keep it. Load `Geist_Mono` from `next/font/google` in the root layout (self-hosted, CSP-compliant) and assign it to the `--font-mono` CSS variable. This makes monospace rendering available for any future use — code display, API keys, numeric data — without re-opening this decision in later sprints.

**Implementation impact:** `layout.tsx` loads both `fontSans` (preset sans font) and `fontMono` (Geist Mono). Both variables are applied to `<html className>`. See Step 3b for the updated code.

**No further action needed. Implementer executes this decision.**

### FLAG 5 — OBSERVATION: suppressHydrationWarning scope (MEDIUM)

`suppressHydrationWarning` MUST ONLY appear on `<html>`. Adding it to `<body>`, `<main>`, or any other element to "fix" hydration errors is not acceptable — those errors indicate a real bug.

### FLAG 6 — OBSERVATION: storageKey stability (MEDIUM)

`storageKey="jsf-pm-theme"` in ThemeProvider must never be changed after first deployment. Changing it resets all users' saved theme preferences.

### FLAG 7 — OBSERVATION: aria-disabled stub links (LOW)

AppNav and MobileNavToggle use `<a aria-disabled="true" tabIndex={-1}>` for project stub links. Acceptable in S04-01. When S04-03 activates these links, `aria-disabled`, `tabIndex={-1}`, and `cursor-not-allowed` must all be removed.

### FLAG 8 — CONFIRMED: No Supabase MCP operations needed (see Section 11)

---

## 7. Acceptance criteria checklist

### 7.1 shadcn/ui initialization

- [ ] `components.json` exists with `"style": "mira"`, `"tailwind.cssVariables": true`, correct `@/*` aliases, `"rsc": true`.
- [ ] All Sprint 04 primitives installed under `src/components/ui/`.
- [ ] `src/lib/utils.ts` exports `cn()` using `clsx` + `tailwind-merge`.
- [ ] `lucide-react`, `class-variance-authority`, `tailwind-merge`, `next-themes` in `package.json` dependencies.
- [ ] No external font CDN URLs in any CSS file.

### 7.2 Font system

- [ ] Old Geist Sans import removed from `src/app/layout.tsx` and replaced with preset sans font.
- [ ] Geist Mono import preserved (or re-added) in `src/app/layout.tsx` as the standard monospace font, assigned to `--font-mono`.
- [ ] Preset sans font loaded via `next/font/google` with CSS variable `--font-sans` (or as directed by CLI).
- [ ] `Geist_Mono` loaded via `next/font/google` with CSS variable `--font-mono`.
- [ ] `--font-geist-sans` and `--font-geist-mono` (the OLD variable names from the pre-shadcn setup) are absent from the entire codebase. New variable names `--font-sans` and `--font-mono` replace them.
- [ ] Both `${fontSans.variable}` and `${fontMono.variable}` applied to `<html className>` in root layout.
- [ ] Font renders correctly on `/iniciar-sesion` and protected dashboards.

### 7.3 Theme system

- [ ] `ThemeProvider` wraps `{children}` in root layout.
- [ ] `suppressHydrationWarning` on `<html>` and ONLY `<html>`.
- [ ] First-time visitor (no localStorage) sees light mode.
- [ ] Switching to dark → refresh → dark persists.
- [ ] Switching to light → refresh → light persists.
- [ ] OS dark preference does not override default or explicit selection.
- [ ] No hydration warning in browser console.
- [ ] No visible theme flash on load or navigation.
- [ ] `storageKey="jsf-pm-theme"` confirmed in `theme-provider.tsx`.

### 7.4 ThemeToggle

- [ ] Visible and operable in desktop AppNav.
- [ ] Visible and operable in mobile nav drawer.
- [ ] Non-empty, localized `aria-label`.
- [ ] Dropdown presents explicit Light and Dark options in both locales.
- [ ] Active theme option has `aria-current="true"`.
- [ ] Fully keyboard-operable (Tab, Enter, Arrow keys, Escape).
- [ ] axe reports no accessibility violations.

### 7.5 Token-based styling sweep

- [ ] No hardcoded `dark:bg-neutral-*`, `dark:text-neutral-*`, `dark:border-neutral-*` in modified files.
- [ ] No `bg-zinc-*` / `text-zinc-*` in auth forms.
- [ ] Protected layout uses `bg-background text-foreground`.
- [ ] Loading skeleton uses `bg-muted` or `<Skeleton>`.
- [ ] AppNav header uses `bg-background/95 border-border`.
- [ ] Focus rings use `focus-visible:ring-ring`.

### 7.6 Semantic status mapping

- [ ] `src/lib/status-maps.ts` exports all five maps.
- [ ] `blocking` priority and `blocked` status use DIFFERENT icons and DIFFERENT hues.
- [ ] All maps work correctly in both light and dark themes.

### 7.7 Localization

- [ ] `theme` namespace with 6 keys in both catalogs.
- [ ] `shell.nav.openMenu` and `shell.nav.closeMenu` in both catalogs.
- [ ] Exact key parity between es-MX and en-US.
- [ ] No user-visible string hardcoded.

### 7.8 Build and verification

- [ ] `npm run format:check` passes.
- [ ] `npm run lint` passes (no new errors).
- [ ] `npm run typecheck` passes (strict TypeScript, no `any`).
- [ ] `npm run build` produces no errors.
- [ ] `npm run test` passes (all new tests green; no regressions).

---

## 8. Verification commands

```bash
# Per-step fast feedback:
npm run typecheck
npm run lint

# Full verification at S04-01 completion:
npm run format:check && npm run lint && npm run typecheck && npm run build && npm run test
```

**Manual localhost journeys:**

1. Open `/iniciar-sesion` in an incognito window. Confirm: white background (light mode), preset font renders, no CSP errors in browser console.
2. Sign in as admin. Confirm: AppNav renders in light mode, ThemeToggle present with correct label.
3. Click ThemeToggle → select Dark. Confirm: page switches to dark mode.
4. Refresh. Confirm: dark mode persists.
5. Switch back to Light. Refresh. Confirm: light mode persists.
6. DevTools → Application → Local Storage → confirm `jsf-pm-theme` key with correct value.
7. DevTools → Console → confirm zero hydration warnings.
8. Tab-only navigation to ThemeToggle → open dropdown → select option. Confirm keyboard operability.
9. Run `npm run test`. Confirm new tests pass.
10. Repeat journey in `/en/iniciar-sesion` and `/en/admin` to confirm English locale + both themes work.

---

## 9. Rollback notes

- `components.json` and `globals.css` are git-tracked. `git checkout -- src/app/globals.css` restores old CSS.
- Packages added by CLI: `npm uninstall class-variance-authority tailwind-merge lucide-react next-themes`.
- Do not commit in a broken state. Run `npm run typecheck` before committing each step.

---

## 10. Dependencies and prerequisites

| Dependency | Status |
|---|---|
| Sprint 03 baseline integrated and building | Required — verify before starting |
| Project Owner visual decisions (Section 2) | DONE |
| `npm run verify` clean at sprint start | Recommended — establish baseline |

---

## 11. Supabase MCP operations — explicit confirmation

**NO Supabase MCP operations are required or permitted for S04-01.**

S04-01 is a purely frontend/styling/theming work item: npm package installation, shadcn CLI execution, CSS and TSX file creation/modification, and message catalog updates. No database schema changes, no RLS policy changes, no migration SQL, no type generation, and no `src/lib/database.types.ts` edits. The only authorized Supabase MCP operations in Sprint 04 involve a separately gated architect-only P1D/G1-S/G1-T process that does not apply here.

---

## 12. Follow-up and deferred decisions

| Item | Deferred to |
|---|---|
| Activate `/admin/proyectos` and `/pm/proyectos` nav stub links | S04-03 (when routes exist) |
| Remove `aria-disabled` / `tabIndex={-1}` from nav stubs | S04-03 |
| Add `taskStatus`, `deliverableStatus`, `members.capacity` i18n keys | S04-03 |
| Confirm monospace font requirement | Before closing S04-01 (Flag 4) |
| Finalize brand mark treatment in AppNav | Before closing S04-01 (Flag 3) |

---

*Spec written: 2026-08-19. Authority: Sprint S04 plan, Sections 4 and 5.*
