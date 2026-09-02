// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MobileNavToggle } from "../mobile-nav-toggle";
import type { AppNavigationItem } from "../../navigation-model";
import type { Profile } from "@/lib/auth/session";

let mockCurrentPathname = "/pm/papelera";

vi.mock("@/i18n/routing", () => ({
  usePathname: () => mockCurrentPathname,
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      mobileQuickAccessAriaLabel: "Navegación de acceso rápido",
      fullMenuAriaLabel: "Menú de navegación completo",
      openMenu: "Abrir menú",
      closeMenu: "Cerrar menú",
      menu: "Menú",
      "notifications.badgeLabel": "Notificaciones sin leer",
      "currentUser.role.pm": "Project Manager",
    };
    return map[key] ?? key;
  },
}));

vi.mock("../sign-out-button", () => ({
  SignOutButton: () => <button>Cerrar sesión</button>,
}));

vi.mock("@/components/shared/language-switcher/language-switcher", () => ({
  LanguageSwitcher: () => <div>LanguageSwitcher</div>,
}));

vi.mock("@/components/shared/theme/theme-toggle", () => ({
  ThemeToggle: () => <div>ThemeToggle</div>,
}));

describe("MobileNavToggle quick navigation", () => {
  const mockProfile: Profile = {
    id: "user-1",
    full_name: "John PM",
    role: "pm",
    locale: "es",
    notification_email_enabled: true,
    notification_in_app_enabled: true,
    notification_whatsapp_enabled: false,
    whatsapp_phone_e164: null,
    whatsapp_notification_target: null,
    avatar_url: null,
  };

  const mockItems: AppNavigationItem[] = [
    { key: "home", href: "/pm", label: "Inicio", ariaLabel: "Inicio" },
    {
      key: "projects",
      href: "/pm/proyectos",
      label: "Proyectos",
      ariaLabel: "Proyectos",
    },
    {
      key: "calendar",
      href: "/calendario",
      label: "Calendario",
      ariaLabel: "Calendario",
    },
    {
      key: "archive",
      href: "/pm/archivo",
      label: "Archivo",
      ariaLabel: "Archivo",
    },
    {
      key: "recycleBin",
      href: "/pm/papelera",
      label: "Papelera",
      ariaLabel: "Papelera",
    },
    {
      key: "notifications",
      href: "/notificaciones",
      label: "Notificaciones",
      ariaLabel: "Notificaciones",
      unreadCount: 0,
    },
  ];

  const quickAccessItems: AppNavigationItem[] = [
    mockItems[0], // home
    mockItems[1], // projects
    mockItems[2], // calendar
  ];

  beforeEach(() => {
    mockCurrentPathname = "/pm/papelera";
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the persistent quick-access bottom bar", () => {
    render(
      <MobileNavToggle
        items={mockItems}
        quickAccessItems={quickAccessItems}
        role="pm"
        profile={mockProfile}
      />,
    );

    const bottomNav = screen.getByLabelText("Navegación de acceso rápido");
    expect(bottomNav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Proyectos" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Calendario" }),
    ).toBeInTheDocument();
  });

  it("highlights Menu button when user is on a drawer-only subroute like /pm/papelera", () => {
    mockCurrentPathname = "/pm/papelera";
    render(
      <MobileNavToggle
        items={mockItems}
        quickAccessItems={quickAccessItems}
        role="pm"
        profile={mockProfile}
      />,
    );

    const menuButton = screen.getByRole("button", { name: "Abrir menú" });
    // Should have active classes
    expect(menuButton.className).toContain("text-primary");
    expect(menuButton.className).toContain("border-t-2");
  });

  it("opens drawer with icons and displays Papelera as active link", () => {
    mockCurrentPathname = "/pm/papelera";
    render(
      <MobileNavToggle
        items={mockItems}
        quickAccessItems={quickAccessItems}
        role="pm"
        profile={mockProfile}
      />,
    );

    const menuButton = screen.getByRole("button", { name: "Abrir menú" });
    fireEvent.click(menuButton);

    const drawer = screen.getByLabelText("Menú de navegación completo");
    expect(drawer).toBeInTheDocument();

    const papeleraLink = screen.getByRole("link", { name: "Papelera" });
    expect(papeleraLink).toBeInTheDocument();
    expect(papeleraLink).toHaveAttribute("aria-current", "page");
    expect(papeleraLink.className).toContain("text-primary");
    expect(papeleraLink.className).toContain("border-l-4");
  });
});
