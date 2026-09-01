import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import { verifyDeliverableEligibility } from "@/lib/deliverables/auth-checks";

type MockResult<T> = { data: T; error: { message: string } | null };

type MockQueryChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (
    resolve: (value: MockResult<unknown>) => void,
    reject?: (reason: unknown) => void,
  ) => Promise<void>;
};

function createQueryChainMock(
  resolvedValue: MockResult<unknown>,
): MockQueryChain {
  const chain: Partial<MockQueryChain> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.not = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(resolvedValue);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  chain.then = (resolve, reject) =>
    Promise.resolve(resolvedValue).then(resolve, reject);
  return chain as MockQueryChain;
}

describe("Deliverable Eligibility — Direct Client Projects", () => {
  let fromMock: ReturnType<typeof vi.fn>;
  let mockSupabase: Parameters<typeof verifyDeliverableEligibility>[0];

  beforeEach(() => {
    fromMock = vi.fn();
    mockSupabase = {
      from: fromMock,
    } as unknown as Parameters<typeof verifyDeliverableEligibility>[0];
  });

  it("allows client_request deliverable on client project without client_id when client member is assigned", async () => {
    const taskChain = createQueryChainMock({
      data: {
        id: "task-1",
        project_id: "proj-1",
        task_type: "client_request",
        assignee_id: "user-client-1",
        deleted_at: null,
      },
      error: null,
    });

    const projChain = createQueryChainMock({
      data: {
        id: "proj-1",
        project_type: "client",
        client_id: null, // Direct client project
        status: "in_progress",
        deleted_at: null,
      },
      error: null,
    });

    const memberChain = createQueryChainMock({
      data: {
        id: "mem-1",
        project_id: "proj-1",
        user_id: "user-client-1",
        member_type: "client",
        deleted_at: null,
      },
      error: null,
    });

    fromMock.mockImplementation((table: string) => {
      if (table === "tasks") return taskChain;
      if (table === "projects") return projChain;
      if (table === "project_members") return memberChain;
      return createQueryChainMock({ data: null, error: null });
    });

    const result = await verifyDeliverableEligibility(
      mockSupabase,
      "proj-1",
      "task-1",
      "user-client-1",
    );

    expect(result).toEqual({
      ok: true,
      taskType: "client_request",
      workflowType: "client_submission",
      projectType: "client",
      taskAssigneeId: "user-client-1",
    });
  });

  it("allows internal_work deliverable on direct client project when PM/Operator is assigned", async () => {
    const taskChain = createQueryChainMock({
      data: {
        id: "task-2",
        project_id: "proj-1",
        task_type: "internal_work",
        assignee_id: "user-operator-1",
        deleted_at: null,
      },
      error: null,
    });

    const projChain = createQueryChainMock({
      data: {
        id: "proj-1",
        project_type: "client",
        client_id: null,
        status: "in_progress",
        deleted_at: null,
      },
      error: null,
    });

    const memberChain = createQueryChainMock({
      data: {
        id: "mem-2",
        project_id: "proj-1",
        user_id: "user-operator-1",
        member_type: "operator",
        deleted_at: null,
      },
      error: null,
    });

    fromMock.mockImplementation((table: string) => {
      if (table === "tasks") return taskChain;
      if (table === "projects") return projChain;
      if (table === "project_members") return memberChain;
      return createQueryChainMock({ data: null, error: null });
    });

    const result = await verifyDeliverableEligibility(
      mockSupabase,
      "proj-1",
      "task-2",
      "user-operator-1",
    );

    expect(result).toEqual({
      ok: true,
      taskType: "internal_work",
      workflowType: "production",
      projectType: "client",
      taskAssigneeId: "user-operator-1",
    });
  });
});
