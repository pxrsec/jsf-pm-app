// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

let currentLocale = "es-MX";
const mockReplace = vi.fn();
const mockPathname = "/admin";

vi.mock("next-intl", () => ({
  useLocale: () => currentLocale,
}));

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => mockPathname,
}));

import { LanguageSwitcher } from "@/components/shared/language-switcher/language-switcher";

describe("LanguageSwitcher Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentLocale = "es-MX";
  });

  it("renders with ES active when locale is es-MX", () => {
    currentLocale = "es-MX";
    const markup = renderToStaticMarkup(<LanguageSwitcher />);

    expect(markup).toContain("ES");
    expect(markup).toContain("EN");
    expect(markup).toContain('aria-label="Cambiar idioma a Inglés"');
  });

  it("renders with EN active when locale is en-US", () => {
    currentLocale = "en-US";
    const markup = renderToStaticMarkup(<LanguageSwitcher />);

    expect(markup).toContain("ES");
    expect(markup).toContain("EN");
    expect(markup).toContain('aria-label="Switch language to Spanish"');
  });

  it("transitions to en-US on click when current locale is es-MX", () => {
    currentLocale = "es-MX";
    render(<LanguageSwitcher />);

    const button = screen.getByRole("button", {
      name: "Cambiar idioma a Inglés",
    });
    fireEvent.click(button);

    expect(mockReplace).toHaveBeenCalledWith("/admin", { locale: "en-US" });
  });

  it("transitions to es-MX on click when current locale is en-US", () => {
    currentLocale = "en-US";
    render(<LanguageSwitcher />);

    const button = screen.getByRole("button", {
      name: "Switch language to Spanish",
    });
    fireEvent.click(button);

    expect(mockReplace).toHaveBeenCalledWith("/admin", { locale: "es-MX" });
  });
});
