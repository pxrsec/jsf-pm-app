// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const mockCaptureException = vi.fn();
vi.mock("@/lib/sentry", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) =>
    React.createElement(
      "a",
      { href, className, "data-testid": "locale-link" },
      children,
    ),
}));

import { ProjectRecoveryState } from "@/components/shared/projects/project-workspace/project-recovery-state";

describe("ProjectRecoveryState Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockError = new Error("Database connection failed: secret_token=12345");
  (mockError as Error & { digest?: string }).digest = "internal_digest_abc123";

  it("renders localized title and description", () => {
    render(
      <ProjectRecoveryState
        error={mockError}
        reset={vi.fn()}
        title="Error al cargar el espacio de trabajo"
        description="No se pudo cargar la información del proyecto o no tienes permisos para acceder."
        retryLabel="Intentar nuevamente"
      />,
    );

    expect(
      screen.getByText("Error al cargar el espacio de trabajo"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No se pudo cargar la información del proyecto o no tienes permisos para acceder.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Intentar nuevamente" }),
    ).toBeInTheDocument();
  });

  it("triggers the provided reset callback when retry button is clicked", () => {
    const mockReset = vi.fn();
    render(
      <ProjectRecoveryState
        error={mockError}
        reset={mockReset}
        title="Error al cargar el espacio de trabajo"
        description="No se pudo cargar la información del proyecto o no tienes permisos para acceder."
        retryLabel="Intentar nuevamente"
      />,
    );

    const retryButton = screen.getByRole("button", {
      name: "Intentar nuevamente",
    });
    fireEvent.click(retryButton);
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("renders optional return link when provided with correct href and label", () => {
    render(
      <ProjectRecoveryState
        error={mockError}
        reset={vi.fn()}
        title="Error al cargar el espacio de trabajo"
        description="No se pudo cargar la información del proyecto o no tienes permisos para acceder."
        retryLabel="Intentar nuevamente"
        returnLink={{
          href: "/admin/proyectos",
          label: "Volver a Proyectos",
        }}
      />,
    );

    const link = screen.getByRole("link", { name: "Volver a Proyectos" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/admin/proyectos");
  });

  it("omits return link when not provided", () => {
    render(
      <ProjectRecoveryState
        error={mockError}
        reset={vi.fn()}
        title="Error al cargar proyectos"
        description="Ocurrió un error inesperado al cargar el directorio de proyectos."
        retryLabel="Intentar nuevamente"
      />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("never renders raw error message or digest to the user", () => {
    const { container } = render(
      <ProjectRecoveryState
        error={mockError}
        reset={vi.fn()}
        title="Generic Recovery Title"
        description="Generic Recovery Description"
        retryLabel="Retry"
      />,
    );

    expect(container.textContent).not.toContain("Database connection failed");
    expect(container.textContent).not.toContain("secret_token");
    expect(container.textContent).not.toContain("internal_digest_abc123");
  });

  it("invokes safe captureException on mount with boundary metadata", () => {
    render(
      <ProjectRecoveryState
        error={mockError}
        reset={vi.fn()}
        title="Generic Recovery Title"
        description="Generic Recovery Description"
        retryLabel="Retry"
      />,
    );

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(mockError, {
      boundary: "localized-route",
    });
  });
});
