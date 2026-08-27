import { describe, it, expect, vi, beforeEach } from "vitest";

type MockChain = {
  eq?: ReturnType<typeof vi.fn>;
  is?: ReturnType<typeof vi.fn>;
  maybeSingle?: ReturnType<typeof vi.fn>;
  then?: ReturnType<typeof vi.fn>;
};

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
import {
  reviewDeliverableAction,
  markDeliverableDeliveredAction,
} from "@/lib/deliverables/review-actions";
import { verifyPmLeadCapacity } from "@/lib/deliverables/auth-checks";
import { revalidatePath } from "next/cache";

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
                        task_type: "internal_work",
                        projects: {
                          id: validProjectId,
                          project_type: "internal",
                          status: "in_progress",
                          client_id: null,
                        },
                      },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "project_members") {
          const chain: MockChain = {
            eq: vi.fn(() => chain),
            is: vi.fn(() => chain),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { member_type: "pm_watcher" },
            }),
          };
          return {
            select: vi.fn().mockReturnValue(chain),
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
        internal_review_deadline_at: "2026-09-01T12:00:00Z",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });

    it("creates deliverable successfully on internal project when PM Lead and valid deadlines pass", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
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
                        task_type: "internal_work",
                        assignee_id: validAssigneeId,
                      },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "project_members") {
          return {
            select: vi.fn().mockImplementation(() => {
              let queriedUserId: string | null = null;
              const chain: MockChain = {
                eq: vi.fn((field: string, val: unknown) => {
                  if (field === "user_id") {
                    queriedUserId = String(val);
                  }
                  return chain;
                }),
                is: vi.fn(() => chain),
                maybeSingle: vi.fn().mockImplementation(async () => {
                  if (queriedUserId === "user-pm-lead-1") {
                    return { data: { member_type: "pm_lead" } };
                  }
                  return {
                    data: {
                      member_type: "operator",
                      profiles: { is_active: true },
                    },
                  };
                }),
              };
              return chain;
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
                    workflow_type: "production",
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
        internal_review_deadline_at: "2026-09-01T12:00:00Z",
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("updateDeliverableAction", () => {
    it("rejects editing when deliverable is in review state", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "project_members") {
          const chain: MockChain = {
            eq: vi.fn(() => chain),
            is: vi.fn(() => chain),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { member_type: "pm_lead" },
            }),
          };
          return {
            select: vi.fn().mockReturnValue(chain),
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
                        project_id: validProjectId,
                        task_id: validTaskId,
                        status: "awaiting_internal_review",
                        title: "Original Title",
                        specifications: "Original Specs",
                        workflow_type: "production",
                        internal_review_deadline_at: "2026-09-01T12:00:00Z",
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
          const chain: MockChain = {
            eq: vi.fn(() => chain),
            is: vi.fn(() => chain),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { member_type: "pm_watcher" },
            }),
          };
          return {
            select: vi.fn().mockReturnValue(chain),
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
                      workflow_type: "production",
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
          const chain: MockChain = {
            eq: vi.fn(() => chain),
            is: vi.fn(() => chain),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "member-watcher-1" },
            }),
          };
          return {
            select: vi.fn().mockReturnValue(chain),
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

  describe("verifyPmLeadCapacity", () => {
    it("returns true immediately for admin role", async () => {
      const isLead = await verifyPmLeadCapacity(
        mockSupabase as never,
        "any-user",
        "admin",
        validProjectId,
      );
      expect(isLead).toBe(true);
    });

    it("returns true for active PM Lead with active and non-deleted profile", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "project_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      is: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { member_type: "pm_lead" },
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const isLead = await verifyPmLeadCapacity(
        mockSupabase as never,
        "user-pm-lead-1",
        "pm",
        validProjectId,
      );
      expect(isLead).toBe(true);
    });

    it("returns false for PM Lead when profile is inactive or deleted", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "project_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      is: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const isLead = await verifyPmLeadCapacity(
        mockSupabase as never,
        "user-pm-lead-inactive",
        "pm",
        validProjectId,
      );
      expect(isLead).toBe(false);
    });

    it("returns false for PM Watcher", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "project_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      is: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { member_type: "pm_watcher" },
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const isLead = await verifyPmLeadCapacity(
        mockSupabase as never,
        "user-pm-watcher-1",
        "pm",
        validProjectId,
      );
      expect(isLead).toBe(false);
    });
  });

  describe("reviewDeliverableAction", () => {
    it("rejects malformed inputs and empty changes_requested comment", async () => {
      const invalidUuidResult = await reviewDeliverableAction({
        deliverable_id: "not-a-uuid",
        decision: "approved",
      });
      expect(invalidUuidResult.ok).toBe(false);
      if (!invalidUuidResult.ok) {
        expect(invalidUuidResult.error.code).toBe("VALIDATION_FAILED");
      }

      const emptyCommentResult = await reviewDeliverableAction({
        deliverable_id: validDeliverableId,
        decision: "changes_requested",
        comments: "   ",
      });
      expect(emptyCommentResult.ok).toBe(false);
      if (!emptyCommentResult.ok) {
        expect(emptyCommentResult.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("denies PM Watcher or unauthorized actors", async () => {
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
                      status: "awaiting_internal_review",
                      workflow_type: "production",
                    },
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
                    eq: vi.fn().mockReturnValue({
                      is: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { member_type: "pm_watcher" },
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await reviewDeliverableAction({
        deliverable_id: validDeliverableId,
        decision: "approved",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });

    it("successfully approves deliverable and revalidates workspace paths", async () => {
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
                      status: "awaiting_internal_review",
                      workflow_type: "production",
                    },
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
                    eq: vi.fn().mockReturnValue({
                      is: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { member_type: "pm_lead" },
                        }),
                      }),
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
          deliverable_id: validDeliverableId,
          feedback_id: "fb-123",
          decision: "approved",
        },
        error: null,
      });

      const result = await reviewDeliverableAction({
        deliverable_id: validDeliverableId,
        decision: "approved",
        comments: "Looks great!",
      });

      expect(result.ok).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("review_deliverable", {
        p_deliverable_id: validDeliverableId,
        p_stage: "internal",
        p_decision: "approved",
        p_comments: "Looks great!",
      });
      expect(revalidatePath).toHaveBeenCalledWith(
        `/admin/proyectos/${validProjectId}`,
      );
      expect(revalidatePath).toHaveBeenCalledWith(
        `/pm/proyectos/${validProjectId}`,
      );
    });

    it("successfully requests changes and revalidates workspace paths", async () => {
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
                      status: "awaiting_internal_review",
                      workflow_type: "production",
                    },
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
                    eq: vi.fn().mockReturnValue({
                      is: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { member_type: "pm_lead" },
                        }),
                      }),
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
          deliverable_id: validDeliverableId,
          feedback_id: "fb-456",
          decision: "changes_requested",
        },
        error: null,
      });

      const result = await reviewDeliverableAction({
        deliverable_id: validDeliverableId,
        decision: "changes_requested",
        comments: "Please fix color grading at 01:23",
      });

      expect(result.ok).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("review_deliverable", {
        p_deliverable_id: validDeliverableId,
        p_stage: "internal",
        p_decision: "changes_requested",
        p_comments: "Please fix color grading at 01:23",
      });
    });

    it("handles stale state or invalid transition from RPC safely", async () => {
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
                      status: "awaiting_internal_review",
                      workflow_type: "production",
                    },
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
                    eq: vi.fn().mockReturnValue({
                      is: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { member_type: "pm_lead" },
                        }),
                      }),
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
        data: null,
        error: {
          message:
            "Illegal transition: deliverable is not in awaiting_internal_review",
        },
      });

      const result = await reviewDeliverableAction({
        deliverable_id: validDeliverableId,
        decision: "approved",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_TRANSITION");
      }
    });
  });

  describe("markDeliverableDeliveredAction", () => {
    it("rejects unauthorized non-Lead actor", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "project_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      is: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { member_type: "pm_watcher" },
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await markDeliverableDeliveredAction({
        deliverable_id: validDeliverableId,
        project_id: validProjectId,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });

    it("rejects when deliverable is not in approved status", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "project_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      is: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { member_type: "pm_lead" },
                        }),
                      }),
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
                        project_id: validProjectId,
                        status: "awaiting_internal_review",
                        workflow_type: "production",
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

      const result = await markDeliverableDeliveredAction({
        deliverable_id: validDeliverableId,
        project_id: validProjectId,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_TRANSITION");
      }
    });

    it("successfully marks deliverable as delivered for approved state", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "project_members") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      is: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { member_type: "pm_lead" },
                        }),
                      }),
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
                        project_id: validProjectId,
                        status: "approved",
                        workflow_type: "production",
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

      mockSupabase.rpc.mockResolvedValue({
        data: {
          deliverable_id: validDeliverableId,
          status: "delivered",
        },
        error: null,
      });

      const result = await markDeliverableDeliveredAction({
        deliverable_id: validDeliverableId,
        project_id: validProjectId,
      });

      expect(result.ok).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "mark_deliverable_delivered",
        {
          p_deliverable_id: validDeliverableId,
        },
      );
      expect(revalidatePath).toHaveBeenCalledWith(
        `/admin/proyectos/${validProjectId}`,
      );
    });
  });
});
