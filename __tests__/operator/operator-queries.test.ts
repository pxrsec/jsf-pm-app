import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getOperatorAgenda,
  getOperatorOwnWorkProjects,
  getOperatorOwnWorkProject,
  getOperatorTaskDetail,
  getOperatorDeliverableForSubmission,
  parseTaskResources,
  mapTaskDetailRows,
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
      deliverable_specifications: "Specs 1",
      submission_deadline_at: "2026-08-14T12:00:00Z",
      internal_review_deadline_at: "2026-08-14T12:00:00Z",
      client_delivery_deadline_at: "2026-08-15T12:00:00Z",
      task_resources: [
        {
          id: "r-2",
          name: "Style Guide",
          url: "https://example.com/guide",
          sort_order: 2,
        },
        {
          id: "r-1",
          name: "Brief",
          url: "https://example.com/brief",
          sort_order: 1,
        },
      ],
    },
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
      deliverable_specifications: "Specs 2",
      submission_deadline_at: "2026-08-14T12:00:00Z",
      internal_review_deadline_at: "2026-08-14T12:00:00Z",
      client_delivery_deadline_at: "2026-08-15T12:00:00Z",
      task_resources: [
        {
          id: "r-2",
          name: "Style Guide",
          url: "https://example.com/guide",
          sort_order: 2,
        },
        {
          id: "r-1",
          name: "Brief",
          url: "https://example.com/brief",
          sort_order: 1,
        },
      ],
    },
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
      deliverable_specifications: null,
      submission_deadline_at: null,
      internal_review_deadline_at: null,
      client_delivery_deadline_at: null,
      task_resources: [],
    },
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
      deliverable_specifications: null,
      submission_deadline_at: null,
      internal_review_deadline_at: null,
      client_delivery_deadline_at: null,
      task_resources: null,
    },
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
      deliverable_specifications: null,
      submission_deadline_at: null,
      internal_review_deadline_at: null,
      client_delivery_deadline_at: null,
      task_resources: [],
    },
  ];

  describe("mapAndDeduplicateAgendaRows & parseTaskResources", () => {
    it("deduplicates tasks with multiple deliverables into one item with deliverables array", () => {
      const items = mapAndDeduplicateAgendaRows(mockRows);
      expect(items).toHaveLength(4);
      const overdue = items.find(
        (i) => i.taskId === "00000000-0000-0000-0000-000000000001",
      );
      expect(overdue?.deliverables).toHaveLength(2);
      expect(overdue?.deliverables[0].deliverableId).toBe("d-1");
    });

    it("parses and orders task resources deterministically", () => {
      const resources = parseTaskResources(mockRows[0].task_resources);
      expect(resources).toHaveLength(2);
      expect(resources[0].name).toBe("Brief");
      expect(resources[1].name).toBe("Style Guide");
    });

    it("handles null or malformed task resources safely without throwing", () => {
      expect(parseTaskResources(null)).toEqual([]);
      expect(parseTaskResources("invalid")).toEqual([]);
      expect(parseTaskResources([{ id: "1" }])).toEqual([]);
    });

    it("throws safely on invalid or unrecognized urgency_category", () => {
      const invalidRows = [
        { ...mockRows[0], urgency_category: "invalid_category" },
      ];
      expect(() =>
        mapAndDeduplicateAgendaRows(invalidRows as AgendaViewRow[]),
      ).toThrow(/Invalid or missing urgency_category/);
    });
  });

  describe("mapTaskDetailRows", () => {
    it("maps multiple deliverable rows into single detail view with specifications", () => {
      const detail = mapTaskDetailRows(mockRows.slice(0, 2));
      expect(detail).not.toBeNull();
      expect(detail?.taskId).toBe("00000000-0000-0000-0000-000000000001");
      expect(detail?.resources).toHaveLength(2);
      expect(detail?.deliverables).toHaveLength(2);
      expect(detail?.deliverables[0].deliverableSpecifications).toBe("Specs 1");
      expect(detail?.deliverables[0].submissionDeadlineAt).toBe(
        "2026-08-14T12:00:00Z",
      );
    });

    it("returns null for empty rows", () => {
      expect(mapTaskDetailRows([])).toBeNull();
    });
  });

  describe("getOperatorAgenda", () => {
    it("queries operator_agenda_view with explicit fields", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
        }),
      } as unknown as TypedSupabase;

      const items = await getOperatorAgenda(mockSupabase);
      expect(mockSupabase.from).toHaveBeenCalledWith("operator_agenda_view");
      expect(items).toHaveLength(4);
    });

    it("handles database error gracefully by throwing an error", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Database error" },
          }),
        }),
      } as unknown as TypedSupabase;

      await expect(getOperatorAgenda(mockSupabase)).rejects.toThrow(
        "Failed to fetch operator agenda",
      );
    });
  });

  describe("getOperatorOwnWorkProjects & getOperatorOwnWorkProject", () => {
    it("groups and derives project summary stats", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
        }),
      } as unknown as TypedSupabase;

      const projects = await getOperatorOwnWorkProjects(mockSupabase);
      expect(projects).toHaveLength(2);
      expect(projects[0].projectName).toBe("Alpha Project");
      expect(projects[0].ownTaskCount).toBe(2);
    });

    it("returns project detail when matching rows exist", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi
              .fn()
              .mockResolvedValue({ data: mockRows.slice(0, 2), error: null }),
          }),
        }),
      } as unknown as TypedSupabase;

      const result = await getOperatorOwnWorkProject(
        mockSupabase,
        "10000000-0000-0000-0000-000000000001",
      );
      expect(result?.projectName).toBe("Alpha Project");
      expect(result?.tasks).toHaveLength(1);
    });

    it("returns null for invalid UUID format", async () => {
      const mockSupabase = {} as TypedSupabase;
      expect(
        await getOperatorOwnWorkProject(mockSupabase, "invalid-uuid"),
      ).toBeNull();
    });
  });

  describe("getOperatorTaskDetail", () => {
    it("queries operator_agenda_view for task detail with explicit fields", async () => {
      const selectMock = vi.fn().mockReturnValue({
        eq: vi
          .fn()
          .mockResolvedValue({ data: mockRows.slice(0, 2), error: null }),
      });
      const rpcMock = vi.fn().mockResolvedValue({
        data: [
          {
            milestone_id: "m-1",
            title: "Sprint Milestone",
            scope: "project",
            target_date: "2026-09-01",
          },
        ],
        error: null,
      });
      const mockSupabase = {
        from: vi.fn().mockReturnValue({ select: selectMock }),
        rpc: rpcMock,
      } as unknown as TypedSupabase;

      const result = await getOperatorTaskDetail(
        mockSupabase,
        "00000000-0000-0000-0000-000000000001",
      );
      expect(mockSupabase.from).toHaveBeenCalledWith("operator_agenda_view");
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "list_operator_task_milestone_context",
        { p_task_id: "00000000-0000-0000-0000-000000000001" },
      );
      expect(result).not.toBeNull();
      expect(result?.taskTitle).toBe("Overdue Task");
      expect(result?.resources).toHaveLength(2);
      expect(result?.deliverables).toHaveLength(2);
      expect(result?.milestoneContext).toEqual([
        {
          title: "Sprint Milestone",
          scope: "project",
          targetDate: "2026-09-01",
        },
      ]);
    });

    it("returns null for invalid UUID format", async () => {
      const mockSupabase = {} as TypedSupabase;
      expect(
        await getOperatorTaskDetail(mockSupabase, "invalid-uuid"),
      ).toBeNull();
    });

    it("returns null when no matching rows found (non-visible or absent task)", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      } as unknown as TypedSupabase;

      const result = await getOperatorTaskDetail(
        mockSupabase,
        "90000000-0000-0000-0000-000000000009",
      );
      expect(result).toBeNull();
    });
  });

  describe("getOperatorDeliverableForSubmission", () => {
    it("queries operator_agenda_view and returns visible target record regardless of status", async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: {
          task_id: "00000000-0000-0000-0000-000000000001",
          project_id: "10000000-0000-0000-0000-000000000001",
          deliverable_id: "00000000-0000-0000-0000-0000000000d1",
          deliverable_title: "Deliverable 1",
          deliverable_workflow_type: "production",
          deliverable_status: "pending",
        },
        error: null,
      });
      const limitMock = vi
        .fn()
        .mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqMock = vi.fn().mockReturnValue({ limit: limitMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      const mockSupabase = {
        from: vi.fn().mockReturnValue({ select: selectMock }),
      } as unknown as TypedSupabase;

      const target = await getOperatorDeliverableForSubmission(
        mockSupabase,
        "00000000-0000-0000-0000-0000000000d1",
      );
      expect(mockSupabase.from).toHaveBeenCalledWith("operator_agenda_view");
      expect(target).not.toBeNull();
      expect(target?.deliverableTitle).toBe("Deliverable 1");
      expect(target?.deliverableWorkflowType).toBe("production");
    });

    it("returns null for invalid UUID format or absent deliverable", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      } as unknown as TypedSupabase;

      expect(
        await getOperatorDeliverableForSubmission(mockSupabase, "invalid-uuid"),
      ).toBeNull();
      expect(
        await getOperatorDeliverableForSubmission(
          mockSupabase,
          "90000000-0000-0000-0000-000000000009",
        ),
      ).toBeNull();
    });
  });
});
