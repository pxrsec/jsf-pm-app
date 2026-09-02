import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import {
  fetchOwnAccountSettings,
  fetchUserAccessDirectory,
  fetchStaleAccessReminderCandidates,
  fetchBugReports,
} from "@/lib/account-access/queries";
import CuentaPage from "@/app/[locale]/(protected)/cuenta/page";
import AdminAccesoPage from "@/app/[locale]/(protected)/admin/acceso/page";
import PmAccesoPage from "@/app/[locale]/(protected)/pm/acceso/page";
import type { AppRole } from "@/lib/account-access/types";

const mockHeadersMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({}),
  headers: vi.fn().mockImplementation(async () => ({
    get: (key: string) => mockHeadersMap.get(key) || null,
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(),
  AuthError: class AuthError extends Error {},
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/account-access/queries", () => ({
  fetchOwnAccountSettings: vi.fn().mockResolvedValue({
    status: "available",
    data: {
      userId: "11111111-1111-4111-8111-111111111111",
      fullName: "Test User",
      preferredLocale: "es-MX",
      timezone: "America/Mexico_City",
      emailNotificationsEnabled: true,
      role: "admin",
    },
  }),
  fetchUserAccessDirectory: vi.fn().mockResolvedValue({
    status: "available",
    data: { items: [], nextCursor: null, hasMore: false },
  }),
  fetchStaleAccessReminderCandidates: vi.fn().mockResolvedValue({
    status: "available",
    data: [],
  }),
  fetchBugReports: vi.fn().mockResolvedValue({
    status: "available",
    data: { items: [], nextCursor: null, hasMore: false },
  }),
}));

vi.mock("@/components/shared/account-access/account-view", () => ({
  AccountView: (props: unknown) => ({ type: "AccountView", props }),
}));

vi.mock("@/components/shared/account-access/manager-access-console", () => ({
  ManagerAccessConsole: (props: unknown) => ({
    type: "ManagerAccessConsole",
    props,
  }),
}));

describe("Account and Access Route Guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeadersMap.clear();
  });

  describe("/cuenta route", () => {
    const allRoles: readonly AppRole[] = ["admin", "pm", "operator", "client"];

    for (const role of allRoles) {
      it(`accepts active ${role} role without redirect`, async () => {
        vi.mocked(requireSession).mockResolvedValue({
          role,
          profile: { timezone: "America/Mexico_City" },
        } as unknown as Awaited<ReturnType<typeof requireSession>>);

        const result = await CuentaPage();
        expect(result).toBeDefined();
        expect(redirect).not.toHaveBeenCalled();
        expect(fetchOwnAccountSettings).toHaveBeenCalledTimes(1);
      });
    }
  });

  describe("/admin/acceso route", () => {
    it("renders for Admin", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        role: "admin",
        profile: { timezone: "America/Mexico_City" },
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      const result = await AdminAccesoPage();
      expect(result).toBeDefined();
      expect(redirect).not.toHaveBeenCalled();
      expect(fetchUserAccessDirectory).toHaveBeenCalledTimes(1);
      expect(fetchStaleAccessReminderCandidates).toHaveBeenCalledTimes(1);
      expect(fetchBugReports).toHaveBeenCalledTimes(1);
    });

    it("redirects PM to /pm (Spanish canonical)", async () => {
      mockHeadersMap.set("x-pathname", "/admin/acceso");
      vi.mocked(requireSession).mockResolvedValue({
        role: "pm",
        profile: { timezone: "America/Mexico_City" },
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      await expect(AdminAccesoPage()).rejects.toThrow("NEXT_REDIRECT:/pm");
    });

    it("redirects PM to /en/pm when request pathname is English", async () => {
      mockHeadersMap.set("x-pathname", "/en/admin/acceso");
      vi.mocked(requireSession).mockResolvedValue({
        role: "pm",
        profile: { timezone: "America/Mexico_City" },
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      await expect(AdminAccesoPage()).rejects.toThrow("NEXT_REDIRECT:/en/pm");
    });

    it("redirects Operator to /operador (or /en/operador)", async () => {
      mockHeadersMap.set("x-pathname", "/admin/acceso");
      vi.mocked(requireSession).mockResolvedValue({
        role: "operator",
        profile: { timezone: "America/Mexico_City" },
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      await expect(AdminAccesoPage()).rejects.toThrow(
        "NEXT_REDIRECT:/operador",
      );
    });

    it("redirects Client to /cliente (or /en/cliente)", async () => {
      mockHeadersMap.set("x-pathname", "/en/admin/acceso");
      vi.mocked(requireSession).mockResolvedValue({
        role: "client",
        profile: { timezone: "America/Mexico_City" },
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      await expect(AdminAccesoPage()).rejects.toThrow(
        "NEXT_REDIRECT:/en/cliente",
      );
    });
  });

  describe("/pm/acceso route", () => {
    it("renders for PM", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        role: "pm",
        profile: { timezone: "America/Mexico_City" },
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      const result = await PmAccesoPage();
      expect(result).toBeDefined();
      expect(redirect).not.toHaveBeenCalled();
      expect(fetchUserAccessDirectory).toHaveBeenCalledTimes(1);
      expect(fetchStaleAccessReminderCandidates).toHaveBeenCalledTimes(1);
      expect(fetchBugReports).toHaveBeenCalledTimes(1);
    });

    it("redirects Admin to /admin (Spanish canonical)", async () => {
      mockHeadersMap.set("x-pathname", "/pm/acceso");
      vi.mocked(requireSession).mockResolvedValue({
        role: "admin",
        profile: { timezone: "America/Mexico_City" },
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      await expect(PmAccesoPage()).rejects.toThrow("NEXT_REDIRECT:/admin");
    });

    it("redirects Admin to /en/admin when pathname is English", async () => {
      mockHeadersMap.set("x-pathname", "/en/pm/acceso");
      vi.mocked(requireSession).mockResolvedValue({
        role: "admin",
        profile: { timezone: "America/Mexico_City" },
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      await expect(PmAccesoPage()).rejects.toThrow("NEXT_REDIRECT:/en/admin");
    });

    it("redirects Operator and Client to their role-default paths", async () => {
      mockHeadersMap.set("x-pathname", "/pm/acceso");
      vi.mocked(requireSession).mockResolvedValue({
        role: "client",
        profile: { timezone: "America/Mexico_City" },
      } as unknown as Awaited<ReturnType<typeof requireSession>>);

      await expect(PmAccesoPage()).rejects.toThrow("NEXT_REDIRECT:/cliente");
    });
  });
});
