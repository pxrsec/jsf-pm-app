// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import esCatalog from "../../messages/es-MX.json";

vi.mock("server-only", () => ({}));

let currentPathname = "/";

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
  usePathname: () => currentPathname,
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
    return (key: string, params?: Record<string, string | number>) => {
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
            str = str.replace(`{${k}}`, String(v));
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
    return (key: string, params?: Record<string, string | number>) => {
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
            str = str.replace(`{${k}}`, String(v));
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
import {
  DesktopNavDrawer,
  type DesktopNavDrawerProps,
} from "@/components/shared/app-nav/_components/desktop-nav-drawer";
import { DesktopNavigationShell } from "@/components/shared/app-nav/_components/desktop-navigation-shell";
import { MobileNavToggle } from "@/components/shared/app-nav/_components/mobile-nav-toggle";
import {
  buildNavigationModel,
  buildMobileQuickAccessItems,
} from "@/components/shared/app-nav/navigation-model";
import type { SessionContext, Profile, AppRole } from "@/lib/auth/session";

function getSpanishTranslation(namespace: string) {
  return (key: string, params?: Record<string, string | number>) => {
    const fullPath = `${namespace}.${key}`;
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
          str = str.replace(`{${k}}`, String(v));
        }
        return str;
      }
      return val;
    }
    return fullPath;
  };
}

function createTestItems(
  role: AppRole,
  unreadCount = 0,
  canAccessNotificationOperations = false,
) {
  return buildNavigationModel({
    role,
    unreadCount,
    canAccessNotificationOperations,
    t: getSpanishTranslation("shell.nav"),
  });
}

