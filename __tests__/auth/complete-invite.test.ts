import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as adminSupabase from "@/lib/supabase/admin";
import * as serverSupabase from "@/lib/supabase/server";

vi.mock("@/config/app.config", () => ({
  appConfig: {
    appUrl: "http://localhost:3000",
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "sb_publishable_test_key",
  },
}));

vi.mock("@/config/server.config", () => ({
  serverConfig: {
    supabaseSecretKey: "sb_secret_test_key",
  },
}));

vi.mock("@/lib/supabase/admin");
vi.mock("@/lib/supabase/server");
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    setAll: vi.fn(),
  }),
}));

import { POST } from "@/app/api/v1/auth/invites/complete/route";

describe("POST /api/v1/auth/invites/complete", () => {
  const validPayload = {
    token: "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde123",
    full_name: "Ana Torres",
    phone_e164: "+525512345678",
    password: "Str0ng!Passw0rd",
    whatsapp_opt_in: true,
  };

  const validHeaders = {
    "Content-Type": "application/json",
    "Idempotency-Key": "12345678-1234-1234-1234-123456789abc",
    Origin: "http://localhost:3000",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when Idempotency-Key header is missing", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/invites/complete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify(validPayload),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("validation_error");
    expect(json.error.message).toContain("Idempotency-Key");
  });

  it("returns 403 when Origin header is from an untrusted domain", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/invites/complete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "12345678-1234-1234-1234-123456789abc",
          Origin: "https://evil.attacker.com",
        },
        body: JSON.stringify(validPayload),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("forbidden");
  });

  it("returns 400 on password policy violation", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/invites/complete",
      {
        method: "POST",
        headers: validHeaders,
        body: JSON.stringify({
          ...validPayload,
          password: "weak",
        }),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("validation_error");
    expect(json.error.field_errors).toHaveProperty("password");
  });

  it("returns 410 when invitation token is not found in database", async () => {
    const mockAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.mocked(adminSupabase.createAdminClient).mockReturnValue(
      mockAdmin as unknown as ReturnType<
        typeof adminSupabase.createAdminClient
      >,
    );

    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/invites/complete",
      {
        method: "POST",
        headers: validHeaders,
        body: JSON.stringify(validPayload),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.error.code).toBe("invite_terminal");
  });

  it("returns 410 when invitation token is expired", async () => {
    const mockAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "invite-1",
                email: "ana@example.com",
                role: "operator",
                status: "pending",
                expires_at: "2020-01-01T00:00:00Z", // Expired
                revoked_at: null,
              },
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.mocked(adminSupabase.createAdminClient).mockReturnValue(
      mockAdmin as unknown as ReturnType<
        typeof adminSupabase.createAdminClient
      >,
    );

    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/invites/complete",
      {
        method: "POST",
        headers: validHeaders,
        body: JSON.stringify(validPayload),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.error.code).toBe("invite_terminal");
  });

  it("returns 410 when invitation token has already been accepted", async () => {
    const mockAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "invite-1",
                email: "ana@example.com",
                role: "operator",
                status: "accepted", // Already consumed
                expires_at: "2099-01-01T00:00:00Z",
                revoked_at: null,
              },
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.mocked(adminSupabase.createAdminClient).mockReturnValue(
      mockAdmin as unknown as ReturnType<
        typeof adminSupabase.createAdminClient
      >,
    );

    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/invites/complete",
      {
        method: "POST",
        headers: validHeaders,
        body: JSON.stringify(validPayload),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(410);
  });

  it("successfully creates user and returns 201 on valid invitation redemption", async () => {
    const mockAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "invite-123",
                email: "operator@jsf.internal",
                role: "operator",
                status: "pending",
                expires_at: "2099-01-01T00:00:00Z",
                revoked_at: null,
              },
              error: null,
            }),
          }),
        }),
      }),
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: {
              user: { id: "new-user-789", email: "operator@jsf.internal" },
            },
            error: null,
          }),
        },
      },
    };
    vi.mocked(adminSupabase.createAdminClient).mockReturnValue(
      mockAdmin as unknown as ReturnType<
        typeof adminSupabase.createAdminClient
      >,
    );

    const mockUserClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: {} },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({
        data: { success: true },
        error: null,
      }),
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(serverSupabase.createClient).mockReturnValue(
      mockUserClient as unknown as ReturnType<
        typeof serverSupabase.createClient
      >,
    );

    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/invites/complete",
      {
        method: "POST",
        headers: validHeaders,
        body: JSON.stringify(validPayload),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(json.data.user_id).toBe("new-user-789");
    expect(json.data.redirect_path).toBe("/operador");
  });
});
