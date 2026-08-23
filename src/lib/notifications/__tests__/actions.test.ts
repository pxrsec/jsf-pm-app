import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockCookies = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

const mockRequireSession = vi.fn();
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
    requireSession: (cookieStore: unknown) => mockRequireSession(cookieStore),
  };
});

const mockRpc = vi.fn();
const mockCreateClient = vi.fn(() => ({
  rpc: (...args: unknown[]) => mockRpc(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

const mockListRecipientInboxPage = vi.fn();
vi.mock("../queries", () => ({
  listRecipientInboxPage: (supabase: unknown, cursor: unknown) =>
    mockListRecipientInboxPage(supabase, cursor),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  loadRecipientInboxPageAction,
} from "../actions";
import { AuthError } from "@/lib/auth/session";

describe("TC-NOTIF-ACT: Notification Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({} as never);
    mockRequireSession.mockResolvedValue({
      user: { id: "user-1" },
      profile: {
        id: "user-1",
        role: "operator",
        is_active: true,
        deleted_at: null,
      },
      role: "operator",
    });
  });

  describe("markNotificationReadAction", () => {
    it("1. Rejects non-UUID input with VALIDATION_FAILED before session/client creation", async () => {
      const result = await markNotificationReadAction({
        notificationRecipientId: "not-a-uuid",
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });
      expect(mockRequireSession).not.toHaveBeenCalled();
      expect(mockCreateClient).not.toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("2. Maps AuthError to UNAUTHENTICATED", async () => {
      mockRequireSession.mockRejectedValueOnce(
        new AuthError("UNAUTHENTICATED", "No active session"),
      );

      const result = await markNotificationReadAction({
        notificationRecipientId: "00000000-0000-0000-0000-000000000001",
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "UNAUTHENTICATED" },
      });
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("3. Re-throws unexpected non-AuthError exceptions to route boundary", async () => {
      mockRequireSession.mockRejectedValueOnce(
        new Error("Unexpected DB crash"),
      );

      await expect(
        markNotificationReadAction({
          notificationRecipientId: "00000000-0000-0000-0000-000000000001",
        }),
      ).rejects.toThrow("Unexpected DB crash");
    });

    it("4. Calls RPC with exact recipient UUID", async () => {
      mockRpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await markNotificationReadAction({
        notificationRecipientId: "00000000-0000-0000-0000-000000000001",
      });

      expect(mockRpc).toHaveBeenCalledWith("mark_notification_read", {
        p_notification_recipient_id: "00000000-0000-0000-0000-000000000001",
      });
      expect(result).toEqual({ ok: true, changed: true });
    });

    it("5. Maps RPC error to UNAVAILABLE and skips cache invalidation", async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Internal RPC error" },
      });

      const result = await markNotificationReadAction({
        notificationRecipientId: "00000000-0000-0000-0000-000000000001",
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "UNAVAILABLE" },
      });
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it("6. Revalidates paths on successful or idempotent completion", async () => {
      mockRpc.mockResolvedValueOnce({ data: false, error: null });

      const result = await markNotificationReadAction({
        notificationRecipientId: "00000000-0000-0000-0000-000000000001",
      });

      expect(result).toEqual({ ok: true, changed: false });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/notificaciones");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/en/notificaciones");
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        "/[locale]/(protected)",
        "layout",
      );
    });
  });

  describe("markAllNotificationsReadAction", () => {
    it("1. Accepts undefined input and normalizes to empty object", async () => {
      mockRpc.mockResolvedValueOnce({ data: 3, error: null });

      const result = await markAllNotificationsReadAction();

      expect(mockRpc).toHaveBeenCalledWith("mark_all_notifications_read");
      expect(result).toEqual({ ok: true, changed: true, changedCount: 3 });
    });

    it("2. Rejects invalid inputs with unexpected keys with VALIDATION_FAILED", async () => {
      const result = await markAllNotificationsReadAction({
        extraKey: "forbidden",
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("3. Maps AuthError to UNAUTHENTICATED and re-throws unexpected errors", async () => {
      mockRequireSession.mockRejectedValueOnce(
        new AuthError("INACTIVE_OR_MISSING_PROFILE", "Inactive user"),
      );

      const result = await markAllNotificationsReadAction();
      expect(result).toEqual({
        ok: false,
        error: { code: "UNAUTHENTICATED" },
      });
    });

    it("4. Maps RPC error to UNAVAILABLE and skips cache invalidation", async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: "RPC failed" },
      });

      const result = await markAllNotificationsReadAction();
      expect(result).toEqual({
        ok: false,
        error: { code: "UNAVAILABLE" },
      });
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it("5. Handles idempotent 0 count and triggers cache invalidation", async () => {
      mockRpc.mockResolvedValueOnce({ data: 0, error: null });

      const result = await markAllNotificationsReadAction();

      expect(result).toEqual({ ok: true, changed: false, changedCount: 0 });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/notificaciones");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/en/notificaciones");
    });
  });

  describe("loadRecipientInboxPageAction", () => {
    it("1. Rejects malformed timestamp or UUID with VALIDATION_FAILED before session check", async () => {
      const result = await loadRecipientInboxPageAction({
        beforeCreatedAt: "bad-date",
        beforeRecipientId: "00000000-0000-0000-0000-000000000001",
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });
      expect(mockRequireSession).not.toHaveBeenCalled();
    });

    it("2. Maps AuthError to UNAUTHENTICATED", async () => {
      mockRequireSession.mockRejectedValueOnce(
        new AuthError("UNAUTHENTICATED", "No active session"),
      );

      const result = await loadRecipientInboxPageAction({
        beforeCreatedAt: "2026-08-22T12:00:00.000Z",
        beforeRecipientId: "00000000-0000-0000-0000-000000000001",
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "UNAUTHENTICATED" },
      });
    });

    it("3. Maps query failure to UNAVAILABLE", async () => {
      mockListRecipientInboxPage.mockRejectedValueOnce(
        new Error("Failed to fetch notification inbox"),
      );

      const result = await loadRecipientInboxPageAction({
        beforeCreatedAt: "2026-08-22T12:00:00.000Z",
        beforeRecipientId: "00000000-0000-0000-0000-000000000001",
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "UNAVAILABLE" },
      });
    });

    it("4. Returns safe page data and does not call revalidatePath", async () => {
      const mockPage = {
        notifications: [
          {
            recipientId: "00000000-0000-0000-0000-000000000001",
            trigger: "task_assigned" as const,
            createdAt: "2026-08-22T12:00:00.000Z",
            occurredAt: "2026-08-22T12:00:00.000Z",
            readAt: null,
          },
        ],
        nextCursor: null,
        hasMore: false,
      };
      mockListRecipientInboxPage.mockResolvedValueOnce(mockPage);

      const result = await loadRecipientInboxPageAction({
        beforeCreatedAt: "2026-08-22T12:00:00.000Z",
        beforeRecipientId: "00000000-0000-0000-0000-000000000001",
      });

      expect(result).toEqual({
        ok: true,
        data: mockPage,
      });
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });
});