function createTestQuickAccessItems(
  items: ReturnType<typeof createTestItems>,
  role: AppRole,
) {
  return buildMobileQuickAccessItems({ items, role });
}

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
    currentPathname = "/";
  });

  afterEach(() => {
    cleanup();
  });

  const baseUser = { id: "u-1", email: "user@jsf.internal" };

  async function renderAppNavInShell(props: {
    session: SessionContext;
    unreadCount: number;
    canAccessNotificationOperations: boolean;
  }) {
    return renderToStaticMarkup(
      React.createElement(DesktopNavigationShell, null, await AppNav(props)),
    );
  }

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

      const html = await renderAppNavInShell({
        session,
        unreadCount: 3,
        canAccessNotificationOperations: true,
      });

      // Verify header has brand and no inline route link <nav>
      expect(html).toContain('href="/admin"');
      expect(html).toContain('href="/admin/proyectos"');
      expect(html).toContain('href="/admin/archivo"');
      expect(html).toContain('href="/admin/incidentes-enlaces"');
      expect(html).toContain('href="/admin/metricas"');
      expect(html).toContain('href="/admin/operaciones"');
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

    it("renders pm lead navigation with /pm, /pm/proyectos, /pm/archivo, /pm/incidentes-enlaces, /pm/metricas, /notificaciones, and /pm/notificaciones", async () => {
      const session: SessionContext = {
        user: baseUser as unknown as SessionContext["user"],
        profile: createMockProfile({
          id: "u-2",
          full_name: "PM Lead User",
          role: "pm",
        }),
        role: "pm",
      };

      const html = await renderAppNavInShell({
        session,
        unreadCount: 0,
        canAccessNotificationOperations: true,
      });

      expect(html).toContain('href="/pm"');
      expect(html).toContain('href="/pm/proyectos"');
      expect(html).toContain('href="/pm/archivo"');
      expect(html).toContain('href="/pm/incidentes-enlaces"');
      expect(html).toContain('href="/pm/metricas"');
      expect(html).not.toContain('href="/admin/operaciones"');
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

    it("renders pm watcher navigation with /pm, /pm/proyectos, /pm/archivo, /pm/incidentes-enlaces, /pm/metricas, /notificaciones, and NO operations link", async () => {
      const session: SessionContext = {
        user: baseUser as unknown as SessionContext["user"],
        profile: createMockProfile({
          id: "u-2w",
          full_name: "PM Watcher User",
          role: "pm",
        }),
        role: "pm",
      };

      const html = await renderAppNavInShell({
        session,
        unreadCount: 0,
        canAccessNotificationOperations: false,
      });

      expect(html).toContain('href="/pm"');
      expect(html).toContain('href="/pm/proyectos"');
      expect(html).toContain('href="/pm/archivo"');
      expect(html).toContain('href="/pm/incidentes-enlaces"');
      expect(html).toContain('href="/pm/metricas"');
      expect(html).toContain('href="/notificaciones"');
      expect(html).not.toContain('href="/pm/notificaciones"');
      expect(html).not.toContain('href="/admin/notificaciones"');
      expect(html).not.toContain('href="/admin/operaciones"');
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

      const html = await renderAppNavInShell({
        session,
        unreadCount: 7,
        canAccessNotificationOperations: false,
      });

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

      const html = await renderAppNavInShell({
        session,
        unreadCount: 0,
        canAccessNotificationOperations: false,
      });

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

      const html = await renderAppNavInShell({
        session,
        unreadCount: 0,
        canAccessNotificationOperations: true,
      });

      expect(html).not.toContain('href="/admin/notificaciones"');
      expect(html).not.toContain('href="/pm/notificaciones"');
      expect(html).not.toContain("Operaciones de Notificaciones");
    });
  });

  function renderDesktopDrawerInShell(props: DesktopNavDrawerProps) {
    return render(
      React.createElement(
        DesktopNavigationShell,
        null,
        React.createElement(DesktopNavDrawer, props),
        React.createElement("main", {
          id: "main-content",
          className:
            "box-border w-full min-w-0 flex-1 md:pl-[var(--desktop-navigation-width)]",
        }),
      ),
    );
  }

  describe("DesktopNavDrawer Component & Interactions", () => {
    it("renders expanded by default with all authorized Admin items in order, identity, and sign-out", () => {
      const profile = createMockProfile({
        id: "u-1",
        full_name: "Admin User",
        role: "admin",
      });
      const items = createTestItems("admin", 3, true);

      renderDesktopDrawerInShell({
        items,
        profile,
        roleLabel: "Administrador",
        navAriaLabel: "Navegación principal",
        collapseNavigationLabel: "Contraer navegación",
        expandNavigationLabel: "Expandir navegación",
        signOutLabel: "Cerrar sesión",
        unreadCountAnnouncement: "Notificaciones no leídas: 3",
      });

      const shell = document.querySelector(
        '[data-slot="desktop-navigation-shell"]',
      ) as HTMLElement;
      expect(shell).not.toBeNull();
      expect(shell.style.getPropertyValue("--desktop-navigation-width")).toBe(
        "16rem",
      );

      const nav = screen.getByRole("navigation", {
        name: "Navegación principal",
      });
      expect(nav).toHaveClass("w-64");

      const toggleButton = screen.getByRole("button", {
        name: "Contraer navegación",
      });
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
      expect(toggleButton).toHaveAttribute(
        "aria-controls",
        "desktop-nav-links",
      );

      expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute(
        "href",
        "/admin",
      );
      expect(screen.getByRole("link", { name: "Proyectos" })).toHaveAttribute(
        "href",
        "/admin/proyectos",
      );
      expect(screen.getByRole("link", { name: "Calendario" })).toHaveAttribute(
        "href",
        "/calendario",
      );
      expect(screen.getByRole("link", { name: "Archivo" })).toHaveAttribute(
        "href",
        "/admin/archivo",
      );
      expect(
        screen.getByRole("link", { name: "Incidentes de Enlaces" }),
      ).toHaveAttribute("href", "/admin/incidentes-enlaces");
      expect(screen.getByRole("link", { name: "Métricas" })).toHaveAttribute(
        "href",
        "/admin/metricas",
      );
      expect(screen.getByRole("link", { name: "Operaciones" })).toHaveAttribute(
        "href",
        "/admin/operaciones",
      );
      expect(
        screen.getByRole("link", {
          name: "Bandeja de notificaciones, 3 no leídas",
        }),
      ).toHaveAttribute("href", "/notificaciones");
      expect(
        screen.getByRole("link", { name: "Operaciones de Notificaciones" }),
      ).toHaveAttribute("href", "/admin/notificaciones");

      expect(screen.getByText("Admin User")).toBeInTheDocument();
      expect(screen.getByText("Administrador")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Cerrar sesión" }),
      ).toBeInTheDocument();
    });

    it("toggles collapse/expand state and updates custom property", () => {
      const profile = createMockProfile({
        id: "u-1",
        full_name: "Admin User",
        role: "admin",
      });
      const items = createTestItems("admin", 0, true);

      renderDesktopDrawerInShell({
        items,
        profile,
        roleLabel: "Administrador",
        navAriaLabel: "Navegación principal",
        collapseNavigationLabel: "Contraer navegación",
        expandNavigationLabel: "Expandir navegación",
        signOutLabel: "Cerrar sesión",
        unreadCountAnnouncement: "Notificaciones no leídas: 0",
      });

      const shell = document.querySelector(
        '[data-slot="desktop-navigation-shell"]',
      ) as HTMLElement;
      const nav = screen.getByRole("navigation", {
        name: "Navegación principal",
      });
      const toggleButton = screen.getByRole("button", {
        name: "Contraer navegación",
      });

      expect(shell.style.getPropertyValue("--desktop-navigation-width")).toBe(
        "16rem",
      );
      expect(nav).toHaveClass("w-64");

      // Click to collapse
      fireEvent.click(toggleButton);

      expect(shell.style.getPropertyValue("--desktop-navigation-width")).toBe(
        "4rem",
      );
      expect(nav).toHaveClass("w-16");
      expect(
        screen.getByRole("button", { name: "Expandir navegación" }),
      ).toHaveAttribute("aria-expanded", "false");

      // Click to expand again
      fireEvent.click(
        screen.getByRole("button", { name: "Expandir navegación" }),
      );

      expect(shell.style.getPropertyValue("--desktop-navigation-width")).toBe(
        "16rem",
      );
      expect(nav).toHaveClass("w-64");
      expect(
        screen.getByRole("button", { name: "Contraer navegación" }),
      ).toHaveAttribute("aria-expanded", "true");
    });

    it("renders collapsed notifications item with visible red rounded counter when unread count > 0", () => {
      const profile = createMockProfile({
        id: "u-1",
        full_name: "Admin User",
        role: "admin",
      });
      const items = createTestItems("admin", 3, true);

      renderDesktopDrawerInShell({
        items,
        profile,
        roleLabel: "Administrador",
        navAriaLabel: "Navegación principal",
        collapseNavigationLabel: "Contraer navegación",
        expandNavigationLabel: "Expandir navegación",
        signOutLabel: "Cerrar sesión",
        unreadCountAnnouncement: "Notificaciones no leídas: 3",
      });

      // Collapse drawer
      fireEvent.click(
        screen.getByRole("button", { name: "Contraer navegación" }),
      );

      const notifsLink = screen.getByRole("link", {
        name: "Bandeja de notificaciones, 3 no leídas",
      });
      expect(notifsLink).toBeInTheDocument();

      const badge = notifsLink.querySelector("span[aria-hidden='true']");
      expect(badge).not.toBeNull();
      expect(badge).toHaveTextContent("3");
      expect(badge).toHaveClass("bg-destructive");
      expect(badge).toHaveClass("rounded-full");
      expect(badge).toHaveClass("-right-0.5");
      expect(badge).toHaveClass("-top-0.5");
      expect(badge).toHaveClass("pointer-events-none");
    });

    it("renders collapsed notifications item without visual badge when unread count is 0", () => {
      const profile = createMockProfile({
        id: "u-1",
        full_name: "Admin User",
        role: "admin",
      });
      const items = createTestItems("admin", 0, true);

      renderDesktopDrawerInShell({
        items,
        profile,
        roleLabel: "Administrador",
        navAriaLabel: "Navegación principal",
        collapseNavigationLabel: "Contraer navegación",
        expandNavigationLabel: "Expandir navegación",
        signOutLabel: "Cerrar sesión",
        unreadCountAnnouncement: "Notificaciones no leídas: 0",
      });

      // Collapse drawer
      fireEvent.click(
        screen.getByRole("button", { name: "Contraer navegación" }),
      );

      const notifsLink = screen.getByRole("link", {
        name: "Bandeja de notificaciones",
      });
      expect(notifsLink).toBeInTheDocument();

      const badge = notifsLink.querySelector("span[aria-hidden='true']");
      expect(badge).toBeNull();
    });

    it("preserves localized accessible names on links and sign-out in collapsed mode", () => {
      const profile = createMockProfile({
        id: "u-1",
        full_name: "Admin User",
        role: "admin",
      });
      const items = createTestItems("admin", 2, true);

      renderDesktopDrawerInShell({
        items,
        profile,
        roleLabel: "Administrador",
        navAriaLabel: "Navegación principal",
        collapseNavigationLabel: "Contraer navegación",
        expandNavigationLabel: "Expandir navegación",
        signOutLabel: "Cerrar sesión",
        unreadCountAnnouncement: "Notificaciones no leídas: 2",
      });

      // Collapse drawer
      fireEvent.click(
        screen.getByRole("button", { name: "Contraer navegación" }),
      );

      // Verify links retain accessible names
      expect(screen.getByRole("link", { name: "Inicio" })).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Proyectos" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", {
          name: "Bandeja de notificaciones, 2 no leídas",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Cerrar sesión" }),
      ).toBeInTheDocument();
    });

    it("evaluates exact match for home route and descendant match for non-home routes", () => {
      const profile = createMockProfile({
        id: "u-1",
        full_name: "Admin User",
        role: "admin",
      });
      const items = createTestItems("admin", 0, true);

      // 1. Exact match on Home
      currentPathname = "/admin";
      const { unmount: unmount1 } = renderDesktopDrawerInShell({
        items,
        profile,
        roleLabel: "Administrador",
        navAriaLabel: "Navegación principal",
        collapseNavigationLabel: "Contraer navegación",
        expandNavigationLabel: "Expandir navegación",
        signOutLabel: "Cerrar sesión",
        unreadCountAnnouncement: "Notificaciones no leídas: 0",
      });

      const homeLink1 = screen.getByRole("link", { name: "Inicio" });
      const projectsLink1 = screen.getByRole("link", { name: "Proyectos" });
      expect(homeLink1).toHaveAttribute("aria-current", "page");
      expect(projectsLink1).not.toHaveAttribute("aria-current");
      unmount1();

      // 2. Descendant route of projects: /admin/proyectos/p-123
      currentPathname = "/admin/proyectos/p-123";
      const { unmount: unmount2 } = renderDesktopDrawerInShell({
        items,
        profile,
        roleLabel: "Administrador",
        navAriaLabel: "Navegación principal",
        collapseNavigationLabel: "Contraer navegación",
        expandNavigationLabel: "Expandir navegación",
        signOutLabel: "Cerrar sesión",
        unreadCountAnnouncement: "Notificaciones no leídas: 0",
      });

      const homeLink2 = screen.getByRole("link", { name: "Inicio" });
      const projectsLink2 = screen.getByRole("link", { name: "Proyectos" });
      expect(homeLink2).not.toHaveAttribute("aria-current");
      expect(projectsLink2).toHaveAttribute("aria-current", "page");
      unmount2();

      // 3. Non-home notifications route
      currentPathname = "/notificaciones";
      renderDesktopDrawerInShell({
        items,
        profile,
        roleLabel: "Administrador",
        navAriaLabel: "Navegación principal",
        collapseNavigationLabel: "Contraer navegación",
        expandNavigationLabel: "Expandir navegación",
        signOutLabel: "Cerrar sesión",
        unreadCountAnnouncement: "Notificaciones no leídas: 0",
      });

      const notifsLink3 = screen.getByRole("link", {
        name: "Bandeja de notificaciones",
      });
      const homeLink3 = screen.getByRole("link", { name: "Inicio" });
      expect(notifsLink3).toHaveAttribute("aria-current", "page");
      expect(homeLink3).not.toHaveAttribute("aria-current");
    });

    it("throws error when DesktopNavDrawer is rendered outside DesktopNavigationShell", () => {
      const profile = createMockProfile({
        id: "u-1",
        full_name: "Admin User",
        role: "admin",
      });
      const items = createTestItems("admin", 0, true);

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        render(
          React.createElement(DesktopNavDrawer, {
            items,
            profile,
            roleLabel: "Administrador",
            navAriaLabel: "Navegación principal",
            collapseNavigationLabel: "Contraer navegación",
            expandNavigationLabel: "Expandir navegación",
            signOutLabel: "Cerrar sesión",
            unreadCountAnnouncement: "Notificaciones no leídas: 0",
          }),
        );
      }).toThrow(
        "useDesktopNavigationLayout must be used within DesktopNavigationShell",
      );

      consoleSpy.mockRestore();
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

    it("merges custom positional className with base classes via cn", () => {
      const html = renderToStaticMarkup(
        React.createElement(NotificationBadge, {
          count: 5,
          className: "pointer-events-none absolute -right-0.5 -top-0.5",
        }),
      );
      expect(html).toContain("bg-destructive");
      expect(html).toContain("rounded-full");
      expect(html).toContain("pointer-events-none");
      expect(html).toContain("-right-0.5");
      expect(html).toContain("-top-0.5");
      expect(html).toContain("5");
    });
  });

  describe("SignOutButton", () => {
    it("renders accessible sign-out button with correct label", () => {
      const html = renderToStaticMarkup(React.createElement(SignOutButton));
      expect(html).toContain("Cerrar sesión");
      expect(html).toContain('aria-label="Cerrar sesión"');
      expect(html).toContain('type="button"');
    });

    it("renders icon-only sign-out button with accessible aria-label", () => {
      const html = renderToStaticMarkup(
        React.createElement(SignOutButton, { iconOnly: true }),
      );
      expect(html).toContain('aria-label="Cerrar sesión"');
      expect(html).toContain('type="button"');
      expect(html).toContain('aria-hidden="true"');
    });
  });

  describe("buildMobileQuickAccessItems Model Invariant", () => {
    it("selects exact 3 quick items in order for Admin (Home, Projects, Operations)", () => {
      const items = createTestItems("admin", 0, true);
      const quickItems = createTestQuickAccessItems(items, "admin");

      expect(quickItems).toHaveLength(3);
      expect(quickItems.map((i) => i.key)).toEqual([
        "home",
        "projects",
        "operations",
      ]);
      expect(quickItems.map((i) => i.href)).toEqual([
        "/admin",
        "/admin/proyectos",
        "/admin/operaciones",
      ]);
    });

    it("selects exact 3 quick items in order for PM (Home, Projects, Calendar)", () => {
      const itemsLead = createTestItems("pm", 0, true);
      const quickLead = createTestQuickAccessItems(itemsLead, "pm");
      expect(quickLead.map((i) => i.key)).toEqual([
        "home",
        "projects",
        "calendar",
      ]);
      expect(quickLead.map((i) => i.href)).toEqual([
        "/pm",
        "/pm/proyectos",
        "/calendario",
      ]);

      const itemsWatcher = createTestItems("pm", 0, false);
      const quickWatcher = createTestQuickAccessItems(itemsWatcher, "pm");
      expect(quickWatcher.map((i) => i.key)).toEqual([
        "home",
        "projects",
        "calendar",
      ]);
      expect(quickWatcher.map((i) => i.href)).toEqual([
        "/pm",
        "/pm/proyectos",
        "/calendario",
      ]);
    });

    it("selects exact 3 quick items in order for Operator (Home, My Agenda, Calendar)", () => {
      const items = createTestItems("operator", 0, false);
      const quickItems = createTestQuickAccessItems(items, "operator");

      expect(quickItems).toHaveLength(3);
      expect(quickItems.map((i) => i.key)).toEqual([
        "home",
        "agenda",
        "calendar",
      ]);
      expect(quickItems.map((i) => i.href)).toEqual([
        "/operador",
        "/operador/agenda",
        "/calendario",
      ]);
    });

    it("selects exact 3 quick items in order for Client (Home, Projects, Calendar)", () => {
      const items = createTestItems("client", 0, false);
      const quickItems = createTestQuickAccessItems(items, "client");

      expect(quickItems).toHaveLength(3);
      expect(quickItems.map((i) => i.key)).toEqual([
        "home",
        "projects",
        "calendar",
      ]);
      expect(quickItems.map((i) => i.href)).toEqual([
        "/cliente",
        "/cliente/proyectos",
        "/calendario",
      ]);
    });

    it("throws deterministic invariant error if an expected role key is missing from supplied items", () => {
      const items = createTestItems("admin", 0, true);
      // Remove operations item
      const incompleteItems = items.filter((i) => i.key !== "operations");

      expect(() => {
        buildMobileQuickAccessItems({ items: incompleteItems, role: "admin" });
      }).toThrow(
        'Mobile quick-access invariant failed: missing authorized "operations" item for role "admin".',
      );
    });
  });

  describe("MobileNavToggle Persistent Bar & Full Menu", () => {
    it("renders persistent bottom quick-access bar with 4 links and 1 menu button in exact DOM order for Admin", () => {
      const profile = createMockProfile({
        id: "u-1",
        full_name: "Admin User",
        role: "admin",
      });
      const items = createTestItems("admin", 3, true);
      const quickAccessItems = createTestQuickAccessItems(items, "admin");

      render(
        React.createElement(MobileNavToggle, {
          items,
          quickAccessItems,
          role: "admin",
          profile,
        }),
      );

      const quickNav = screen.getByRole("navigation", {
        name: "Navegación de acceso rápido",
      });
      expect(quickNav).toBeInTheDocument();

      const links = within(quickNav).getAllByRole("link");
      expect(links).toHaveLength(4);

      expect(links[0]).toHaveAttribute("href", "/admin");
      expect(within(links[0]).getByText("Inicio")).toBeInTheDocument();

      expect(links[1]).toHaveAttribute("href", "/admin/proyectos");
      expect(within(links[1]).getByText("Proyectos")).toBeInTheDocument();

      expect(links[2]).toHaveAttribute("href", "/notificaciones");
      expect(links[2]).toHaveAttribute(
        "aria-label",
        "Bandeja de notificaciones, 3 no leídas",
      );
      expect(within(links[2]).getByText("Notificaciones")).toBeInTheDocument();

      expect(links[3]).toHaveAttribute("href", "/admin/operaciones");
      expect(within(links[3]).getByText("Operaciones")).toBeInTheDocument();

      const menuButton = within(quickNav).getByRole("button", {
        name: "Abrir menú de navegación",
      });
      expect(menuButton).toBeInTheDocument();
      expect(menuButton).toHaveAttribute("aria-expanded", "false");
      expect(menuButton).toHaveAttribute("aria-controls", "mobile-nav-drawer");
      expect(within(menuButton).getByText("Menú")).toBeInTheDocument();

      expect(
        screen.queryByRole("navigation", { name: "Toda la navegación" }),
      ).not.toBeInTheDocument();
    });

    it("renders persistent bottom quick-access bar for PM, Operator, and Client with their approved role destinations", () => {
      const profilePm = createMockProfile({ id: "u-2", role: "pm" });
      const itemsPm = createTestItems("pm", 0, true);
      const quickPm = createTestQuickAccessItems(itemsPm, "pm");

      const { unmount: unmountPm } = render(
        React.createElement(MobileNavToggle, {
          items: itemsPm,
          quickAccessItems: quickPm,
          role: "pm",
          profile: profilePm,
        }),
      );

      const quickNavPm = screen.getByRole("navigation", {
        name: "Navegación de acceso rápido",
      });
      const pmLinks = within(quickNavPm).getAllByRole("link");
      expect(pmLinks.map((l) => l.getAttribute("href"))).toEqual([
        "/pm",
        "/pm/proyectos",
        "/notificaciones",
        "/calendario",
      ]);
      unmountPm();

      const profileOp = createMockProfile({ id: "u-3", role: "operator" });
      const itemsOp = createTestItems("operator", 0, false);
      const quickOp = createTestQuickAccessItems(itemsOp, "operator");

      const { unmount: unmountOp } = render(
        React.createElement(MobileNavToggle, {
          items: itemsOp,
          quickAccessItems: quickOp,
          role: "operator",
          profile: profileOp,
        }),
      );

      const quickNavOp = screen.getByRole("navigation", {
        name: "Navegación de acceso rápido",
      });
      const opLinks = within(quickNavOp).getAllByRole("link");
      expect(opLinks.map((l) => l.getAttribute("href"))).toEqual([
        "/operador",
        "/operador/agenda",
        "/notificaciones",
        "/calendario",
      ]);
      unmountOp();

      const profileCl = createMockProfile({ id: "u-4", role: "client" });
      const itemsCl = createTestItems("client", 0, false);
      const quickCl = createTestQuickAccessItems(itemsCl, "client");

      render(
        React.createElement(MobileNavToggle, {
          items: itemsCl,
          quickAccessItems: quickCl,
          role: "client",
          profile: profileCl,
        }),
      );

      const quickNavCl = screen.getByRole("navigation", {
        name: "Navegación de acceso rápido",
      });
      const clLinks = within(quickNavCl).getAllByRole("link");
      expect(clLinks.map((l) => l.getAttribute("href"))).toEqual([
        "/cliente",
        "/cliente/proyectos",
        "/notificaciones",
        "/calendario",
      ]);
    });

    it("opens full menu drawer on Menu button click with identity, language/theme controls, complete authorized links, and sign-out", () => {
      const profile = createMockProfile({
        id: "u-1",
        full_name: "Admin User",
        role: "admin",
      });
      const items = createTestItems("admin", 2, true);
      const quickAccessItems = createTestQuickAccessItems(items, "admin");

      render(
        React.createElement(MobileNavToggle, {
          items,
          quickAccessItems,
          role: "admin",
          profile,
        }),
      );

      const quickNav = screen.getByRole("navigation", {
        name: "Navegación de acceso rápido",
      });
      const menuButton = within(quickNav).getByRole("button", {
        name: "Abrir menú de navegación",
      });

      fireEvent.click(menuButton);

      expect(menuButton).toHaveAttribute("aria-expanded", "true");
      expect(
        within(quickNav).getByRole("button", {
          name: "Cerrar menú de navegación",
        }),
      ).toBeInTheDocument();

      const fullMenu = screen.getByRole("navigation", {
        name: "Toda la navegación",
      });
      expect(fullMenu).toBeInTheDocument();
      expect(fullMenu).toHaveAttribute("id", "mobile-nav-drawer");

      expect(within(fullMenu).getByText("Admin User")).toBeInTheDocument();
      expect(within(fullMenu).getByText("Administrador")).toBeInTheDocument();
      expect(
        within(fullMenu).getByTestId("language-switcher"),
      ).toBeInTheDocument();
      expect(within(fullMenu).getByTestId("theme-toggle")).toBeInTheDocument();

      const fullLinks = within(fullMenu).getAllByRole("link");
      expect(fullLinks.map((l) => l.getAttribute("href"))).toEqual([
        "/admin",
        "/admin/proyectos",
        "/calendario",
        "/notificaciones",
        "/admin/clientes",
        "/admin/metricas",
        "/admin/archivo",
        "/admin/papelera",
        "/admin/acceso",
        "/admin/incidentes-enlaces",
        "/admin/operaciones",
        "/admin/notificaciones",
        "/cuenta",
      ]);

      expect(
        within(fullMenu).getByRole("button", { name: "Cerrar sesión" }),
      ).toBeInTheDocument();

      expect(
        within(fullMenu).getByText("Notificaciones no leídas: 2"),
      ).toBeInTheDocument();
    });

    it("closes full menu when any bottom quick link or Notifications is clicked", () => {
      const profile = createMockProfile({
        id: "u-1",
        full_name: "Admin User",
        role: "admin",
      });
      const items = createTestItems("admin", 2, true);
      const quickAccessItems = createTestQuickAccessItems(items, "admin");

      render(
        React.createElement(MobileNavToggle, {
          items,
          quickAccessItems,
          role: "admin",
          profile,
        }),
      );

      const quickNav = screen.getByRole("navigation", {
        name: "Navegación de acceso rápido",
      });
      const menuButton = within(quickNav).getByRole("button", {
        name: "Abrir menú de navegación",
      });

      // 1. Click bottom quick link
      fireEvent.click(menuButton);
      expect(
        screen.getByRole("navigation", { name: "Toda la navegación" }),
      ).toBeInTheDocument();

      const quickProjects = within(quickNav).getByRole("link", {
        name: "Proyectos",
      });
      fireEvent.click(quickProjects);

      expect(
        screen.queryByRole("navigation", { name: "Toda la navegación" }),
      ).not.toBeInTheDocument();
      expect(menuButton).toHaveAttribute("aria-expanded", "false");

      // 2. Click bottom notifications link
      fireEvent.click(menuButton);
      expect(
        screen.getByRole("navigation", { name: "Toda la navegación" }),
      ).toBeInTheDocument();

      const quickNotifs = within(quickNav).getByRole("link", {
        name: "Bandeja de notificaciones, 2 no leídas",
      });
      fireEvent.click(quickNotifs);

      expect(
        screen.queryByRole("navigation", { name: "Toda la navegación" }),
      ).not.toBeInTheDocument();
      expect(menuButton).toHaveAttribute("aria-expanded", "false");
    });

    it("closes full menu when a link inside the full menu is clicked", () => {
      const profile = createMockProfile({
        id: "u-1",
        full_name: "Admin User",
        role: "admin",
      });
      const items = createTestItems("admin", 0, true);
      const quickAccessItems = createTestQuickAccessItems(items, "admin");

      render(
        React.createElement(MobileNavToggle, {
          items,
          quickAccessItems,
          role: "admin",
          profile,
        }),
      );

      const quickNav = screen.getByRole("navigation", {
        name: "Navegación de acceso rápido",
      });
      const menuButton = within(quickNav).getByRole("button", {
        name: "Abrir menú de navegación",
      });

      fireEvent.click(menuButton);
      const fullMenu = screen.getByRole("navigation", {
        name: "Toda la navegación",
      });

      const archiveLink = within(fullMenu).getByRole("link", {
        name: "Archivo",
      });
      fireEvent.click(archiveLink);

      expect(
        screen.queryByRole("navigation", { name: "Toda la navegación" }),
      ).not.toBeInTheDocument();
      expect(menuButton).toHaveAttribute("aria-expanded", "false");
    });

    it("closes full menu on Escape key and restores actual focus to Menu button", () => {
      const profile = createMockProfile({
        id: "u-3",
        full_name: "Operator User",
        role: "operator",
      });
      const items = createTestItems("operator", 0, false);
      const quickAccessItems = createTestQuickAccessItems(items, "operator");

      render(
        React.createElement(MobileNavToggle, {
          items,
          quickAccessItems,
          role: "operator",
          profile,
        }),
      );

      const quickNav = screen.getByRole("navigation", {
        name: "Navegación de acceso rápido",
      });
      const menuButton = within(quickNav).getByRole("button", {
        name: "Abrir menú de navegación",
      });

      fireEvent.click(menuButton);
      expect(
        screen.getByRole("navigation", { name: "Toda la navegación" }),
      ).toBeInTheDocument();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(
        screen.queryByRole("navigation", { name: "Toda la navegación" }),
      ).not.toBeInTheDocument();
      expect(menuButton).toHaveFocus();
    });

    it("handles notification count formatting (0 -> hidden badge, 5 -> numerical badge, 100 -> 99+)", () => {
      const profile = createMockProfile({ role: "admin" });

      // Count 0
      const items0 = createTestItems("admin", 0, true);
      const quick0 = createTestQuickAccessItems(items0, "admin");
      const { unmount: unmount0 } = render(
        React.createElement(MobileNavToggle, {
          items: items0,
          quickAccessItems: quick0,
          role: "admin",
          profile,
        }),
      );

      const quickNav0 = screen.getByRole("navigation", {
        name: "Navegación de acceso rápido",
      });
      const notifsLink0 = within(quickNav0).getByRole("link", {
        name: "Bandeja de notificaciones",
      });
      expect(notifsLink0.querySelector("span[aria-hidden='true']")).toBeNull();
      unmount0();

      // Count 5
      const items5 = createTestItems("admin", 5, true);
      const quick5 = createTestQuickAccessItems(items5, "admin");
      const { unmount: unmount5 } = render(
        React.createElement(MobileNavToggle, {
          items: items5,
          quickAccessItems: quick5,
          role: "admin",
          profile,
        }),
      );

      const quickNav5 = screen.getByRole("navigation", {
        name: "Navegación de acceso rápido",
      });
      const notifsLink5 = within(quickNav5).getByRole("link", {
        name: "Bandeja de notificaciones, 5 no leídas",
      });
      const badge5 = notifsLink5.querySelector("span[aria-hidden='true']");
      expect(badge5).not.toBeNull();
      expect(badge5).toHaveTextContent("5");
      unmount5();

      // Count 100 -> 99+
      const items100 = createTestItems("admin", 100, true);
      const quick100 = createTestQuickAccessItems(items100, "admin");
      render(
        React.createElement(MobileNavToggle, {
          items: items100,
          quickAccessItems: quick100,
          role: "admin",
          profile,
        }),
      );

      const quickNav100 = screen.getByRole("navigation", {
        name: "Navegación de acceso rápido",
      });
      const notifsLink100 = within(quickNav100).getByRole("link", {
        name: "Bandeja de notificaciones, 100 no leídas",
      });
      const badge100 = notifsLink100.querySelector("span[aria-hidden='true']");
      expect(badge100).not.toBeNull();
      expect(badge100).toHaveTextContent("99+");
    });

    it("evaluates exact home matching and descendant matching for active states across quick bar and full menu", () => {
      const profile = createMockProfile({ role: "admin" });
      const items = createTestItems("admin", 0, true);
      const quickAccessItems = createTestQuickAccessItems(items, "admin");

      // 1. Exact match on Home (/admin)
      currentPathname = "/admin";
      const { unmount: unmount1 } = render(
        React.createElement(MobileNavToggle, {
          items,
          quickAccessItems,
          role: "admin",
          profile,
        }),
      );

      const quickNav1 = screen.getByRole("navigation", {
        name: "Navegación de acceso rápido",
      });
      const homeLink1 = within(quickNav1).getByRole("link", { name: "Inicio" });
      const projectsLink1 = within(quickNav1).getByRole("link", {
        name: "Proyectos",
      });

      expect(homeLink1).toHaveAttribute("aria-current", "page");
      expect(projectsLink1).not.toHaveAttribute("aria-current");
      unmount1();

      // 2. Descendant match on Projects (/admin/proyectos/p-123)
      currentPathname = "/admin/proyectos/p-123";
      const { unmount: unmount2 } = render(
        React.createElement(MobileNavToggle, {
          items,
          quickAccessItems,
          role: "admin",
          profile,
        }),
      );

      const quickNav2 = screen.getByRole("navigation", {
        name: "Navegación de acceso rápido",
      });
      const homeLink2 = within(quickNav2).getByRole("link", { name: "Inicio" });
      const projectsLink2 = within(quickNav2).getByRole("link", {
        name: "Proyectos",
      });

      expect(homeLink2).not.toHaveAttribute("aria-current");
      expect(projectsLink2).toHaveAttribute("aria-current", "page");
      unmount2();

      // 3. Match on Notifications (/notificaciones)
      currentPathname = "/notificaciones";
      render(
        React.createElement(MobileNavToggle, {
          items,
          quickAccessItems,
          role: "admin",
          profile,
        }),
      );

      const quickNav3 = screen.getByRole("navigation", {
        name: "Navegación de acceso rápido",
      });
      const notifsLink3 = within(quickNav3).getByRole("link", {
        name: "Bandeja de notificaciones",
      });
      const homeLink3 = within(quickNav3).getByRole("link", { name: "Inicio" });

      expect(notifsLink3).toHaveAttribute("aria-current", "page");
      expect(homeLink3).not.toHaveAttribute("aria-current");
    });

    it("preserves PM Watcher boundary: never exposes Notification Operations in quick bar or full menu", () => {
      const profile = createMockProfile({
        id: "u-2w",
        full_name: "PM Watcher",
        role: "pm",
      });
      const items = createTestItems("pm", 0, false);
      const quickAccessItems = createTestQuickAccessItems(items, "pm");

      render(
        React.createElement(MobileNavToggle, {
          items,
          quickAccessItems,
          role: "pm",
          profile,
        }),
      );

      const quickNav = screen.getByRole("navigation", {
        name: "Navegación de acceso rápido",
      });
      expect(
        within(quickNav).queryByRole("link", {
          name: "Operaciones de Notificaciones",
        }),
      ).not.toBeInTheDocument();

      const menuButton = within(quickNav).getByRole("button", {
        name: "Abrir menú de navegación",
      });
      fireEvent.click(menuButton);

      const fullMenu = screen.getByRole("navigation", {
        name: "Toda la navegación",
      });
      expect(
        within(fullMenu).queryByRole("link", {
          name: "Operaciones de Notificaciones",
        }),
      ).not.toBeInTheDocument();
    });

    it("exposes Notification Operations in full menu for PM Lead with active capability", () => {
      const profile = createMockProfile({
        id: "u-2l",
        full_name: "PM Lead",
        role: "pm",
      });
      const items = createTestItems("pm", 0, true);
      const quickAccessItems = createTestQuickAccessItems(items, "pm");

      render(
        React.createElement(MobileNavToggle, {
          items,
          quickAccessItems,
          role: "pm",
          profile,
        }),
      );

      const quickNav = screen.getByRole("navigation", {
        name: "Navegación de acceso rápido",
      });
      const menuButton = within(quickNav).getByRole("button", {
        name: "Abrir menú de navegación",
      });
      fireEvent.click(menuButton);

      const fullMenu = screen.getByRole("navigation", {
        name: "Toda la navegación",
      });
      const notifOps = within(fullMenu).getByRole("link", {
        name: "Operaciones de Notificaciones",
      });
      expect(notifOps).toHaveAttribute("href", "/pm/notificaciones");
    });

    it("includes Clientes in navigation model for admin and pm, and excludes it for operator and client", () => {
      const t = getSpanishTranslation("shell.nav");

      const adminItems = buildNavigationModel({
        role: "admin",
        unreadCount: 0,
        canAccessNotificationOperations: false,
        t,
      });
      const adminClients = adminItems.find((i) => i.key === "clients");
      expect(adminClients).toBeDefined();
      expect(adminClients?.href).toBe("/admin/clientes");
      expect(adminClients?.label).toBe("Clientes");

      const pmItems = buildNavigationModel({
        role: "pm",
        unreadCount: 0,
        canAccessNotificationOperations: false,
        t,
      });
      const pmClients = pmItems.find((i) => i.key === "clients");
      expect(pmClients).toBeDefined();
      expect(pmClients?.href).toBe("/pm/clientes");
      expect(pmClients?.label).toBe("Clientes");

      const opItems = buildNavigationModel({
        role: "operator",
        unreadCount: 0,
        canAccessNotificationOperations: false,
        t,
      });
      expect(opItems.find((i) => i.key === "clients")).toBeUndefined();

      const clientItems = buildNavigationModel({
        role: "client",
        unreadCount: 0,
        canAccessNotificationOperations: false,
        t,
      });
      expect(clientItems.find((i) => i.key === "clients")).toBeUndefined();
    });

    it("includes recycleBin for admin and pm with correct href and label, but not operator or client", () => {
      const t = getSpanishTranslation("shell.nav");

      const adminItems = buildNavigationModel({
        role: "admin",
        unreadCount: 0,
        canAccessNotificationOperations: false,
        t,
      });
      const adminRecycle = adminItems.find((i) => i.key === "recycleBin");
      expect(adminRecycle).toBeDefined();
      expect(adminRecycle?.href).toBe("/admin/papelera");
      expect(adminRecycle?.label).toBe("Papelera");

      const pmItems = buildNavigationModel({
        role: "pm",
        unreadCount: 0,
        canAccessNotificationOperations: false,
        t,
      });
      const pmRecycle = pmItems.find((i) => i.key === "recycleBin");
      expect(pmRecycle).toBeDefined();
      expect(pmRecycle?.href).toBe("/pm/papelera");
      expect(pmRecycle?.label).toBe("Papelera");

      const opItems = buildNavigationModel({
        role: "operator",
        unreadCount: 0,
        canAccessNotificationOperations: false,
        t,
      });
      expect(opItems.find((i) => i.key === "recycleBin")).toBeUndefined();

      const clientItems = buildNavigationModel({
        role: "client",
        unreadCount: 0,
        canAccessNotificationOperations: false,
        t,
      });
      expect(clientItems.find((i) => i.key === "recycleBin")).toBeUndefined();
    });

    it("includes account for all four active roles with href /cuenta and label Cuenta", () => {
      const t = getSpanishTranslation("shell.nav");

      for (const role of ["admin", "pm", "operator", "client"] as const) {
        const items = buildNavigationModel({
          role,
          unreadCount: 0,
          canAccessNotificationOperations: false,
          t,
        });
        const accountItem = items.find((i) => i.key === "account");
        expect(accountItem).toBeDefined();
        expect(accountItem?.href).toBe("/cuenta");
        expect(accountItem?.label).toBe("Cuenta");
      }
    });

    it("includes accessManagement for admin and pm, and excludes it for operator and client", () => {
      const t = getSpanishTranslation("shell.nav");

      const adminItems = buildNavigationModel({
        role: "admin",
        unreadCount: 0,
        canAccessNotificationOperations: false,
        t,
      });
      const adminAccess = adminItems.find((i) => i.key === "accessManagement");
      expect(adminAccess).toBeDefined();
      expect(adminAccess?.href).toBe("/admin/acceso");
      expect(adminAccess?.label).toBe("Gestión de Acceso");

      const pmItems = buildNavigationModel({
        role: "pm",
        unreadCount: 0,
        canAccessNotificationOperations: false,
        t,
      });
      const pmAccess = pmItems.find((i) => i.key === "accessManagement");
      expect(pmAccess).toBeDefined();
      expect(pmAccess?.href).toBe("/pm/acceso");
      expect(pmAccess?.label).toBe("Gestión de Acceso");

      const opItems = buildNavigationModel({
        role: "operator",
        unreadCount: 0,
        canAccessNotificationOperations: false,
        t,
      });
      expect(opItems.find((i) => i.key === "accessManagement")).toBeUndefined();

      const clientItems = buildNavigationModel({
        role: "client",
        unreadCount: 0,
        canAccessNotificationOperations: false,
        t,
      });
      expect(
        clientItems.find((i) => i.key === "accessManagement"),
      ).toBeUndefined();
    });
  });
});
