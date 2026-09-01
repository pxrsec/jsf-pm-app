import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  saveClientContactSchema,
  setProjectClientContactSchema,
  loadProjectClientContactAssociationsSchema,
} from "@/lib/clients/schemas";
import {
  saveClientContactAction,
  setProjectClientContactAction,
  loadProjectClientContactAssociationsAction,
} from "@/lib/clients/actions";
import { AuthError } from "@/lib/auth/session";

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
  }),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock session
const mockRequireSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
  AuthError: class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthError";
    }
  },
}));

// Mock Supabase
const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
  })),
}));

describe("S10 Client Administration — Schemas & Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveClientContactSchema", () => {
    it("accepts valid direct contact input", () => {
      const input = {
        fullName: "Jane Doe",
        email: "jane@example.com",
        phoneE164: "+15551234567",
        jobTitle: "Creative Lead",
        clientId: null,
        isPrimary: false,
      };
      const result = saveClientContactSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts valid organization contact input with isPrimary=true", () => {
      const input = {
        contactId: "11111111-1111-4111-8111-111111111111",
        fullName: "John Smith",
        email: "john@org.com",
        phoneE164: "+525512345678",
        jobTitle: "VP Marketing",
        clientId: "22222222-2222-4222-8222-222222222222",
        isPrimary: true,
      };
      const result = saveClientContactSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects direct contact with isPrimary=true", () => {
      const input = {
        fullName: "Jane Doe",
        email: "jane@example.com",
        clientId: null,
        isPrimary: true,
      };
      const result = saveClientContactSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          "Direct contacts cannot be designated as primary",
        );
      }
    });

    it("rejects unknown keys due to strict validation", () => {
      const input = {
        fullName: "Jane Doe",
        email: "jane@example.com",
        isPrimary: false,
        extraUnauthorizedField: true,
      };
      const result = saveClientContactSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("setProjectClientContactSchema & loadProjectClientContactAssociationsSchema", () => {
    it("validates setProjectClientContactSchema strictly", () => {
      const valid = {
        projectId: "11111111-1111-4111-8111-111111111111",
        contactId: "22222222-2222-4222-8222-222222222222",
        associated: true,
      };
      expect(setProjectClientContactSchema.safeParse(valid).success).toBe(true);

      const invalid = { ...valid, extraField: "disallowed" };
      expect(setProjectClientContactSchema.safeParse(invalid).success).toBe(
        false,
      );
    });

    it("validates loadProjectClientContactAssociationsSchema strictly", () => {
      const valid = { projectId: "11111111-1111-4111-8111-111111111111" };
      expect(
        loadProjectClientContactAssociationsSchema.safeParse(valid).success,
      ).toBe(true);

      const invalid = { projectId: "not-a-uuid" };
      expect(
        loadProjectClientContactAssociationsSchema.safeParse(invalid).success,
      ).toBe(false);
    });
  });

  describe("Action Error Boundary & Role Authority", () => {
    it("returns UNAUTHORIZED on AuthError", async () => {
      mockRequireSession.mockRejectedValueOnce(
        new AuthError("UNAUTHENTICATED", "No session"),
      );

      const res = await saveClientContactAction({
        fullName: "Jane",
        email: "jane@example.com",
        isPrimary: false,
      });

      expect(res).toEqual({ ok: false, code: "UNAUTHORIZED" });
    });

    it("returns UNAUTHORIZED for operator and client roles", async () => {
      mockRequireSession.mockResolvedValueOnce({
        userId: "user-1",
        role: "operator",
      });

      const res = await saveClientContactAction({
        fullName: "Jane",
        email: "jane@example.com",
        isPrimary: false,
      });

      expect(res).toEqual({ ok: false, code: "UNAUTHORIZED" });
    });

    it("returns VALIDATION_FAILED on invalid input for saveClientContactAction", async () => {
      mockRequireSession.mockResolvedValueOnce({
        userId: "user-1",
        role: "admin",
      });

      const res = await saveClientContactAction({
        fullName: "",
        email: "invalid-email",
        isPrimary: false,
      });

      expect(res).toEqual({ ok: false, code: "VALIDATION_FAILED" });
    });

    it("executes saveClientContactAction successfully for admin and pm", async () => {
      mockRequireSession.mockResolvedValueOnce({
        userId: "user-1",
        role: "pm",
      });
      mockRpc.mockResolvedValueOnce({
        data: "33333333-3333-4333-8333-333333333333",
        error: null,
      });

      const res = await saveClientContactAction({
        fullName: "Jane Doe",
        email: "jane@example.com",
        isPrimary: false,
      });

      expect(res).toEqual({
        ok: true,
        data: { contactId: "33333333-3333-4333-8333-333333333333" },
      });
      expect(mockRpc).toHaveBeenCalledWith(
        "save_client_contact",
        expect.objectContaining({
          p_contact_id: null,
          p_full_name: "Jane Doe",
          p_email: "jane@example.com",
          p_is_primary: false,
        }),
      );
    });

    it("executes setProjectClientContactAction successfully", async () => {
      mockRequireSession.mockResolvedValueOnce({
        userId: "user-1",
        role: "admin",
      });
      mockRpc.mockResolvedValueOnce({
        data: true,
        error: null,
      });

      const res = await setProjectClientContactAction({
        projectId: "11111111-1111-4111-8111-111111111111",
        contactId: "22222222-2222-4222-8222-222222222222",
        associated: true,
      });

      expect(res).toEqual({ ok: true, data: true });
      expect(mockRpc).toHaveBeenCalledWith("set_project_client_contact", {
        p_project_id: "11111111-1111-4111-8111-111111111111",
        p_contact_id: "22222222-2222-4222-8222-222222222222",
        p_associated: true,
      });
    });

    it("executes loadProjectClientContactAssociationsAction without revalidation", async () => {
      mockRequireSession.mockResolvedValueOnce({
        userId: "user-1",
        role: "admin",
      });
      mockRpc.mockResolvedValueOnce({
        data: [{ contact_id: "22222222-2222-4222-8222-222222222222" }],
        error: null,
      });

      const res = await loadProjectClientContactAssociationsAction({
        projectId: "11111111-1111-4111-8111-111111111111",
      });

      expect(res).toEqual({
        ok: true,
        data: ["22222222-2222-4222-8222-222222222222"],
      });
    });
  });
});
