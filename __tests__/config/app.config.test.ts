import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("TC-CFG-001 / VC-CFG-001: Public configuration boundary (src/config/app.config.ts)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("exports public configuration derived from NEXT_PUBLIC_* variables", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      "sb_publishable_test_key";

    const { appConfig } = await import("@/config/app.config");

    expect(appConfig).toBeDefined();
    expect(appConfig.appUrl).toBe("https://app.example.com");
    expect(appConfig.supabaseUrl).toBe("https://example.supabase.co");
    expect(appConfig.supabasePublishableKey).toBe("sb_publishable_test_key");
  });

  it("requires non-empty NEXT_PUBLIC_APP_URL (presence only, no URL-format rejection)", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      "sb_publishable_test_key";

    await expect(import("@/config/app.config")).rejects.toThrow(
      /NEXT_PUBLIC_APP_URL/,
    );

    // OQ-01: presence is sufficient; a non-URL-shaped value must NOT be rejected
    vi.resetModules();
    process.env.NEXT_PUBLIC_APP_URL = "not-a-url";
    const { appConfig } = await import("@/config/app.config");
    expect(appConfig.appUrl).toBe("not-a-url");
  });

  it("requires valid HTTPS NEXT_PUBLIC_SUPABASE_URL and non-empty publishable key", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://insecure.example.com";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      "sb_publishable_test_key";

    await expect(import("@/config/app.config")).rejects.toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );

    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "";

    await expect(import("@/config/app.config")).rejects.toThrow(
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  it("does not expose server-only configuration or the secret key", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      "sb_publishable_test_key";
    process.env.SUPABASE_SECRET_KEY = "super_secret_admin_key";

    const { appConfig } = await import("@/config/app.config");

    expect(appConfig).not.toHaveProperty("supabaseSecretKey");
    expect(JSON.stringify(appConfig)).not.toContain("super_secret_admin_key");
    expect(JSON.stringify(appConfig)).not.toContain("SUPABASE_SECRET_KEY");
  });

  it("configuration failure messages are safe and non-leaking", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      "sb_publishable_test_key";

    const failure = await import("@/config/app.config").catch((e) => e);
    const message = String(failure?.message ?? failure);

    // Must not disclose raw environment dump, stack trace, or secret values
    expect(message).not.toContain("super_secret_admin_key");
    expect(message).not.toContain("at ");
    expect(message).not.toContain("env:");
  });
});
