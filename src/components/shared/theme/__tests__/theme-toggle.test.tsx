// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ThemeToggle } from "../theme-toggle";
import { axe, toHaveNoViolations } from "jest-axe";
import esCatalog from "../../../../../messages/es-MX.json";

expect.extend(toHaveNoViolations);

const mockSetTheme = vi.fn();
let currentTheme = "light";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: currentTheme,
    setTheme: mockSetTheme,
  }),
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

describe("ThemeToggle", () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = "";
    vi.clearAllMocks();
    currentTheme = "light";
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("renders button with non-empty, localized next-action aria-label in light mode", () => {
    currentTheme = "light";
    render(<ThemeToggle />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "Cambiar a tema oscuro");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Tema actual: Claro")).toBeInTheDocument();
  });

  it("renders button with switchToLight aria-label and aria-pressed=true in dark mode", () => {
    currentTheme = "dark";
    render(<ThemeToggle />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "Cambiar a tema claro");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Tema actual: Oscuro")).toBeInTheDocument();
  });

  it("opens dropdown and presents localized Light and Dark options", () => {
    render(<ThemeToggle />);
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);

    expect(screen.getByText("Claro")).toBeInTheDocument();
    expect(screen.getByText("Oscuro")).toBeInTheDocument();
  });

  it("calls setTheme('light') when Light option is clicked", () => {
    currentTheme = "dark";
    render(<ThemeToggle />);
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);

    const lightOption = screen.getByText("Claro");
    fireEvent.click(lightOption);

    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("calls setTheme('dark') when Dark option is clicked", () => {
    currentTheme = "light";
    render(<ThemeToggle />);
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);

    const darkOption = screen.getByText("Oscuro");
    fireEvent.click(darkOption);

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("marks the active option with aria-current='true'", () => {
    currentTheme = "light";
    render(<ThemeToggle />);
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);

    const lightMenuItem = screen
      .getByText("Claro")
      .closest("[data-slot='dropdown-menu-item']");
    const darkMenuItem = screen
      .getByText("Oscuro")
      .closest("[data-slot='dropdown-menu-item']");

    expect(lightMenuItem).toHaveAttribute("aria-current", "true");
    expect(darkMenuItem).not.toHaveAttribute("aria-current");
  });

  it("passes automated axe accessibility check with zero violations", async () => {
    const { container } = render(<ThemeToggle />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
