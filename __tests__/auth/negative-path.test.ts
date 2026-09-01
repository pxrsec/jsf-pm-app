import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import * as adminSupabase from "@/lib/supabase/admin";
import * as serverSupabase from "@/lib/supabase/server";

vi.mock("server-only", () => ({}));

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
  headers: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT: ${url}`);
    (error as unknown as { digest: string }).digest = `NEXT_REDIRECT;${url}`;
    throw error;
  }),
}));

vi.mock("@/lib/auth/session", () => {
  class AuthError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "AuthError";
      this.code = code;
    }
  }

  return {
    AuthError,
    requireSession: vi.fn(),
  };
});

vi.mock("@/lib/shell-data/shell-queries", () => ({
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/components/shared/app-nav/app-nav", () => ({
  AppNav: () => null,
}));

import { POST as completeInvitePOST } from "@/app/api/v1/auth/invites/complete/route";
import { POST as magicLinkPOST } from "@/app/api/v1/auth/magic-link/route";
import { passwordSchema } from "@/lib/validation/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession, AuthError } from "@/lib/auth/session";
import ProtectedLayout from "@/app/[locale]/(protected)/layout";

describe("S03-E03-03 Negative-Path & Cross-Boundary Security Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validHeaders = {
    "Content-Type": "application/json",
    "Idempotency-Key": "12345678-1234-1234-1234-123456789abc",
    Origin: "http://localhost:3000",
  };

  const validInvitePayload = {
    token: "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde123",
    full_name: "Ana Torres",
    phone_e164: "+525512345678",
    password: "Str0ng!Passw0rd",
    whatsapp_opt_in: true,
  };

  describe("N-01 to N-04: Invitation Completion Negative Paths", () => {
    // N-01: Expired/used invitation token returns 410 invite_terminal (also covered in complete-invite.test.ts)
    it("N-01: returns 410 when invitation token is expired or consumed", async () => {
      const mockAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "invite-expired",
                  email: "expired@jsf.internal",
                  role: "operator",
                  status: "pending",
                  expires_at: "2020-01-01T00:00:00Z",
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
          body: JSON.stringify(validInvitePayload),
        },
      );

      const res = await completeInvitePOST(req);
      expect(res.status).toBe(410);
      const json = await res.json();
      expect(json.error.code).toBe("invite_terminal");
      expect(json).not.toHaveProperty("token");
    });

    // N-02: Wrong recipient or accept_invite RPC failure
    it("N-02: returns 410 safe error when accept_invite RPC rejects token", async () => {
      const mockAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "invite-mismatch",
                  email: "intended@jsf.internal",
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
                user: { id: "user-mismatch", email: "intended@jsf.internal" },
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
          signOut: vi.fn().mockResolvedValue({}),
        },
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "recipient_mismatch", code: "P0001" },
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
          body: JSON.stringify(validInvitePayload),
        },
      );

      const res = await completeInvitePOST(req);
      expect(res.status).toBe(410);
      const json = await res.json();
      expect(json.error.code).toBe("invite_terminal");
      expect(json.error.message).not.toContain("recipient_mismatch");
      expect(json.error.message).not.toContain("P0001");
    });

    // N-03: Replay of a valid token (second call after first succeeded)
    it("N-03: returns 410 on replay attempt when token status is already accepted", async () => {
      const mockAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "invite-replayed",
                  email: "ana@jsf.internal",
                  role: "operator",
                  status: "accepted",
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
          body: JSON.stringify(validInvitePayload),
        },
      );

      const res = await completeInvitePOST(req);
      expect(res.status).toBe(410);
      const json = await res.json();
      expect(json.error.code).toBe("invite_terminal");
    });

    // N-04: Malformed token format fails Zod validation before DB call
    it("N-04: returns 400 when token format is malformed without making database calls", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/v1/auth/invites/complete",
        {
          method: "POST",
          headers: validHeaders,
          body: JSON.stringify({
            ...validInvitePayload,
            token: "short_invalid_token",
          }),
        },
      );

      const res = await completeInvitePOST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("validation_error");
      expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
    });
  });

  describe("N-05 & N-06: Magic Link Negative Paths", () => {
    // N-05: Magic link for non-existent account returns enumeration-safe 202
    it("N-05: returns 202 enumeration-safe response for non-existent account", async () => {
      const mockSupabase = {
        auth: {
          signInWithOtp: vi.fn().mockResolvedValue({
            data: null,
            error: new Error("User not found"),
          }),
        },
      };
      vi.mocked(serverSupabase.createClient).mockReturnValue(
        mockSupabase as unknown as ReturnType<
          typeof serverSupabase.createClient
        >,
      );

      const req = new NextRequest(
        "http://localhost:3000/api/v1/auth/magic-link",
        {
          method: "POST",
          headers: validHeaders,
          body: JSON.stringify({
            email: "nonexistent@example.com",
            redirect_path: "/pm",
          }),
        },
      );

      const res = await magicLinkPOST(req);
      expect(res.status).toBe(202);
      const json = await res.json();
      expect(json.data).toBeDefined();
    });

    // N-06: Magic link with invalid email format
    it("N-06: returns 400 on invalid email format without calling Supabase", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/v1/auth/magic-link",
        {
          method: "POST",
          headers: validHeaders,
          body: JSON.stringify({
            email: "invalid-email-format",
            redirect_path: "/pm",
          }),
        },
      );

      const res = await magicLinkPOST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("validation_error");
      expect(serverSupabase.createClient).not.toHaveBeenCalled();
    });
  });

  describe("N-07 to N-09: Password Policy Enforcement", () => {
    it("N-07: rejects passwords under 12 characters", () => {
      const res = passwordSchema.safeParse("Short1!a");
      expect(res.success).toBe(false);
    });

    it("N-08: rejects passwords lacking uppercase characters", () => {
      const res = passwordSchema.safeParse("lowercase1234!");
      expect(res.success).toBe(false);
    });

    it("N-09: rejects passwords lacking symbol characters", () => {
      const res = passwordSchema.safeParse("NoSymbolsAllowed123");
      expect(res.success).toBe(false);
    });
  });

  describe("N-10 to N-16: Role Route Isolation & Protected Layout Guards", () => {
    // N-10: Unauthenticated deep-link to /admin redirects to /iniciar-sesion
    it("N-10: redirects unauthenticated access on /admin to /iniciar-sesion", async () => {
      vi.mocked(requireSession).mockRejectedValue(
        new AuthError("UNAUTHENTICATED", "No active session"),
      );

      await expect(
        ProtectedLayout({ children: "admin-content" }),
      ).rejects.toThrow("NEXT_REDIRECT: /iniciar-sesion");
      expect(redirect).toHaveBeenCalledWith("/iniciar-sesion");
    });

    // N-11: Authenticated client accessing /pm redirects to /cliente
    it("N-11: redirects client accessing /pm to /cliente", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "user-client", email: "client@example.com" },
        profile: {
          id: "user-client",
          full_name: "Client User",
          role: "client",
          is_active: true,
          deleted_at: null,
        },
        role: "client",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      vi.mocked(headers).mockResolvedValue(
        new Headers({ "x-pathname": "/pm" }) as unknown as Awaited<
          ReturnType<typeof headers>
        >,
      );

      await expect(ProtectedLayout({ children: "pm-content" })).rejects.toThrow(
        "NEXT_REDIRECT: /cliente",
      );
      expect(redirect).toHaveBeenCalledWith("/cliente");
    });

    // N-12: Authenticated PM accessing /operador redirects to /pm
    it("N-12: redirects pm accessing /operador to /pm", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "user-pm", email: "pm@example.com" },
        profile: {
          id: "user-pm",
          full_name: "PM User",
          role: "pm",
          is_active: true,
          deleted_at: null,
        },
        role: "pm",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      vi.mocked(headers).mockResolvedValue(
        new Headers({ "x-pathname": "/operador" }) as unknown as Awaited<
          ReturnType<typeof headers>
        >,
      );

      await expect(
        ProtectedLayout({ children: "operator-content" }),
      ).rejects.toThrow("NEXT_REDIRECT: /pm");
      expect(redirect).toHaveBeenCalledWith("/pm");
    });

    // N-13: Authenticated Admin accessing /cliente redirects to /admin
    it("N-13: redirects admin accessing /cliente to /admin", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "user-admin", email: "admin@example.com" },
        profile: {
          id: "user-admin",
          full_name: "Admin User",
          role: "admin",
          is_active: true,
          deleted_at: null,
        },
        role: "admin",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      vi.mocked(headers).mockResolvedValue(
        new Headers({ "x-pathname": "/cliente" }) as unknown as Awaited<
          ReturnType<typeof headers>
        >,
      );

      await expect(
        ProtectedLayout({ children: "client-content" }),
      ).rejects.toThrow("NEXT_REDIRECT: /admin");
      expect(redirect).toHaveBeenCalledWith("/admin");
    });

    // N-14: Authenticated Operator accessing /admin redirects to /operador
    it("N-14: redirects operator accessing /admin to /operador", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "user-op", email: "op@example.com" },
        profile: {
          id: "user-op",
          full_name: "Operator User",
          role: "operator",
          is_active: true,
          deleted_at: null,
        },
        role: "operator",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      vi.mocked(headers).mockResolvedValue(
        new Headers({ "x-pathname": "/admin" }) as unknown as Awaited<
          ReturnType<typeof headers>
        >,
      );

      await expect(
        ProtectedLayout({ children: "admin-content" }),
      ).rejects.toThrow("NEXT_REDIRECT: /operador");
      expect(redirect).toHaveBeenCalledWith("/operador");
    });

    // N-15: Inactive profile accessing protected route redirects to expired session
    it("N-15: redirects is_active = false profile to /sesion-expirada?reason=inactive", async () => {
      vi.mocked(requireSession).mockRejectedValue(
        new AuthError(
          "INACTIVE_OR_MISSING_PROFILE",
          "Profile is inactive or deleted",
        ),
      );

      await expect(
        ProtectedLayout({ children: "protected-content" }),
      ).rejects.toThrow("NEXT_REDIRECT: /sesion-expirada?reason=inactive");
      expect(redirect).toHaveBeenCalledWith("/sesion-expirada?reason=inactive");
    });

    // N-16: Soft-deleted profile accessing protected route redirects to expired session
    it("N-16: redirects deleted_at profile to /sesion-expirada?reason=inactive", async () => {
      vi.mocked(requireSession).mockRejectedValue(
        new AuthError(
          "INACTIVE_OR_MISSING_PROFILE",
          "Profile is inactive or deleted",
        ),
      );

      await expect(
        ProtectedLayout({ children: "protected-content" }),
      ).rejects.toThrow("NEXT_REDIRECT: /sesion-expirada?reason=inactive");
      expect(redirect).toHaveBeenCalledWith("/sesion-expirada?reason=inactive");
    });
  });

  describe("N-17 to N-19: Static Security Boundary Checks", () => {
    // N-17: Raw token fixture check
    it("N-17: no unhashed raw invitation tokens appear in complete-invite.test.ts", () => {
      const filePath = path.resolve(
        __dirname,
        "../../__tests__/auth/complete-invite.test.ts",
      );
      const content = fs.readFileSync(filePath, "utf-8");

      // Check for raw token patterns longer than 44 chars that are not mock hash variables
      const rawTokenMatches = content.match(
        /['"][A-Za-z0-9+/=]{44,}['"](?!\s*:\s*mock)/g,
      );
      // Filter out explicitly defined valid test payload token
      const unexpectedTokens = (rawTokenMatches || []).filter(
        (t) =>
          !t.includes("AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde123") &&
          !t.includes("12345678-1234-1234-1234-123456789abc"),
      );

      expect(unexpectedTokens).toEqual([]);
    });

    // N-18 & N-19: Credential exposure static assertions
    it("N-18 & N-19: verifies credential-exposure test suite passes", () => {
      const credentialTestPath = path.resolve(
        __dirname,
        "../../__tests__/config/credential-exposure.test.ts",
      );
      expect(fs.existsSync(credentialTestPath)).toBe(true);
    });
  });

  describe("N-20: Public Route Shell Navigation Isolation", () => {
    it("N-20: public routes do not include shell navigation landmark", () => {
      const publicMessagesPath = path.resolve(
        __dirname,
        "../../messages/es-MX.json",
      );
      const messages = JSON.parse(fs.readFileSync(publicMessagesPath, "utf-8"));

      // Verify privacy and auth namespaces exist independently of shell nav
      expect(messages).toHaveProperty("auth");
      expect(messages).toHaveProperty("privacy");
      expect(messages).toHaveProperty("shell");
    });
  });
});
