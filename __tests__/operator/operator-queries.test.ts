import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getOperatorAgenda,
  getOperatorOwnWorkProjects,
  getOperatorOwnWorkProject,
  mapAndDeduplicateAgendaRows,
} from "@/lib/operator/queries";
import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type TypedSupabase = SupabaseClient<Database>;
type AgendaViewRow = Database["public"]["Views"]["operator_agenda_view"]["Row"];

describe("Operator Queries (src/lib/operator/queries.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockRows: AgendaViewRow[] = [
    {
      task_id: "00000000-0000-0000-0000-000000000001",
      task_title: "Overdue Task",
      task_description: "Overdue task details",
      task_status: "in_progress",
      task_priority: "high",
      task_started_at: "2026-08-10T10:00:00Z",
      task_deadline_at: "2026-08-15T12:00:00Z",
      assigned_at: "2026-08-09T10:00:00Z",
      urgency_category: "overdue",
      project_id: "10000000-0000-0000-0000-000000000001",
      project_name: "Alpha Project",
      deliverable_id: "d-1",
      deliverable_title: "Deliverable 1",
      deliverable_status: "pending",
      deliverable_workflow_type: "production",
      current_version_number: 1,
      internal_review_deadline_at: "2026-08-14T12:00:00Z",
      client_delivery_deadline_at: "2026-08-15T12:00:00Z",
    },
    // Second deliverable for the same task
    {
      task_id: "00000000-0000-0000-0000-000000000001",
      task_title: "Overdue Task",
      task_description: "Overdue task details",
      task_status: "in_progress",
      task_priority: "high",
      task_started_at: "2026-08-10T10:00:00Z",
      task_deadline_at: "2026-08-15T12:00:00Z",
      assigned_at: "2026-08-09T10:00:00Z",
      urgency_category: "overdue",
      project_id: "10000000-0000-0000-0000-000000000001",
      project_name: "Alpha Project",
      deliverable_id: "d-2",
      deliverable_title: "Deliverable 2",
      deliverable_status: "changes_requested",
      deliverable_workflow_type: "production",
      current_version_number: 2,
      internal_review_deadline_at: "2026-08-14T12:00:00Z",
      client_delivery_deadline_at: "2026-08-15T12:00:00Z",
    },
    // Urgent task
    {
      task_id: "00000000-0000-0000-0000-000000000002",
      task_title: "Urgent Task",
      task_description: null,
      task_status: "pending",
      task_priority: "blocking",
      task_started_at: null,
      task_deadline_at: "2026-08-22T08:00:00Z",
      assigned_at: "2026-08-18T10:00:00Z",
      urgency_category: "urgent",
      project_id: "10000000-0000-0000-0000-000000000001",
      project_name: "Alpha Project",
      deliverable_id: null,
      deliverable_title: null,
      deliverable_status: null,
      deliverable_workflow_type: null,
      current_version_number: null,
      internal_review_deadline_at: null,
      client_delivery_deadline_at: null,
    },
    // New task
    {
      task_id: "00000000-0000-0000-0000-000000000003",
      task_title: "New Task",
      task_description: "New task notes",
      task_status: "pending",
      task_priority: "medium",
      task_started_at: null,
      task_deadline_at: "2026-08-30T12:00:00Z",
      assigned_at: "2026-08-21T14:00:00Z",
      urgency_category: "new",
      project_id: "20000000-0000-0000-0000-000000000002",
      project_name: "Beta Project",
      deliverable_id: null,
      deliverable_title: null,
      deliverable_status: null,
      deliverable_workflow_type: null,
      current_version_number: null,
      internal_review_deadline_at: null,
      client_delivery_deadline_at: null,
    },
    // Completed task
    {
      task_id: "00000000-0000-0000-0000-000000000004",
      task_title: "Completed Task",
      task_description: null,
      task_status: "completed",
      task_priority: "low",
      task_started_at: "2026-08-20T10:00:00Z",
      task_deadline_at: "2026-08-21T10:00:00Z",
      assigned_at: "2026-08-19T10:00:00Z",
      urgency_category: "completed",
      project_id: "20000000-0000-0000-0000-000000000002",
      project_name: "Beta Project",
      deliverable_id: "d-3",
      deliverable_title: "Deliverable 3",
      deliverable_status: "approved",
      deliverable_workflow_type: "production",
      current_version_number: 1,
      internal_review_deadline_at: null,
      client_delivery_deadline_at: null,
    },
  ];

  describe("mapAndDeduplicateAgendaRows", () => {
    it("deduplicates tasks with multiple deliverables into one item with deliverables array", () => {
      const items = mapAndDeduplicateAgendaRows(mockRows);

      expect(items).toHaveLength(4);
      const overdueItem = items.find(
        (i) => i.taskId === "00000000-0000-0000-0000-000000000001",
      );
      expect(overdueItem).toBeDefined();
      expect(overdueItem?.deliverables).toHaveLength(2);
      expect(overdueItem?.deliverables[0].deliverableId).toBe("d-1");
      expect(overdueItem?.deliverables[1].deliverableId).toBe("d-2");
    });

    it("throws safely on invalid or unrecognized urgency_category", () => {
      const invalidRows: AgendaViewRow[] = [
        {
          task_id: "t-invalid",
          task_title: "Invalid Task",
          task_description: null,
          task_status: "pending",
          task_priority: "medium",
          task_started_at: null,
          task_deadline_at: null,
          assigned_at: null,
          urgency_category: "invalid_category",
          project_id: "10000000-0000-0000-0000-000000000001",
          project_name: "Alpha Project",
          deliverable_id: null,
          deliverable_title: null,
          deliverable_status: null,
          deliverable_workflow_type: null,
          current_version_number: null,
          internal_review_deadline_at: null,
          client_delivery_deadline_at: null,
        },
      ];

      expect(() => mapAndDeduplicateAgendaRows(invalidRows)).toThrow(
        /Invalid or missing urgency_category/,
      );
    });
  });

  describe("sortAgendaItems (Section 5.3 Fallback Order)", () => {
    it("sorts items in canonical urgency order: overdue -> urgent -> upcoming -> new -> normal -> completed", () => {
      const items = mapAndDeduplicateAgendaRows(mockRows);
      const categories = items.map((i) => i.urgencyCategory);

      expect(categories).toEqual(["overdue", "urgent", "new", "completed"]);
    });

    it("uses deterministic task ID tie-breaker when categories and deadlines are equal", () => {
      const tieRows: AgendaViewRow[] = [
        {
          task_id: "00000000-0000-0000-0000-00000000000b",
          task_title: "Task B",
          task_description: null,
          task_status: "pending",
          task_priority: "medium",
          task_started_at: null,
          task_deadline_at: "2026-08-25T12:00:00Z",
          assigned_at: "2026-08-20T10:00:00Z",
          urgency_category: "normal",
          project_id: "10000000-0000-0000-0000-000000000001",
          project_name: "Alpha Project",
          deliverable_id: null,
          deliverable_title: null,
          deliverable_status: null,
          deliverable_workflow_type: null,
          current_version_number: null,
          internal_review_deadline_at: null,
          client_delivery_deadline_at: null,
        },
        {
          task_id: "00000000-0000-0000-0000-00000000000a",
          task_title: "Task A",
          task_description: null,
          task_status: "pending",
          task_priority: "medium",
          task_started_at: null,
          task_deadline_at: "2026-08-25T12:00:00Z",
          assigned_at: "2026-08-20T10:00:00Z",
          urgency_category: "normal",
          project_id: "10000000-0000-0000-0000-000000000001",
          project_name: "Alpha Project",
          deliverable_id: null,
          deliverable_title: null,
          deliverable_status: null,
          deliverable_workflow_type: null,
          current_version_number: null,
          internal_review_deadline_at: null,
          client_delivery_deadline_at: null,
        },
      ];

      const sorted = mapAndDeduplicateAgendaRows(tieRows);
      expect(sorted[0].taskId).toBe("00000000-0000-0000-0000-00000000000a");
      expect(sorted[1].taskId).toBe("00000000-0000-0000-0000-00000000000b");
    });
  });

  describe("getOperatorAgenda", () => {
    it("selects only explicit safe fields from operator_agenda_view", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: mockRows,
        error: null,
      });

      const mockSupabase = {
        from: vi.fn((tableName: string) => {
          expect(tableName).toBe("operator_agenda_view");
          return {
            select: mockSelect,
          };
        }),
      } as unknown as TypedSupabase;

      const result = await getOperatorAgenda(mockSupabase);

      expect(mockSupabase.from).toHaveBeenCalledWith("operator_agenda_view");
      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining("task_id, task_title"),
      );
      expect(result).toHaveLength(4);
    });

    it("handles database error gracefully by throwing an error", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Database query error" },
          }),
        }),
      } as unknown as TypedSupabase;

      await expect(getOperatorAgenda(mockSupabase)).rejects.toThrow(
        "Failed to fetch operator agenda",
      );
    });
  });

  describe("getOperatorOwnWorkProjects", () => {
    it("groups only returned own agenda rows by project_id and computes distinct own task counts", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: mockRows,
            error: null,
          }),
        }),
      } as unknown as TypedSupabase;

      const projects = await getOperatorOwnWorkProjects(mockSupabase);

      expect(projects).toHaveLength(2);

      const alpha = projects.find(
        (p) => p.projectId === "10000000-0000-0000-0000-000000000001",
      );
      expect(alpha).toBeDefined();
      expect(alpha?.projectName).toBe("Alpha Project");
      expect(alpha?.ownTaskCount).toBe(2); // 2 distinct tasks (overdue & urgent)
      expect(alpha?.activeTaskCount).toBe(2);
      expect(alpha?.completedTaskCount).toBe(0);
      expect(alpha?.urgencyCategories).toContain("overdue");
      expect(alpha?.urgencyCategories).toContain("urgent");

      const beta = projects.find(
        (p) => p.projectId === "20000000-0000-0000-0000-000000000002",
      );
      expect(beta).toBeDefined();
      expect(beta?.ownTaskCount).toBe(2); // 1 new + 1 completed
      expect(beta?.activeTaskCount).toBe(1);
      expect(beta?.completedTaskCount).toBe(1);
      expect(beta?.urgencyCategories).toContain("new");
      expect(beta?.urgencyCategories).toContain("completed");
    });
  });

  describe("getOperatorOwnWorkProject", () => {
    it("returns null for invalid UUID format", async () => {
      const mockSupabase = {} as TypedSupabase;
      const result = await getOperatorOwnWorkProject(
        mockSupabase,
        "invalid-uuid-format",
      );
      expect(result).toBeNull();
    });

    it("returns project detail when matching rows exist", async () => {
      const alphaRows = mockRows.filter(
        (r) => r.project_id === "10000000-0000-0000-0000-000000000001",
      );

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: alphaRows,
              error: null,
            }),
          }),
        }),
      } as unknown as TypedSupabase;

      const result = await getOperatorOwnWorkProject(
        mockSupabase,
        "10000000-0000-0000-0000-000000000001",
      );

      expect(result).not.toBeNull();
      expect(result?.projectId).toBe("10000000-0000-0000-0000-000000000001");
      expect(result?.projectName).toBe("Alpha Project");
      expect(result?.tasks).toHaveLength(2);
    });

    it("returns null when no rows match (non-visible or absent project)", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      } as unknown as TypedSupabase;

      const result = await getOperatorOwnWorkProject(
        mockSupabase,
        "30000000-0000-0000-0000-000000000003",
      );

      expect(result).toBeNull();
    });
  });
});
