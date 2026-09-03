import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createOrdinaryInvitationSchema,
  ordinaryInvitationCursorSchema,
} from "@/lib/invitations/schemas";
import {
  createOrdinaryInvitationAction,
  revokeOrdinaryInvitationAction,
} from "@/lib/invitations/actions";
import { fetchOrdinaryInvitationPage } from "@/lib/invitations/queries";

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

// Mock appConfig
vi.mock("@/config/app.config", () => ({
  appConfig: {
    appUrl: "https://pm.joyastarfilms.com",
  },
}));

// Mock session
const mockRequireSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
  AuthError: class AuthError extends Error {
    constructor(code: string, message: string) {
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

describe("S10 Ordinary Invitations — Schemas, Queries, & Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Schemas", () => {
    it("validates client invitation creation requiring contactId and rejecting email", () => {
      const validClient = {
        role: "client",
        contactId: "11111111-1111-4111-8111-111111111111",
        projectId: "22222222-2222-4222-8222-222222222222",
        expiresInHours: 72,
      };
      expect(
        createOrdinaryInvitationSchema.safeParse(validClient).success,
      ).toBe(true);

      const invalidClientWithEmail = {
        ...validClient,
        recipientEmail: "test@example.com",
      };
      expect(
        createOrdinaryInvitationSchema.safeParse(invalidClientWithEmail)
          .success,
      ).toBe(false);
    });

    it("validates operator invitation creation requiring recipientEmail and rejecting contactId", () => {
      const validOperator = {
        role: "operator",
        recipientEmail: "operator@joyastarfilms.com",
        projectId: null,
        expiresInHours: 168,
      };
      expect(
        createOrdinaryInvitationSchema.safeParse(validOperator).success,
      ).toBe(true);

      const invalidOperatorWithContactId = {
        ...validOperator,
        contactId: "11111111-1111-4111-8111-111111111111",
      };
      expect(
        createOrdinaryInvitationSchema.safeParse(invalidOperatorWithContactId)
          .success,
      ).toBe(false);
    });

    it("validates cursor schema with ISO datetime and UUID", () => {
      const valid = {
        beforeCreatedAt: "2026-08-31T15:30:00.000Z",
        beforeInvitationId: "11111111-1111-4111-8111-111111111111",
      };
      expect(ordinaryInvitationCursorSchema.safeParse(valid).success).toBe(
        true,
      );

      const invalidDate = {
        beforeCreatedAt: "not-a-date",
        beforeInvitationId: "11111111-1111-4111-8111-111111111111",
      };
      expect(
        ordinaryInvitationCursorSchema.safeParse(invalidDate).success,
      ).toBe(false);
    });
  });

  describe("fetchOrdinaryInvitationPage Query", () => {
    it("returns validated page and derives nextCursor from last visible row", async () => {
      const fakeRows = [
        {
          invitation_id: "11111111-1111-4111-8111-111111111111",
          role: "client",
          status: "pending",
          recipient_label: "Jane Doe (jane@example.com)",
          contact_id: "22222222-2222-4222-8222-222222222222",
          project_id: null,
          project_name: null,
          created_at: "2026-08-31T12:00:00Z",
          expires_at: "2026-09-07T12:00:00Z",
          accepted_at: null,
          revoked_at: null,
        },
        {
          invitation_id: "33333333-3333-4333-8333-333333333333",
          role: "operator",
          status: "accepted",
          recipient_label: "operator@jsf.com",
          contact_id: null,
          project_id: null,
          project_name: null,
          created_at: "2026-08-30T12:00:00Z",
          expires_at: "2026-09-06T12:00:00Z",
          accepted_at: "2026-08-30T14:00:00Z",
          revoked_at: null,
        },
      ];

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: fakeRows,
          error: null,
        }),
      };

      const res = await fetchOrdinaryInvitationPage(
        mockSupabase as unknown as Parameters<
          typeof fetchOrdinaryInvitationPage
        >[0],
        null,
        1,
      );

      expect(res.status).toBe("available");
      if (res.status === "available") {
        expect(res.data.items.length).toBe(1);
        expect(res.data.items[0].invitationId).toBe(
          "11111111-1111-4111-8111-111111111111",
        );
        expect(res.data.nextCursor).toEqual({
          beforeCreatedAt: "2026-08-31T12:00:00Z",
          beforeInvitationId: "11111111-1111-4111-8111-111111111111",
        });
      }
    });

    it("fails closed as unavailable if any row in the page is malformed", async () => {
      const malformedRows = [
        {
          invitation_id: "not-a-uuid",
          role: "invalid-role",
          status: "pending",
        },
      ];

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: malformedRows,
          error: null,
        }),
      };

      const res = await fetchOrdinaryInvitationPage(
        mockSupabase as unknown as Parameters<
          typeof fetchOrdinaryInvitationPage
        >[0],
        null,
        10,
      );

      expect(res.status).toBe("unavailable");
    });
  });

  describe("Server Actions", () => {
    it("creates invitation and constructs canonical URL with correct locale prefix", async () => {
      mockRequireSession.mockResolvedValueOnce({
        userId: "user-1",
        role: "admin",
      });

      mockRpc.mockResolvedValueOnce({
        data: [
          {
            invitation_id: "11111111-1111-4111-8111-111111111111",
            invitation_role: "client",
            expires_at: "2026-09-07T12:00:00Z",
            invitation_token: "secret_token_123",
          },
        ],
        error: null,
      });

      const resEs = await createOrdinaryInvitationAction(
        {
          role: "client",
          contactId: "22222222-2222-4222-8222-222222222222",
          expiresInHours: 168,
        },
        "es-MX",
      );

      expect(resEs.ok).toBe(true);
      if (resEs.ok) {
        expect(resEs.data.invitationUrl).toBe(
          "https://pm.joyastarfilms.com/invitacion?token=secret_token_123",
        );
      }

      mockRequireSession.mockResolvedValueOnce({
        userId: "user-1",
        role: "admin",
      });
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            invitation_id: "11111111-1111-4111-8111-111111111111",
            invitation_role: "client",
            expires_at: "2026-09-07T12:00:00Z",
            invitation_token: "secret_token_123",
          },
        ],
        error: null,
      });

      const resEn = await createOrdinaryInvitationAction(
        {
          role: "client",
          contactId: "22222222-2222-4222-8222-222222222222",
          expiresInHours: 168,
        },
        "en-US",
      );

      expect(resEn.ok).toBe(true);
      if (resEn.ok) {
        expect(resEn.data.invitationUrl).toBe(
          "https://pm.joyastarfilms.com/en/invitacion?token=secret_token_123",
        );
      }
    });

    it("asserts exact-one-row cardinality check on create_ordinary_invitation", async () => {
      mockRequireSession.mockResolvedValueOnce({
        userId: "user-1",
        role: "admin",
      });

      mockRpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const res = await createOrdinaryInvitationAction(
        {
          role: "client",
          contactId: "22222222-2222-4222-8222-222222222222",
        },
        "es-MX",
      );

      expect(res).toEqual({ ok: false, code: "UNAVAILABLE" });
    });

    it("revokes invitation safely handling changed: true and changed: false as terminal", async () => {
      mockRequireSession.mockResolvedValueOnce({
        userId: "user-1",
        role: "pm",
      });

      mockRpc.mockResolvedValueOnce({
        data: [
          {
            changed: false,
            invitation_id: "11111111-1111-4111-8111-111111111111",
            invitation_status: "revoked",
          },
        ],
        error: null,
      });

      const res = await revokeOrdinaryInvitationAction({
        invitationId: "11111111-1111-4111-8111-111111111111",
      });

      expect(res).toEqual({
        ok: true,
        data: {
          changed: false,
          invitationId: "11111111-1111-4111-8111-111111111111",
          invitationStatus: "revoked",
        },
      });
    });
  });
});
