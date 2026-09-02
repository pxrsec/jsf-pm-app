import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  updateOwnAccountSettingsAction,
  setUserAccessStateAction,
  recordStaleAccessReminderAction,
  submitBugReportAction,
  setBugReportStatusAction,
  loadMoreUserAccessDirectoryAction,
  loadMoreBugReportsAction,
} from "@/lib/account-access/actions";
import { requireSession, AuthError } from "@/lib/auth/session";
import {
  updateOwnAccountSettings,
  setUserAccessState,
  recordStaleAccessReminder,
  submitBugReport,
  setBugReportStatus,
} from "@/lib/account-access/commands";
import {
  fetchUserAccessDirectory,
  fetchBugReports,
} from "@/lib/account-access/queries";
import {
  revalidateAccountScope,
  revalidateManagerScope,
} from "@/lib/account-access/revalidation";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(),
  AuthError: class AuthError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "AuthError";
      this.code = code;
    }
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/account-access/commands", () => ({
  updateOwnAccountSettings: vi.fn(),
  setUserAccessState: vi.fn(),
  recordStaleAccessReminder: vi.fn(),
  submitBugReport: vi.fn(),
  setBugReportStatus: vi.fn(),
}));

vi.mock("@/lib/account-access/queries", () => ({
  fetchUserAccessDirectory: vi.fn(),
  fetchBugReports: vi.fn(),
}));

vi.mock("@/lib/account-access/revalidation", () => ({
  revalidateAccountScope: vi.fn(),
  revalidateManagerScope: vi.fn(),
}));

