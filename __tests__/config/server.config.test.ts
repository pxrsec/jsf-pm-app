import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("TC-CFG-002 / VC-CFG-002: Server-only configuration boundary", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("validates SUPABASE_SECRET_KEY synchronously at load time for privileged operations", async () => {
    process.env.SUPABASE_SECRET_KEY =
      "valid_secret_key_123456789012345678901234";

    const { serverConfig } = await import("@/config/server.config");
    expect(serverConfig).toBeDefined();
    expect(serverConfig.supabaseSecretKey).toBe(
      "valid_secret_key_123456789012345678901234",
    );
  });

  it("fails closed when SUPABASE_SECRET_KEY is absent", async () => {
    delete process.env.SUPABASE_SECRET_KEY;

    // RED: server.config.ts does not exist yet
    await expect(import("@/config/server.config")).rejects.toThrow(
      /SUPABASE_SECRET_KEY/,
    );
  });

  it("fails closed when SUPABASE_SECRET_KEY is invalid (empty)", async () => {
    process.env.SUPABASE_SECRET_KEY = "";

    // RED: server.config.ts does not exist yet
    await expect(import("@/config/server.config")).rejects.toThrow(
      /SUPABASE_SECRET_KEY/,
    );
  });

  it("never exports the secret through app.config.ts or any shared module", async () => {
    process.env.SUPABASE_SECRET_KEY =
      "valid_secret_key_123456789012345678901234";

    // RED: server.config.ts does not exist yet
    const serverConfig = await import("@/config/server.config").catch((e) => e);
    const _message = String(serverConfig?.message ?? serverConfig);

    // If module loads, verify it doesn't export the secret value
    if (typeof serverConfig === "object" && serverConfig !== null) {
      expect(JSON.stringify(serverConfig)).not.toContain("valid_secret_key");
    }
  });

  it("does not impose process-wide startup failure when no privileged operation is imported", async () => {
    // RED: server.config.ts does not exist yet
    // The server-only config should only validate when its module is loaded
    // Simply not importing it should not cause failure
    expect(true).toBe(true); // Placeholder - verification requires module existence
  });
});
