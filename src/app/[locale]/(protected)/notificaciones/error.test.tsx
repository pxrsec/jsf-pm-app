// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import NotificationsError from "./error";
import esCatalog from "../../../../../messages/es-MX.json";

const mockCaptureException = vi.fn();
vi.mock("@/lib/sentry", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    return (key: string) => {
      const fullPath = namespace ? `${namespace}.${key}` : key;
      const val = fullPath
        .split(".")
        .reduce<unknown>(
          (acc, part) => (acc as Record<string, unknown>)?.[part],
          esCatalog,
        );
      return typeof val === "string" ? val : fullPath;
    };
  },
}));

describe("NotificationsError Route Error Boundary", () => {
  const mockReset = vi.fn();
  const testError = Object.assign(
    new Error("Sensitive internal database failure"),
    {
      digest: "CRASH_DIGEST_12345",
    },
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("1. Calls captureException through safe Sentry helper with localized-route boundary", () => {
    render(<NotificationsError error={testError} reset={mockReset} />);

    expect(mockCaptureException).toHaveBeenCalledWith(testError, {
      boundary: "localized-route",
    });
  });

  it("2. Renders only localized generic error copy and retry control", () => {
    render(<NotificationsError error={testError} reset={mockReset} />);

    expect(
      screen.getByText("Error al cargar notificaciones"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No se pudieron cargar las notificaciones. Inténtalo de nuevo.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
  });

  it("3. Does not expose error.message or error.digest in rendered DOM", () => {
    const { container } = render(
      <NotificationsError error={testError} reset={mockReset} />,
    );

    expect(container.textContent).not.toContain(
      "Sensitive internal database failure",
    );
    expect(container.textContent).not.toContain("CRASH_DIGEST_12345");
  });

  it("4. Invokes reset() when retry button is clicked", () => {
    render(<NotificationsError error={testError} reset={mockReset} />);

    const retryBtn = screen.getByRole("button", { name: "Reintentar" });
    fireEvent.click(retryBtn);

    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("5. Verifies retry control uses minimum touch target classes", () => {
    render(<NotificationsError error={testError} reset={mockReset} />);

    const retryBtn = screen.getByRole("button", { name: "Reintentar" });
    expect(retryBtn.className).toContain("min-h-[44px]");
    expect(retryBtn.className).toContain("min-w-[44px]");
  });
});