describe("Account Access Actions", () => {
  const validUuid = "11111111-1111-4111-8111-111111111111";
  const validIso = "2026-09-02T12:00:00.000Z";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateOwnAccountSettingsAction", () => {
    it("returns UNAUTHORIZED on AuthError", async () => {
      vi.mocked(requireSession).mockRejectedValue(
        new AuthError("UNAUTHENTICATED", "No active session"),
      );

      const result = await updateOwnAccountSettingsAction({
        fullName: "Test",
        preferredLocale: "es-MX",
        timezone: "UTC",
        emailNotificationsEnabled: true,
      });
      expect(result).toEqual({ ok: false, error: { code: "UNAUTHORIZED" } });
    });

    it("returns VALIDATION_FAILED on invalid input without calling command", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        role: "client",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      const result = await updateOwnAccountSettingsAction({
        fullName: "", // invalid
        preferredLocale: "es-MX",
        timezone: "UTC",
        emailNotificationsEnabled: true,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });
      expect(updateOwnAccountSettings).not.toHaveBeenCalled();
    });

    it("passes normalized parsed input and triggers revalidateAccountScope on success", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        role: "operator",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);
      vi.mocked(updateOwnAccountSettings).mockResolvedValue({
        ok: true,
        data: {
          fullName: "Trimmed Name",
          preferredLocale: "es-MX",
          timezone: "America/Mexico_City",
          emailNotificationsEnabled: false,
        },
      });

      const result = await updateOwnAccountSettingsAction({
        fullName: "  Trimmed Name  ",
        preferredLocale: "es-MX",
        timezone: "  America/Mexico_City  ",
        emailNotificationsEnabled: false,
      });

      expect(result.ok).toBe(true);
      expect(updateOwnAccountSettings).toHaveBeenCalledWith(expect.anything(), {
        fullName: "Trimmed Name",
        preferredLocale: "es-MX",
        timezone: "America/Mexico_City",
        emailNotificationsEnabled: false,
      });
      expect(revalidateAccountScope).toHaveBeenCalledTimes(1);
    });
  });

  describe("setUserAccessStateAction", () => {
    it("rejects operator and client before RPC invocation", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        role: "operator",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      const result = await setUserAccessStateAction({
        targetUserId: validUuid,
        isActive: true,
      });
      expect(result).toEqual({ ok: false, error: { code: "UNAUTHORIZED" } });
      expect(setUserAccessState).not.toHaveBeenCalled();
    });

    it("revalidates manager scope on success", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        role: "admin",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);
      vi.mocked(setUserAccessState).mockResolvedValue({
        ok: true,
        data: { code: "deactivated" },
      });

      const result = await setUserAccessStateAction({
        targetUserId: validUuid,
        isActive: false,
        confirmationFullName: "Target User",
      });

      expect(result.ok).toBe(true);
      expect(revalidateManagerScope).toHaveBeenCalledTimes(1);
    });

    it("revalidates manager scope on not_found code", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        role: "pm",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);
      vi.mocked(setUserAccessState).mockResolvedValue({
        ok: false,
        error: { code: "not_found" },
      });

      const result = await setUserAccessStateAction({
        targetUserId: validUuid,
        isActive: true,
      });

      expect(result).toEqual({ ok: false, error: { code: "not_found" } });
      expect(revalidateManagerScope).toHaveBeenCalledTimes(1);
    });

    it("does not revalidate manager scope on self_lockout_forbidden", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        role: "admin",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);
      vi.mocked(setUserAccessState).mockResolvedValue({
        ok: false,
        error: { code: "self_lockout_forbidden" },
      });

      const result = await setUserAccessStateAction({
        targetUserId: validUuid,
        isActive: false,
        confirmationFullName: "Admin Self",
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "self_lockout_forbidden" },
      });
      expect(revalidateManagerScope).not.toHaveBeenCalled();
    });
  });

  describe("recordStaleAccessReminderAction", () => {
    it("rejects non-managers before RPC", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        role: "client",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      const result = await recordStaleAccessReminderAction({
        targetUserId: validUuid,
      });
      expect(result).toEqual({ ok: false, error: { code: "UNAUTHORIZED" } });
      expect(recordStaleAccessReminder).not.toHaveBeenCalled();
    });

    it("revalidates manager scope on recorded and on not_eligible_or_already_recorded", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        role: "pm",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      vi.mocked(recordStaleAccessReminder).mockResolvedValueOnce({
        ok: true,
        data: { code: "recorded" },
      });
      await recordStaleAccessReminderAction({ targetUserId: validUuid });
      expect(revalidateManagerScope).toHaveBeenCalledTimes(1);

      vi.mocked(recordStaleAccessReminder).mockResolvedValueOnce({
        ok: false,
        error: { code: "not_eligible_or_already_recorded" },
      });
      await recordStaleAccessReminderAction({ targetUserId: validUuid });
      expect(revalidateManagerScope).toHaveBeenCalledTimes(2);
    });
  });

  describe("submitBugReportAction", () => {
    it("allows clients to submit reports and revalidates only manager scope, never account scope", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        role: "client",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);
      vi.mocked(submitBugReport).mockResolvedValue({
        ok: true,
        data: { reportId: validUuid, status: "open" },
      });

      const result = await submitBugReportAction({
        title: "Client Bug",
        description: "Steps here",
      });

      expect(result.ok).toBe(true);
      expect(revalidateManagerScope).toHaveBeenCalledTimes(1);
      expect(revalidateAccountScope).not.toHaveBeenCalled();
    });
  });

  describe("setBugReportStatusAction", () => {
    it("rejects non-managers with UNAUTHORIZED", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        role: "operator",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      const result = await setBugReportStatusAction({
        reportId: validUuid,
        status: "triaged",
      });
      expect(result).toEqual({ ok: false, error: { code: "UNAUTHORIZED" } });
      expect(setBugReportStatus).not.toHaveBeenCalled();
    });

    it("revalidates manager scope on updated and on not_found_or_unchanged", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        role: "admin",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      vi.mocked(setBugReportStatus).mockResolvedValueOnce({
        ok: true,
        data: { code: "updated" },
      });
      await setBugReportStatusAction({
        reportId: validUuid,
        status: "resolved",
      });
      expect(revalidateManagerScope).toHaveBeenCalledTimes(1);

      vi.mocked(setBugReportStatus).mockResolvedValueOnce({
        ok: false,
        error: { code: "not_found_or_unchanged" },
      });
      await setBugReportStatusAction({
        reportId: validUuid,
        status: "dismissed",
      });
      expect(revalidateManagerScope).toHaveBeenCalledTimes(2);
    });
  });

  describe("loadMore actions (directory & bug reports)", () => {
    it("loadMoreUserAccessDirectoryAction rejects missing or invalid cursor with VALIDATION_FAILED", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        role: "admin",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      expect(await loadMoreUserAccessDirectoryAction(null)).toEqual({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });
      expect(await loadMoreUserAccessDirectoryAction({})).toEqual({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });
      expect(
        await loadMoreUserAccessDirectoryAction({ beforeCreatedAt: validIso }),
      ).toEqual({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });
      expect(fetchUserAccessDirectory).not.toHaveBeenCalled();
    });

    it("loadMoreBugReportsAction converts AvailableResult to AccountAccessActionResult", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        role: "pm",
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      vi.mocked(fetchBugReports).mockResolvedValueOnce({
        status: "available",
        data: {
          items: [],
          nextCursor: null,
          hasMore: false,
        },
      });

      const successResult = await loadMoreBugReportsAction({
        beforeCreatedAt: validIso,
        beforeReportId: validUuid,
      });
      expect(successResult).toEqual({
        ok: true,
        data: {
          items: [],
          nextCursor: null,
          hasMore: false,
        },
      });

      vi.mocked(fetchBugReports).mockResolvedValueOnce({
        status: "unavailable",
      });

      const failResult = await loadMoreBugReportsAction({
        beforeCreatedAt: validIso,
        beforeReportId: validUuid,
      });
      expect(failResult).toEqual({
        ok: false,
        error: { code: "UNAVAILABLE" },
      });
    });
  });
});
