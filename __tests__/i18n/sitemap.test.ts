/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

describe("VC-I18N-005: Sitemap reflects canonical public routes with non-production posture", () => {
  let sitemapContent: string;

  beforeAll(() => {
    const sitemapPath = path.resolve(__dirname, "../../src/app/sitemap.ts");
    if (!fs.existsSync(sitemapPath)) {
      throw new Error(`RED: Missing sitemap.ts at ${sitemapPath}`);
    }
    sitemapContent = fs.readFileSync(sitemapPath, "utf-8");
  });

  it("sitemap.ts exists and exports a sitemap function", () => {
    expect(sitemapContent).toContain("export");
    expect(sitemapContent).toMatch(/sitemap|Sitemap/);
  });

  it("sitemap lists only canonical public routes: /, /privacidad, /terminos, /en/, /en/privacidad, /en/terminos", async () => {
    const sitemapModule = await import("../../src/app/sitemap");
    const sitemap =
      (await sitemapModule.default) || (sitemapModule as any).sitemap;
    const entries = await sitemap();

    const urls = entries
      .map((e: { url: string }) => new URL(e.url).pathname)
      .sort();
    expect(urls).toEqual([
      "/",
      "/en/",
      "/en/privacidad",
      "/en/terminos",
      "/privacidad",
      "/terminos",
    ]);
  });

  it("sitemap entries have proper structure with lastModified and reciprocal alternates", async () => {
    const sitemapModule = await import("../../src/app/sitemap");
    const sitemap =
      (await sitemapModule.default) || (sitemapModule as any).sitemap;
    const entries = await sitemap();

    expect(entries.length).toBe(6);
    for (const entry of entries) {
      expect(entry).toHaveProperty("url");
      expect(entry).toHaveProperty("lastModified");
      expect(new Date(entry.lastModified as any).getTime()).not.toBeNaN();
      expect(entry).toHaveProperty("alternates.languages.es-MX");
      expect(entry).toHaveProperty("alternates.languages.en-US");
    }
  });
});
