// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, cleanup } from "@testing-library/react";
import AdminMetricsPage from "./page";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import {
  fetchScopedMetricsProjectFilterOptions,
  fetchScopedOperationsMetrics,
  fetchScopedOperationsMetricTrend,
} from "@/lib/operations-metrics/queries";
import { fetchScopedUserOperationsMetrics } from "@/lib/user-operations-metrics/queries";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT: ${url}`);
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/metricas",
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "es-MX",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/operations-metrics/queries", () => ({
  fetchScopedMetricsProjectFilterOptions: vi.fn(),
  fetchScopedOperationsMetrics: vi.fn(),
  fetchScopedOperationsMetricTrend: vi.fn(),
}));

vi.mock("@/lib/user-operations-metrics/queries", () => ({
  fetchScopedUserOperationsMetrics: vi.fn(),
}));

describe("AdminMetricsPage (admin/metricas/page.tsx)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const validFrom = "2026-05-26T00:00:00-06:00";
  const validTo = "2026-08-24T00:00:00-06:00";
  const validProjectId = "a0000000-0000-0000-0000-000000000001";

  const mockMetricsSummary = {
    projectCountsByStatus: {
      planning: 0,
      in_progress: 0,
      paused: 0,
      completed: 1,
      cancelled: 0,
    },
    activeTaskCount: 5,
    overdueTaskCount: 1,
    deadlineAttentionCount: 8,
    productionDeliverableCountsByStatus: {
      pending: 0,
      awaiting_internal_review: 0,
      awaiting_client_review: 0,
      approved: 0,
      changes_requested: 0,
      delivered: 0,
      submitted: 0,
    },
    finalizedDeliverableCount: 3,
    clientReviewCycleCount: 0,
    averageClientReviewHours: null,
    completionCycleCount: 1,
    reopeningCycleCount: 0,
    averageCompletionCycleDurationDays: null,
    unreadInAppQueueCount: null,
    suppressedExternalQueueCount: 0,
    unresolvedLinkReportCount: 0,
    rangeFrom: validFrom,
    rangeTo: validTo,
  };

  it("1. Redirects non-admin role to default path", async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({
      user: { id: "u-1" },
      role: "pm",
    } as unknown as Awaited<ReturnType<typeof requireSession>>);

    await expect(
      AdminMetricsPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_REDIRECT: /pm");

    expect(redirect).toHaveBeenCalledWith("/pm");
  });

  it("2. Preserves selected project scope for M3/M5 on projects tab without invoking User Audit", async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({
      user: { id: "u-admin" },
      role: "admin",
    } as unknown as Awaited<ReturnType<typeof requireSession>>);

    vi.mocked(fetchScopedMetricsProjectFilterOptions).mockResolvedValueOnce({
      status: "available",
      data: [{ id: validProjectId, name: "Project Alpha" }],
    });

    vi.mocked(fetchScopedOperationsMetrics).mockResolvedValueOnce({
      status: "available",
      data: mockMetricsSummary,
    });

    vi.mocked(fetchScopedOperationsMetricTrend).mockResolvedValueOnce({
      status: "available",
      data: [],
    });

    const pageElement = await AdminMetricsPage({
      searchParams: Promise.resolve({
        from: validFrom,
        to: validTo,
        projectId: validProjectId,
      }),
    });

    render(pageElement);

    expect(fetchScopedOperationsMetrics).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        from: validFrom,
        to: validTo,
        projectId: validProjectId,
      }),
      "admin",
    );

    expect(fetchScopedOperationsMetricTrend).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        from: validFrom,
        to: validTo,
        projectId: validProjectId,
      }),
      "admin",
    );

    expect(fetchScopedUserOperationsMetrics).not.toHaveBeenCalled();
  });

  it("3. Fetches User Audit with validated projectId on users tab without invoking M3/M5", async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({
      user: { id: "u-admin" },
      role: "admin",
    } as unknown as Awaited<ReturnType<typeof requireSession>>);

    vi.mocked(fetchScopedMetricsProjectFilterOptions).mockResolvedValueOnce({
      status: "available",
      data: [{ id: validProjectId, name: "Project Alpha" }],
    });

    vi.mocked(fetchScopedUserOperationsMetrics).mockResolvedValueOnce({
      status: "available",
      data: [],
    });

    const pageElement = await AdminMetricsPage({
      searchParams: Promise.resolve({
        tab: "users",
        from: validFrom,
        to: validTo,
        projectId: validProjectId,
        userId: "b0000000-0000-0000-0000-000000000002",
      }),
    });

    render(pageElement);

    expect(fetchScopedUserOperationsMetrics).toHaveBeenCalledWith(
      expect.anything(),
      {
        from: validFrom,
        to: validTo,
        projectId: validProjectId,
        userId: undefined,
      },
      "admin",
    );

    expect(fetchScopedOperationsMetrics).not.toHaveBeenCalled();
    expect(fetchScopedOperationsMetricTrend).not.toHaveBeenCalled();
  });

  it("4. Unmatched projectId falls back to undefined for User Audit without redirect", async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({
      user: { id: "u-admin" },
      role: "admin",
    } as unknown as Awaited<ReturnType<typeof requireSession>>);

    vi.mocked(fetchScopedMetricsProjectFilterOptions).mockResolvedValueOnce({
      status: "available",
      data: [{ id: validProjectId, name: "Project Alpha" }],
    });

    vi.mocked(fetchScopedUserOperationsMetrics).mockResolvedValueOnce({
      status: "available",
      data: [],
    });

    const pageElement = await AdminMetricsPage({
      searchParams: Promise.resolve({
        tab: "users",
        from: validFrom,
        to: validTo,
        projectId: "unmatched-project-uuid",
      }),
    });

    render(pageElement);

    expect(fetchScopedUserOperationsMetrics).toHaveBeenCalledWith(
      expect.anything(),
      {
        from: validFrom,
        to: validTo,
        projectId: undefined,
        userId: undefined,
      },
      "admin",
    );
    expect(redirect).not.toHaveBeenCalled();
  });
});
