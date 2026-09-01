// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { InvitationForm } from "./invitation-form";

const mockPush = vi.fn();

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
  }),
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
  useTranslations: (namespace?: string) => {
    return (key: string) => {
      const messages: Record<string, Record<string, string>> = {
        "auth.invitation": {
          title: "Configura tu Cuenta",
          fullNameLabel: "Nombre completo",
          phoneLabel: "Teléfono (opcional)",
          passwordLabel: "Contraseña",
          whatsappOptInLabel:
            "Deseo recibir notificaciones operativas por WhatsApp",
          submitLabel: "Completar registro",
          errorPolicy:
            "La contraseña debe tener al menos 12 caracteres e incluir mayúsculas, minúsculas, números y símbolos.",
          errorGeneric:
            "No pudimos procesar tu invitación. Verifica tus datos o solicita una nueva.",
        },
        "shell.brand": {
          name: "Joya Star Films",
        },
        "auth.sessionExpired": {
          signInLink: "Ir a Iniciar Sesión",
        },
      };

      if (namespace && messages[namespace]?.[key]) {
        return messages[namespace][key];
      }
      return key;
    };
  },
}));

const mockToken = "a".repeat(43);

describe("InvitationForm Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders branded logo, headers, inputs, and action links", () => {
    render(<InvitationForm token={mockToken} />);

    // Brand logo
    const logo = screen.getByAltText("Joya Star Films");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute(
      "src",
      expect.stringContaining("joyalogo-purple.svg"),
    );

    // Title and brand name
    expect(
      screen.getByRole("heading", { name: "Configura tu Cuenta", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Joya Star Films")).toBeInTheDocument();

    // Form inputs
    expect(screen.getByLabelText("Nombre completo")).toBeInTheDocument();
    expect(screen.getByLabelText("Teléfono (opcional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(
      screen.getByText("Deseo recibir notificaciones operativas por WhatsApp"),
    ).toBeInTheDocument();

    // Submit button
    expect(
      screen.getByRole("button", { name: "Completar registro" }),
    ).toBeInTheDocument();

    // Sign-in link
    const signInLink = screen.getByRole("link", {
      name: /Ir a Iniciar Sesión/i,
    });
    expect(signInLink).toBeInTheDocument();
    expect(signInLink).toHaveAttribute("href", "/iniciar-sesion");
  });

  it("toggles password visibility when the eye button is clicked", () => {
    render(<InvitationForm token={mockToken} />);

    const passwordInput = screen.getByLabelText("Contraseña");
    expect(passwordInput).toHaveAttribute("type", "password");

    const toggleButton = screen.getByRole("button", { name: "Ver contraseña" });
    fireEvent.click(toggleButton);

    expect(passwordInput).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Ocultar contraseña" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("submits the form successfully and navigates to the target redirect path", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 201,
      json: async () => ({
        data: {
          redirect_path: "/pm/proyectos",
        },
      }),
    });

    render(<InvitationForm token={mockToken} />);

    fireEvent.change(screen.getByLabelText("Nombre completo"), {
      target: { value: "Juan Pérez" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "StrongPassw0rd!123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Completar registro" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/auth/invites/complete",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
      expect(mockPush).toHaveBeenCalledWith("/pm/proyectos");
    });
  });

  it("redirects to expired page when API returns 410", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 410,
      json: async () => ({}),
    });

    render(<InvitationForm token={mockToken} />);

    fireEvent.change(screen.getByLabelText("Nombre completo"), {
      target: { value: "Juan Pérez" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "StrongPassw0rd!123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Completar registro" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/sesion-expirada?reason=expired");
    });
  });

  it("displays server error message when submission fails with non-201 status", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 400,
      json: async () => ({
        error: {
          message: "Token inválido o expirado",
        },
      }),
    });

    render(<InvitationForm token={mockToken} />);

    fireEvent.change(screen.getByLabelText("Nombre completo"), {
      target: { value: "Juan Pérez" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "StrongPassw0rd!123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Completar registro" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Token inválido o expirado",
      );
    });
  });
});
