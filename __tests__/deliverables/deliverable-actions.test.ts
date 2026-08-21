import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { mockSupabase, mockSession } = vi.hoisted(() => {
  const mockSession = {
    user: { id: "user-pm-lead-1", email: "lead@joya.test" },
    role: "pm",
    profile: {
      id: "user-pm-lead-1",
      full_name: "PM Lead User",
      role: "pm",
    },
  };

  const mockSupabase = {
    rpc: vi.fn(),
    from: vi.fn(),
  };

  return { mockSupabase, mockSession };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    setAll: vi.fn(),
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi
    .fn()
    .mockImplementation(() => Promise.resolve(mockSession)),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockReturnValue(mockSupabase),
}));

import {
  createDeliverableAction,
  updateDeliverableAction,
  archiveDeliverableAction,
  submitDeliverableVersionAction,
  reportDeliverableLinkAction,
} from "@/lib/deliverables/actions";

describe("Deliverable Server Actions", () => {
  const validProjectId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const validTaskId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
  const validAssigneeId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
  const validDeliverableId = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
  const validVersionId = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55";
  const validDriveUrl = "https://drive.google.com/file/d/12345/view";

  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user.id = "user-pm-lead-1";
    mockSession.role = "pm";
  });

  describe("createDeliverableAction", () => {
    it("rejects when actor is PM Watcher in target project", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "project_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { member_type: "pm_watcher" },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await createDeliverableAction({
        project_id: validProjectId,
        task_id: validTaskId,
        assignee_id: validAssigneeId,
        title: "Test Deliverable",
        specifications: "Specs",
        workflow_type: "production",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });

    it("rejects when project is not client type or lacks client organization", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "project_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { member_type: "pm_lead" },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "projects") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: validProjectId,
                      project_type: "internal",
                      status: "in_progress",
                      client_id: null,
                    },
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await createDeliverableAction({
        project_id: validProjectId,
        task_id: validTaskId,
        assignee_id: validAssigneeId,
        title: "Test Deliverable",
        specifications: "Specs",
        workflow_type: "production",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVARIANT_VIOLATION");
      }
    });

    it("creates deliverable successfully when all eligibility gates pass", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "project_members") {
          return {
            select: vi.fn().mockImplementation((cols: string) => {
              if (cols === "member_type") {
                // pm lead check
                return {
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      is: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { member_type: "pm_lead" },
                        }),
                      }),
                    }),
                  }),
                };
              }
              if (cols.includes("member_type, profiles!inner")) {
                // assignee check
                return {
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      is: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                          maybeSingle: vi.fn().mockResolvedValue({
                            data: {
                              member_type: "operator",
                              profiles: { is_active: true },
                            },
                          }),
                        }),
                      }),
                    }),
                  }),
                };
              }
              // client members check
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    is: vi.fn().mockReturnValue({
                      eq: vi.fn().mockResolvedValue({
                        data: [{ id: "client-member-1" }],
                      }),
                    }),
                  }),
                }),
              };
            }),
          };
        }
        if (table === "projects") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: validProjectId,
                      project_type: "client",
                      status: "in_progress",
                      client_id: "client-org-1",
                    },
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "tasks") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: validTaskId,
                        project_id: validProjectId,
                        has_deliverables: true,
                      },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "deliverables") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: validDeliverableId,
                    project_id: validProjectId,
                    task_id: validTaskId,
                    title: "Test Deliverable",
                    status: "pending",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await createDeliverableAction({
        project_id: validProjectId,
        task_id: validTaskId,
        assignee_id: validAssigneeId,
        title: "Test Deliverable",
        specifications: "Specs",
        workflow_type: "production",
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("updateDeliverableAction", () => {
    it("rejects editing when deliverable is in review state", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "project_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { member_type: "pm_lead" },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "deliverables") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: validDeliverableId,
                        status: "awaiting_internal_review",
                      },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await updateDeliverableAction({
        deliverableId: validDeliverableId,
        projectId: validProjectId,
        input: { title: "Updated Title" },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_TRANSITION");
      }
    });
  });

  describe("archiveDeliverableAction", () => {
    it("rejects PM Watcher from archiving deliverable", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "project_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { member_type: "pm_watcher" },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await archiveDeliverableAction({
        deliverableId: validDeliverableId,
        projectId: validProjectId,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("submitDeliverableVersionAction", () => {
    it("rejects raw submission URL with whitespace without trimming", async () => {
      const result = await submitDeliverableVersionAction({
        deliverable_id: validDeliverableId,
        submission_url: " https://drive.google.com/file/d/123/view ",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("submits version successfully when actor is assigned operator", async () => {
      mockSession.user.id = validAssigneeId;
      mockSession.role = "operator";

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "deliverables") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: validDeliverableId,
                      project_id: validProjectId,
                      assignee_id: validAssigneeId,
                      status: "pending",
                    },
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      mockSupabase.rpc.mockResolvedValue({
        data: {
          deliverable_id: validDeliverableId,
          version_id: validVersionId,
          version_number: 1,
        },
        error: null,
      });

      const result = await submitDeliverableVersionAction({
        deliverable_id: validDeliverableId,
        submission_url: validDriveUrl,
        submission_note: "Initial version",
      });

      expect(result.ok).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "submit_deliverable_version",
        expect.objectContaining({
          p_deliverable_id: validDeliverableId,
          p_submission_url: validDriveUrl,
        }),
      );
    });
  });

  describe("reportDeliverableLinkAction", () => {
    it("allows active PM Watcher to report broken link", async () => {
      mockSession.user.id = "user-watcher-1";
      mockSession.role = "pm";

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "deliverables") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: validDeliverableId,
                      project_id: validProjectId,
                    },
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "deliverable_versions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: validVersionId },
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "project_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: "member-watcher-1" },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      mockSupabase.rpc.mockResolvedValue({
        data: {
          link_report_id: "rep-123",
          status: "open",
        },
        error: null,
      });

      const result = await reportDeliverableLinkAction({
        deliverable_id: validDeliverableId,
        version_id: validVersionId,
        reason: "Access denied on Google Drive",
      });

      expect(result.ok).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "report_broken_link",
        expect.objectContaining({
          p_deliverable_id: validDeliverableId,
          p_version_id: validVersionId,
        }),
      );
    });
  });
});
