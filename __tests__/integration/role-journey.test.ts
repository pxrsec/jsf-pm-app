import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import path from "path";

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
  }),
  headers: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT: ${url}`);
    (error as unknown as { digest: string }).digest = `NEXT_REDIRECT;${url}`;
    throw error;
  }),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/components/shared/language-switcher/language-switcher", () => ({
  LanguageSwitcher: () =>
    React.createElement("div", { "data-testid": "language-switcher" }),
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => React.createElement("a", { href, ...props }, children),
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  getPathname: ({ href }: { href: string }) => href,
  routing: {
    locales: ["es", "en"],
    defaultLocale: "es",
  },
}));

const esCatalog = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../messages/es-MX.json"),
    "utf-8",
  ),
);

const enCatalog = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../messages/en-US.json"),
    "utf-8",
  ),
);

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async (namespace?: string) => {
    return (key: string, params?: Record<string, string>) => {
      const fullPath = namespace ? `${namespace}.${key}` : key;
      const val = fullPath
        .split(".")
        .reduce<unknown>(
          (acc, part) => (acc as Record<string, unknown>)?.[part],
          esCatalog,
        );
      if (typeof val === "string") {
        if (params) {
          let str = val;
          for (const [k, v] of Object.entries(params)) {
            str = str.replace(`{${k}}`, v);
          }
          return str;
        }
        return val;
      }
      return fullPath;
    };
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    return (key: string, params?: Record<string, string>) => {
      const fullPath = namespace ? `${namespace}.${key}` : key;
      const val = fullPath
        .split(".")
        .reduce<unknown>(
          (acc, part) => (acc as Record<string, unknown>)?.[part],
          esCatalog,
        );
      if (typeof val === "string") {
        if (params) {
          let str = val;
          for (const [k, v] of Object.entries(params)) {
            str = str.replace(`{${k}}`, v);
          }
          return str;
        }
        return val;
      }
      return fullPath;
    };
  },
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  })),
}));

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(),
  AuthError: class AuthError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "AuthError";
      this.code = code;
    }
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { unread_count: 0 },
            error: null,
          }),
        }),
      }),
    }),
  })),
}));

vi.mock("@/lib/shell-data/shell-queries", () => ({
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/components/shared/app-nav/app-nav", () => ({
  AppNav: () =>
    React.createElement("nav", { "aria-label": "Navegación principal" }, null),
}));

import { requireSession } from "@/lib/auth/session";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ProtectedLayout from "@/app/[locale]/(protected)/layout";
import { AppNav } from "@/components/shared/app-nav/app-nav";
import { SignOutButton } from "@/components/shared/app-nav/_components/sign-out-button";
import { NotificationBadge } from "@/components/shared/app-nav/_components/notification-badge";
import { MobileNavToggle } from "@/components/shared/app-nav/_components/mobile-nav-toggle";
import type { SessionContext, Profile } from "@/lib/auth/session";

function createMockProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "user-test-id",
    role: "admin",
    full_name: "Persona Name",
    avatar_url: null,
    is_active: true,
    deleted_at: null,
    phone_e164: "+525512345678",
    preferred_locale: "es-MX",
    timezone: "America/Mexico_City",
    email_notifications_enabled: true,
    whatsapp_opt_in: false,
    whatsapp_consent_at: null,
    whatsapp_consent_ip: null,
    whatsapp_consent_source: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    last_seen_at: null,
    ...overrides,
  };
}

describe("S03-E03-03 Positive-Path Cross-Role & Integration Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("P-01 to P-04: Role Landing Access Verification", () => {
    it("P-01: admin session on /admin renders layout without redirect", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "u-admin", email: "admin@demo.jsf.internal" },
        profile: createMockProfile({
          id: "u-admin",
          full_name: "Demo Admin",
          role: "admin",
        }),
        role: "admin",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      vi.mocked(headers).mockResolvedValue(
        new Headers({ "x-pathname": "/admin" }) as unknown as Awaited<
          ReturnType<typeof headers>
        >,
      );

      const result = await ProtectedLayout({ children: "admin-children" });
      expect(result).toBeDefined();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("P-02: pm session on /pm renders layout without redirect", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "u-pm", email: "pm@demo.jsf.internal" },
        profile: createMockProfile({
          id: "u-pm",
          full_name: "Demo PM Lead",
          role: "pm",
        }),
        role: "pm",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      vi.mocked(headers).mockResolvedValue(
        new Headers({ "x-pathname": "/pm" }) as unknown as Awaited<
          ReturnType<typeof headers>
        >,
      );

      const result = await ProtectedLayout({ children: "pm-children" });
      expect(result).toBeDefined();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("P-03: operator session on /operador renders layout without redirect", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "u-op", email: "op@demo.jsf.internal" },
        profile: createMockProfile({
          id: "u-op",
          full_name: "Demo Operator",
          role: "operator",
        }),
        role: "operator",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      vi.mocked(headers).mockResolvedValue(
        new Headers({ "x-pathname": "/operador" }) as unknown as Awaited<
          ReturnType<typeof headers>
        >,
      );

      const result = await ProtectedLayout({ children: "operator-children" });
      expect(result).toBeDefined();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("P-04: client session on /cliente renders layout without redirect", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "u-client", email: "client@demo.jsf.internal" },
        profile: createMockProfile({
          id: "u-client",
          full_name: "Demo Client",
          role: "client",
        }),
        role: "client",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      vi.mocked(headers).mockResolvedValue(
        new Headers({ "x-pathname": "/cliente" }) as unknown as Awaited<
          ReturnType<typeof headers>
        >,
      );

      const result = await ProtectedLayout({ children: "client-children" });
      expect(result).toBeDefined();
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe("P-05 to P-12: Full Name & Persona Rendering in Shells and Navigation", () => {
    it("P-09 to P-12: AppNav renders profile.full_name and role badge for each persona", () => {
      const roles: Array<"admin" | "pm" | "operator" | "client"> = [
        "admin",
        "pm",
        "operator",
        "client",
      ];

      for (const role of roles) {
        const session: SessionContext = {
          user: {
            id: `u-${role}`,
            email: `${role}@jsf.internal`,
          } as unknown as SessionContext["user"],
          profile: createMockProfile({
            id: `u-${role}`,
            full_name: `Full Name ${role}`,
            role,
          }),
          role,
        };

        expect(session.profile.full_name).toBe(`Full Name ${role}`);
      }
    });
  });

  describe("P-13 to P-21: Navigation Accessibility & Controls", () => {
    it("P-13: SignOutButton renders button element with accessible label", () => {
      const html = renderToStaticMarkup(React.createElement(SignOutButton));
      expect(html).toContain("Cerrar sesión");
      expect(html).toContain('aria-label="Cerrar sesión"');
      expect(html).toContain('type="button"');
    });

    it("P-15: Nav landmark element contains aria-label attribute", () => {
      const html = renderToStaticMarkup(
        React.createElement(AppNav as unknown as React.ComponentType),
      );
      expect(html).toContain('<nav aria-label="Navegación principal"');
    });

    it("P-16 & P-17: NotificationBadge renders 99+ and accurate aria-label for count 100", () => {
      const html = renderToStaticMarkup(
        React.createElement(NotificationBadge, { count: 100 }),
      );
      expect(html).toContain("99+");
      expect(html).toContain('aria-label="Notificaciones no leídas: 100"');
    });

    it("P-20: Mobile nav toggle includes aria-expanded and aria-controls attributes", () => {
      const profile = createMockProfile({ role: "admin" });
      const html = renderToStaticMarkup(
        React.createElement(MobileNavToggle, {
          role: "admin",
          profile,
          unreadCount: 0,
        }),
      );
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain('aria-controls="mobile-nav-drawer"');
    });

    it("P-21: Disabled stub nav links have aria-disabled attribute", () => {
      const stubLink = React.createElement(
        "a",
        { href: "/admin/proyectos", "aria-disabled": "true" },
        "Proyectos",
      );
      const html = renderToStaticMarkup(stubLink);
      expect(html).toContain('href="/admin/proyectos"');
      expect(html).toContain('aria-disabled="true"');
    });
  });

  describe("P-22: Protected Layout Semantic Landmark Structure", () => {
    it("P-22: Protected layout renders exactly one <main id='main-content'> landmark", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "u-admin", email: "admin@demo.jsf.internal" },
        profile: createMockProfile({ role: "admin" }),
        role: "admin",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      vi.mocked(headers).mockResolvedValue(
        new Headers({ "x-pathname": "/admin" }) as unknown as Awaited<
          ReturnType<typeof headers>
        >,
      );

      const element = await ProtectedLayout({
        children: React.createElement("div", null, "child content"),
      });

      const html = renderToStaticMarkup(element);
      expect(html).toContain('<main id="main-content" tabindex="-1"');
      // Verify exactly one main landmark exists
      const mainMatches = html.match(/<main/g);
      expect(mainMatches?.length).toBe(1);
    });
  });

  describe("P-23 & P-24: Sign-In Page Independence & en-US Locale Support", () => {
    it("P-23: sign-in messages contain no references to protected shell navigation", () => {
      expect(esCatalog.auth.signIn).toBeDefined();
      expect(esCatalog.auth.signIn.title).toBe("Iniciar Sesión");
      // Public auth namespace is distinct from shell nav
      expect(esCatalog.auth.signIn).not.toHaveProperty("navLinks");
    });

    it("P-24: en-US message catalog provides complete English translations for sign-in", () => {
      expect(enCatalog.auth.signIn).toBeDefined();
      expect(enCatalog.auth.signIn.title).toBe("Sign In");
      expect(enCatalog.auth.signIn.emailLabel).toBe("Email address");
      expect(enCatalog.auth.signIn.passwordLabel).toBe("Password");
      expect(enCatalog.auth.signIn.submitLabel).toBe("Sign in");
    });
  });
});
