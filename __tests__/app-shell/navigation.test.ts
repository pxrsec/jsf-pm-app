import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import esCatalog from "../../messages/es-MX.json";

vi.mock("server-only", () => ({}));

vi.mock("@/components/shared/language-switcher/language-switcher", () => ({
  LanguageSwitcher: () =>
    React.createElement("div", { "data-testid": "language-switcher" }),
}));

vi.mock("@/components/shared/theme/theme-toggle", () => ({
  ThemeToggle: () =>
    React.createElement("div", { "data-testid": "theme-toggle" }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

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

const mockSignOut = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase/browser", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signOut: mockSignOut,
    },
  })),
}));

import { AppNav } from "@/components/shared/app-nav/app-nav";
import { NotificationBadge } from "@/components/shared/app-nav/_components/notification-badge";
import { SignOutButton } from "@/components/shared/app-nav/_components/sign-out-button";
import { MobileNavToggle } from "@/components/shared/app-nav/_components/mobile-nav-toggle";
import type { SessionContext, Profile } from "@/lib/auth/session";

function createMockProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "u-1",
    role: "admin",
    full_name: "Test User",
    avatar_url: null,
    is_active: true,
    deleted_at: null,
    phone_e164: null,
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

describe("Global Navigation (AppNav & Subcomponents)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseUser = { id: "u-1", email: "user@jsf.internal" };

  describe("AppNav Server Component per role", () => {
    it("renders admin navigation with /admin link and hides other role links", async () => {
      const session: SessionContext = {
        user: baseUser as unknown as SessionContext["user"],
        profile: createMockProfile({
          id: "u-1",
          full_name: "Admin User",
          role: "admin",
        }),
        role: "admin",
      };

      const html = renderToStaticMarkup(
        await AppNav({ session, unreadCount: 3 }),
      );

      expect(html).toContain('href="/admin"');
      expect(html).toContain('href="/admin/proyectos"');
      expect(html).not.toContain('href="/pm"');
      expect(html).not.toContain('href="/operador"');
      expect(html).not.toContain('href="/cliente"');
      expect(html).toContain("Admin User");
      expect(html).toContain("Administrador");
      expect(html).toContain('aria-label="Navegación principal"');
    });

    it("renders pm navigation with /pm link and hides /admin link", async () => {
      const session: SessionContext = {
        user: baseUser as unknown as SessionContext["user"],
        profile: createMockProfile({
          id: "u-2",
          full_name: "PM User",
          role: "pm",
        }),
        role: "pm",
      };

      const html = renderToStaticMarkup(
        await AppNav({ session, unreadCount: 0 }),
      );

      expect(html).toContain('href="/pm"');
      expect(html).toContain('href="/pm/proyectos"');
      expect(html).not.toContain('href="/admin"');
      expect(html).toContain("PM User");
      expect(html).toContain("Project Manager");
    });

    it("renders operator navigation with /operador link and agenda stub", async () => {
      const session: SessionContext = {
        user: baseUser as unknown as SessionContext["user"],
        profile: createMockProfile({
          id: "u-3",
          full_name: "Operator User",
          role: "operator",
        }),
        role: "operator",
      };

      const html = renderToStaticMarkup(
        await AppNav({ session, unreadCount: 7 }),
      );

      expect(html).toContain('href="/operador"');
      expect(html).toContain('href="/operador/agenda"');
      expect(html).not.toContain('href="/admin"');
      expect(html).not.toContain('href="/pm"');
      expect(html).toContain("Operator User");
      expect(html).toContain("Operador");
    });

    it("renders client navigation with /cliente link", async () => {
      const session: SessionContext = {
        user: baseUser as unknown as SessionContext["user"],
        profile: createMockProfile({
          id: "u-4",
          full_name: "Client User",
          role: "client",
        }),
        role: "client",
      };

      const html = renderToStaticMarkup(
        await AppNav({ session, unreadCount: 0 }),
      );

      expect(html).toContain('href="/cliente"');
      expect(html).toContain('href="/cliente/proyectos"');
      expect(html).not.toContain('href="/admin"');
      expect(html).toContain("Client User");
      expect(html).toContain("Cliente");
    });
  });

  describe("NotificationBadge", () => {
    it("renders visually hidden with aria-live when count is 0", () => {
      const html = renderToStaticMarkup(
        React.createElement(NotificationBadge, { count: 0 }),
      );
      expect(html).toContain("sr-only");
      expect(html).toContain('aria-label="Notificaciones no leídas: 0"');
    });

    it("renders numeric count when count is 5", () => {
      const html = renderToStaticMarkup(
        React.createElement(NotificationBadge, { count: 5 }),
      );
      expect(html).toContain("5");
      expect(html).toContain('aria-label="Notificaciones no leídas: 5"');
    });

    it("renders 99+ when count is 100", () => {
      const html = renderToStaticMarkup(
        React.createElement(NotificationBadge, { count: 100 }),
      );
      expect(html).toContain("99+");
      expect(html).toContain('aria-label="Notificaciones no leídas: 100"');
    });
  });

  describe("SignOutButton", () => {
    it("renders accessible sign-out button with correct label", () => {
      const html = renderToStaticMarkup(React.createElement(SignOutButton));
      expect(html).toContain("Cerrar sesión");
      expect(html).toContain('aria-label="Cerrar sesión"');
      expect(html).toContain('type="button"');
    });
  });

  describe("MobileNavToggle", () => {
    it("renders closed toggle with accessible aria attributes", () => {
      const profile = createMockProfile({
        id: "u-1",
        full_name: "Admin User",
        role: "admin",
      });

      const html = renderToStaticMarkup(
        React.createElement(MobileNavToggle, {
          role: "admin",
          profile,
          unreadCount: 2,
        }),
      );

      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain('aria-controls="mobile-nav-drawer"');
    });
  });
});
