import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockLoggerDebug = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: (...args: unknown[]) => mockLoggerDebug(...args),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { fetchOperationalRecycleBin } from "../queries";

describe("fetchOperationalRecycleBin query adapter", () => {
  it("returns available status with parsed items when rpc succeeds", async () => {
    const mockRpcData = [
      {
        entity_type: "task",
        entity_id: "0640c287-b541-4f12-bace-550f3b438e36",
        project_id: "547a1551-16b5-4ab7-b372-064eaf5cdfef",
        title: "client request test 3",
        archived_at: "2026-09-02T17:02:51.715322Z",
        archived_by: "735aa895-4492-42a3-9622-5ff4ec78ceb2",
        archive_reason: "testing",
        parent_is_archived: false,
      },
      {
        entity_type: "project",
        entity_id: "5a16eccd-049c-4844-b53e-e726084277fa",
        project_id: "5a16eccd-049c-4844-b53e-e726084277fa",
        title: "Acme Teaser 2025",
        archived_at: "2026-08-08T18:01:59.492Z",
        archived_by: null,
        archive_reason: null,
        parent_is_archived: false,
      },
    ];

    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: mockRpcData,
        error: null,
      }),
    };

    const result = await fetchOperationalRecycleBin(mockSupabase as never);

    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].entityType).toBe("task");
      expect(result.data[0].title).toBe("client request test 3");
      expect(result.data[0].parentIsArchived).toBe(false);
      expect(result.data[1].entityType).toBe("project");
      expect(result.data[1].title).toBe("Acme Teaser 2025");
    }
  });

  it("returns unavailable when rpc returns an error", async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "invalid UNION/INTERSECT/EXCEPT ORDER BY clause" },
      }),
    };

    const result = await fetchOperationalRecycleBin(mockSupabase as never);

    expect(result.status).toBe("unavailable");
    expect(mockLoggerDebug).toHaveBeenCalledWith(
      "list_operational_recycle_bin RPC failed",
      expect.objectContaining({
        error: "invalid UNION/INTERSECT/EXCEPT ORDER BY clause",
      }),
    );
  });

  it("returns unavailable when row has invalid entity_type", async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            entity_type: "invalid_type",
            entity_id: "0640c287-b541-4f12-bace-550f3b438e36",
            project_id: "547a1551-16b5-4ab7-b372-064eaf5cdfef",
            title: "broken entity",
            archived_at: "2026-09-02T17:02:51.715322Z",
            archived_by: null,
            archive_reason: null,
            parent_is_archived: false,
          },
        ],
        error: null,
      }),
    };

    const result = await fetchOperationalRecycleBin(mockSupabase as never);
    expect(result.status).toBe("unavailable");
  });

  it("returns unavailable when row has invalid UUID entity_id", async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            entity_type: "task",
            entity_id: "not-a-uuid",
            project_id: "547a1551-16b5-4ab7-b372-064eaf5cdfef",
            title: "broken entity",
            archived_at: "2026-09-02T17:02:51.715322Z",
            archived_by: null,
            archive_reason: null,
            parent_is_archived: false,
          },
        ],
        error: null,
      }),
    };

    const result = await fetchOperationalRecycleBin(mockSupabase as never);
    expect(result.status).toBe("unavailable");
  });

  it("passes projectId correctly to rpc when provided", async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    const projectId = "547a1551-16b5-4ab7-b372-064eaf5cdfef";
    const result = await fetchOperationalRecycleBin(
      mockSupabase as never,
      projectId,
    );

    expect(result.status).toBe("available");
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "list_operational_recycle_bin",
      {
        p_project_id: projectId,
      },
    );
  });
});
