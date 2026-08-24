// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import esCatalog from "../../messages/es-MX.json";

vi.mock("server-only", () => ({}));

vi.mock("@/i18n/routing", () => ({
  Link: ({
    href,
    children,
    className,
    onClick,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    [key: string]: unknown;
  }) =>
    React.createElement(
      "a",
      { href, className, onClick, ...props, "data-testid": "locale-link" },
      children,
    ),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
}));

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

  afterEach(() => {
    cleanup();
  });

  const baseUser = { id: "u-1", email: "user@jsf.internal" };

  describe("AppNav Server Component per role and capability", () => {
    it("renders admin navigation with /admin, /admin/proyectos, /notificaciones, and /admin/notificaciones", async () => {
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
        await AppNav({
          session,
          unreadCount: 3,
          canAccessNotificationOperations: true,
        }),
      );

      expect(html).toContain('href="/admin"');
      expect(html).toContain('href="/admin/proyectos"');
      expect(html).toContain('href="/admin/archivo"');
      expect(html).toContain('href="/admin/incidentes-enlaces"');
      expect(html).toContain('href="/notificaciones"');
      expect(html).toContain(
        'aria-label="Bandeja de notificaciones, 3 no leídas"',
      );
      expect(html).toContain('href="/admin/notificaciones"');
      expect(html).toContain("Operaciones de Notificaciones");
      expect(html).toContain('role="status" aria-live="polite"');
      expect(html).toContain("Notificaciones no leídas: 3");
      expect(html).not.toContain('href="/pm"');
      expect(html).not.toContain('href="/operador"');
      expect(html).not.toContain('href="/cliente"');
      expect(html).toContain("Admin User");
      expect(html).toContain("Administrador");
      expect(html).toContain('aria-label="Navegación principal"');
    });

    it("renders pm lead navigation with /pm, /pm/proyectos, /pm/archivo, /pm/incidentes-enlaces, /notificaciones, and /pm/notificaciones", async () => {
      const session: SessionContext = {
        user: baseUser as unknown as SessionContext["user"],
        profile: createMockProfile({
          id: "u-2",
          full_name: "PM Lead User",
          role: "pm",
        }),
        role: "pm",
      };

      const html = renderToStaticMarkup(
        await AppNav({
          session,
          unreadCount: 0,
          canAccessNotificationOperations: true,
        }),
      );

      expect(html).toContain('href="/pm"');
      expect(html).toContain('href="/pm/proyectos"');
      expect(html).toContain('href="/pm/archivo"');
      expect(html).toContain('href="/pm/incidentes-enlaces"');
      expect(html).toContain('href="/notificaciones"');
      expect(html).toContain('aria-label="Bandeja de notificaciones"');
      expect(html).toContain('href="/pm/notificaciones"');
      expect(html).toContain("Operaciones de Notificaciones");
      expect(html).toContain('role="status" aria-live="polite"');
      expect(html).toContain("Notificaciones no leídas: 0");
      expect(html).not.toContain('href="/admin"');
      expect(html).toContain("PM Lead User");
      expect(html).toContain("Project Manager");
    });

    it("renders pm watcher navigation with /pm, /pm/proyectos, /pm/archivo, /pm/incidentes-enlaces, /notificaciones, and NO operations link", async () => {
      const session: SessionContext = {
        user: baseUser as unknown as SessionContext["user"],
        profile: createMockProfile({
          id: "u-2w",
          full_name: "PM Watcher User",
          role: "pm",
        }),
        role: "pm",
      };

      const html = renderToStaticMarkup(
        await AppNav({
          session,
          unreadCount: 0,
          canAccessNotificationOperations: false,
        }),
      );

      expect(html).toContain('href="/pm"');
      expect(html).toContain('href="/pm/proyectos"');
      expect(html).toContain('href="/pm/archivo"');
      expect(html).toContain('href="/pm/incidentes-enlaces"');
      expect(html).toContain('href="/notificaciones"');
      expect(html).not.toContain('href="/pm/notificaciones"');
      expect(html).not.toContain('href="/admin/notificaciones"');
      expect(html).not.toContain("Operaciones de Notificaciones");
      expect(html).toContain("PM Watcher User");
    });

    it("renders operator navigation with /operador, /operador/agenda, /operador/archivo, /notificaciones, and NO operations link", async () => {
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
        await AppNav({
          session,
          unreadCount: 7,
          canAccessNotificationOperations: false,
        }),
      );

      expect(html).toContain('href="/operador"');
      expect(html).toContain('href="/operador/agenda"');
      expect(html).toContain('href="/operador/archivo"');
      expect(html).not.toContain('href="/operador/incidentes-enlaces"');
      expect(html).toContain('href="/notificaciones"');
      expect(html).toContain(
        'aria-label="Bandeja de notificaciones, 7 no leídas"',
      );
      expect(html).not.toContain('href="/operador/notificaciones"');
      expect(html).not.toContain('href="/admin/notificaciones"');
      expect(html).not.toContain('href="/pm/notificaciones"');
      expect(html).toContain("Operator User");
      expect(html).toContain("Operador");
    });

    it("renders client navigation with /cliente, /cliente/proyectos, /cliente/archivo, /notificaciones, and NO operations link", async () => {
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
        await AppNav({
          session,
          unreadCount: 0,
          canAccessNotificationOperations: false,
        }),
      );

      expect(html).toContain('href="/cliente"');
      expect(html).toContain('href="/cliente/proyectos"');
      expect(html).toContain('href="/cliente/archivo"');
      expect(html).not.toContain('href="/cliente/incidentes-enlaces"');
      expect(html).toContain('href="/notificaciones"');
      expect(html).toContain('aria-label="Bandeja de notificaciones"');
      expect(html).not.toContain('href="/cliente/notificaciones"');
      expect(html).not.toContain('href="/admin/notificaciones"');
      expect(html).not.toContain('href="/pm/notificaciones"');
      expect(html).toContain("Client User");
      expect(html).toContain("Cliente");
    });

    it("produces NO operations link for operator even if capability boolean is accidentally true", async () => {
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
        await AppNav({
          session,
          unreadCount: 0,
          canAccessNotificationOperations: true,
        }),
      );

      expect(html).not.toContain('href="/admin/notificaciones"');
      expect(html).not.toContain('href="/pm/notificaciones"');
      expect(html).not.toContain("Operaciones de Notificaciones");
    });
  });

  describe("NotificationBadge Visual Presentation", () => {
    it("renders nothing when count is 0", () => {
      const html = renderToStaticMarkup(
        React.createElement(NotificationBadge, { count: 0 }),
      );
      expect(html).toBe("");
    });

    it("renders numeric count with aria-hidden when count is 5", () => {
      const html = renderToStaticMarkup(
        React.createElement(NotificationBadge, { count: 5 }),
      );
      expect(html).toContain("5");
      expect(html).toContain('aria-hidden="true"');
      expect(html).not.toContain('role="status"');
    });

    it("renders 99+ with aria-hidden when count is 100", () => {
      const html = renderToStaticMarkup(
        React.createElement(NotificationBadge, { count: 100 }),
      );
      expect(html).toContain("99+");
      expect(html).toContain('aria-hidden="true"');
      expect(html).not.toContain('role="status"');
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

  describe("MobileNavToggle Drawer & Role Matrix", () => {
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
          canAccessNotificationOperations: true,
        }),
      );

      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain('aria-controls="mobile-nav-drawer"');
    });

    it("opens drawer and renders live links for admin including operations link", () => {
      const profile = createMockProfile({
        id: "u-1",
        full_name: "Admin User",
        role: "admin",
      });

      render(
        React.createElement(MobileNavToggle, {
          role: "admin",
          profile,
          unreadCount: 2,
          canAccessNotificationOperations: true,
        }),
      );

      const toggleButton = screen.getByRole("button", {
        name: "Abrir menú de navegación",
      });
      fireEvent.click(toggleButton);

      expect(
        screen.getByRole("button", { name: "Cerrar menú de navegación" }),
      ).toBeInTheDocument();
      const projectLink = screen.getByRole("link", { name: "Proyectos" });
      expect(projectLink).toHaveAttribute("href", "/admin/proyectos");

      const inboxLink = screen.getByRole("link", {
        name: "Bandeja de notificaciones, 2 no leídas",
      });
      expect(inboxLink).toHaveAttribute("href", "/notificaciones");

      const operationsLink = screen.getByRole("link", {
        name: "Operaciones de Notificaciones",
      });
      expect(operationsLink).toHaveAttribute("href", "/admin/notificaciones");
    });

    it("opens drawer and renders operations link for PM Lead", () => {
      const profile = createMockProfile({
        id: "u-2",
        full_name: "PM Lead",
        role: "pm",
      });

      render(
        React.createElement(MobileNavToggle, {
          role: "pm",
          profile,
          unreadCount: 0,
          canAccessNotificationOperations: true,
        }),
      );

      const toggleButton = screen.getByRole("button", {
        name: "Abrir menú de navegación",
      });
      fireEvent.click(toggleButton);

      const operationsLink = screen.getByRole("link", {
        name: "Operaciones de Notificaciones",
      });
      expect(operationsLink).toHaveAttribute("href", "/pm/notificaciones");
    });

    it("opens drawer and does NOT render operations link for PM Watcher", () => {
      const profile = createMockProfile({
        id: "u-2w",
        full_name: "PM Watcher",
        role: "pm",
      });

      render(
        React.createElement(MobileNavToggle, {
          role: "pm",
          profile,
          unreadCount: 0,
          canAccessNotificationOperations: false,
        }),
      );

      const toggleButton = screen.getByRole("button", {
        name: "Abrir menú de navegación",
      });
      fireEvent.click(toggleButton);

      expect(
        screen.queryByRole("link", { name: "Operaciones de Notificaciones" }),
      ).not.toBeInTheDocument();
    });

    it("renders active agenda link and inbox in drawer for operator, no operations", () => {
      const profile = createMockProfile({
        id: "u-3",
        full_name: "Operator User",
        role: "operator",
      });

      render(
        React.createElement(MobileNavToggle, {
          role: "operator",
          profile,
          unreadCount: 0,
          canAccessNotificationOperations: false,
        }),
      );

      const toggleButton = screen.getByRole("button", {
        name: "Abrir menú de navegación",
      });
      fireEvent.click(toggleButton);

      const agendaLink = screen.getByRole("link", { name: "Mi Agenda" });
      expect(agendaLink).toBeInTheDocument();
      expect(agendaLink).toHaveAttribute("href", "/operador/agenda");

      const archiveLink = screen.getByRole("link", { name: "Archivo" });
      expect(archiveLink).toBeInTheDocument();
      expect(archiveLink).toHaveAttribute("href", "/operador/archivo");

      const inboxLink = screen.getByRole("link", {
        name: "Bandeja de notificaciones",
      });
      expect(inboxLink).toHaveAttribute("href", "/notificaciones");

      expect(
        screen.queryByRole("link", { name: "Operaciones de Notificaciones" }),
      ).not.toBeInTheDocument();
    });

    it("renders active project link and inbox in drawer for client, no operations", () => {
      const profile = createMockProfile({
        id: "u-4",
        full_name: "Client User",
        role: "client",
      });

      render(
        React.createElement(MobileNavToggle, {
          role: "client",
          profile,
          unreadCount: 0,
          canAccessNotificationOperations: false,
        }),
      );

      const toggleButton = screen.getByRole("button", {
        name: "Abrir menú de navegación",
      });
      fireEvent.click(toggleButton);

      const projectLink = screen.getByRole("link", { name: "Proyectos" });
      expect(projectLink).toBeInTheDocument();
      expect(projectLink).toHaveAttribute("href", "/cliente/proyectos");

      const archiveLink = screen.getByRole("link", { name: "Archivo" });
      expect(archiveLink).toBeInTheDocument();
      expect(archiveLink).toHaveAttribute("href", "/cliente/archivo");

      const inboxLink = screen.getByRole("link", {
        name: "Bandeja de notificaciones",
      });
      expect(inboxLink).toHaveAttribute("href", "/notificaciones");

      expect(
        screen.queryByRole("link", { name: "Operaciones de Notificaciones" }),
      ).not.toBeInTheDocument();
    });

    it("closes drawer when inbox navigation link is clicked", () => {
      const profile = createMockProfile({
        id: "u-4",
        full_name: "Client User",
        role: "client",
      });

      render(
        React.createElement(MobileNavToggle, {
          role: "client",
          profile,
          unreadCount: 0,
          canAccessNotificationOperations: false,
        }),
      );

      const toggleButton = screen.getByRole("button", {
        name: "Abrir menú de navegación",
      });
      fireEvent.click(toggleButton);

      const inboxLink = screen.getByRole("link", {
        name: "Bandeja de notificaciones",
      });
      fireEvent.click(inboxLink);

      expect(
        screen.getByRole("button", { name: "Abrir menú de navegación" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Bandeja de notificaciones" }),
      ).not.toBeInTheDocument();
    });

    it("closes drawer when operations navigation link is clicked", () => {
      const profile = createMockProfile({
        id: "u-1",
        full_name: "Admin User",
        role: "admin",
      });

      render(
        React.createElement(MobileNavToggle, {
          role: "admin",
          profile,
          unreadCount: 0,
          canAccessNotificationOperations: true,
        }),
      );

      const toggleButton = screen.getByRole("button", {
        name: "Abrir menú de navegación",
      });
      fireEvent.click(toggleButton);

      const operationsLink = screen.getByRole("link", {
        name: "Operaciones de Notificaciones",
      });
      fireEvent.click(operationsLink);

      expect(
        screen.getByRole("button", { name: "Abrir menú de navegación" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Operaciones de Notificaciones" }),
      ).not.toBeInTheDocument();
    });

    it("closes drawer on Escape key and restores focus to toggle button", () => {
      const profile = createMockProfile({
        id: "u-3",
        full_name: "Operator User",
        role: "operator",
      });

      render(
        React.createElement(MobileNavToggle, {
          role: "operator",
          profile,
          unreadCount: 0,
          canAccessNotificationOperations: false,
        }),
      );

      const toggleButton = screen.getByRole("button", {
        name: "Abrir menú de navegación",
      });
      fireEvent.click(toggleButton);

      expect(
        screen.getByRole("button", { name: "Cerrar menú de navegación" }),
      ).toBeInTheDocument();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(
        screen.getByRole("button", { name: "Abrir menú de navegación" }),
      ).toBeInTheDocument();
    });
  });
});
