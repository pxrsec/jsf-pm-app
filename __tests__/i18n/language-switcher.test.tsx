import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
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
});
