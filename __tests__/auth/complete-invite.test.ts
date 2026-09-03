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
    Origin: "http://localhost:3000",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when Origin header is from an untrusted domain", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/invites/complete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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

  it("returns 409 when auth user already exists", async () => {
    const mockAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "invite-1",
                email: "existing@example.com",
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
            data: { user: null },
            error: { message: "User already registered", status: 422 },
          }),
          deleteUser: vi.fn(),
        },
      },
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
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("conflict");
    expect(mockAdmin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("deletes created auth user and signs out when accept_invite RPC fails", async () => {
    const deleteUserMock = vi.fn().mockResolvedValue({ error: null });
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
              user: { id: "created-user-999", email: "operator@jsf.internal" },
            },
            error: null,
          }),
          deleteUser: deleteUserMock,
        },
      },
    };
    vi.mocked(adminSupabase.createAdminClient).mockReturnValue(
      mockAdmin as unknown as ReturnType<
        typeof adminSupabase.createAdminClient
      >,
    );

    const signOutMock = vi.fn().mockResolvedValue({ error: null });
    const mockUserClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: {} },
          error: null,
        }),
        signOut: signOutMock,
      },
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Terminal invalid token" },
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
    expect(res.status).toBe(410);
    expect(deleteUserMock).toHaveBeenCalledWith("created-user-999");
    expect(signOutMock).toHaveBeenCalled();
  });

  it("successfully calls 4-argument accept_invite RPC and returns 201 without profiles mutation", async () => {
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
          deleteUser: vi.fn(),
        },
      },
    };
    vi.mocked(adminSupabase.createAdminClient).mockReturnValue(
      mockAdmin as unknown as ReturnType<
        typeof adminSupabase.createAdminClient
      >,
    );

    const rpcMock = vi.fn().mockResolvedValue({
      data: {
        success: true,
        role: "operator",
        project_id: null,
        client_id: null,
      },
      error: null,
    });
    const fromMock = vi.fn();

    const mockUserClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: {} },
          error: null,
        }),
        signOut: vi.fn(),
      },
      rpc: rpcMock,
      from: fromMock,
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
    expect(json.data).toEqual({
      redirect_path: "/operador",
    });

    // Verify 4-argument accept_invite RPC signature
    expect(rpcMock).toHaveBeenCalledWith("accept_invite", {
      p_token_hash: expect.stringMatching(/^\\x[0-9a-f]{64}$/),
      p_full_name: "Ana Torres",
      p_phone_e164: "+525512345678",
      p_whatsapp_opt_in: true,
    });

    // Verify ZERO direct profiles mutations
    expect(fromMock).not.toHaveBeenCalled();
  });
});
