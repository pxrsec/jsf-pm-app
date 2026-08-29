import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { fetchCalendarFeed, fetchMilestoneManagementTargets } from "../queries";

describe("calendar projections", () => {
  it("preserves deadline rows and derives milestone scope from project id", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({
        data: [
          {
            entity_id: "00000000-0000-0000-0000-000000000001",
            project_id: null,
            project_name: null,
            task_id: null,
            title: "Company goal",
            event_type: "milestone",
            starts_at: "2026-08-15T00:00:00-06:00",
            ends_at: null,
            is_all_day: true,
            color_override: null,
          },
        ],
        error: null,
      });
    const events = await fetchCalendarFeed({ rpc } as never, {
      from: "2026-08-01T00:00:00-06:00",
      to: "2026-09-01T00:00:00-06:00",
    });
    expect(events[0].milestone_scope).toBe("company");
  });
  it("uses only the first-class management target RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    await fetchMilestoneManagementTargets({ rpc } as never);
    expect(rpc).toHaveBeenCalledWith("list_milestone_management_targets");
  });
});
