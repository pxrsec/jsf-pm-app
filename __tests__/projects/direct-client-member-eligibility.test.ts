import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import { listEligibleClientMembersForProject } from "@/lib/projects/queries";

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

describe("Direct & Organization Client Member Eligibility (Two-Step Algorithm)", () => {
  let fromMock: ReturnType<typeof vi.fn>;
  let rpcMock: ReturnType<typeof vi.fn>;
  let mockSupabase: Parameters<typeof listEligibleClientMembersForProject>[0];

  beforeEach(() => {
    fromMock = vi.fn();
    rpcMock = vi.fn();
    mockSupabase = {
      from: fromMock,
      rpc: rpcMock,
    } as unknown as Parameters<typeof listEligibleClientMembersForProject>[0];
  });

  describe("Direct Client Project Path (project.client_id === null)", () => {
    it("calls list_project_client_contact_associations RPC and NEVER calls .from('project_client_contacts')", async () => {
      rpcMock.mockResolvedValueOnce({
        data: [{ contact_id: "11111111-1111-4111-8111-111111111111" }],
        error: null,
      });

      const chain = createQueryChainMock({
        data: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            full_name: "Direct Client User",
            email: "direct@client.com",
            profile_id: "prof-1",
            job_title: "CEO",
            profiles: { role: "client", is_active: true, deleted_at: null },
          },
        ],
        error: null,
      });

      fromMock.mockReturnValue(chain);

      const result = await listEligibleClientMembersForProject(mockSupabase, {
        id: "proj-100",
        client_id: null,
      });

      expect(rpcMock).toHaveBeenCalledWith(
        "list_project_client_contact_associations",
        { p_project_id: "proj-100" },
      );

      // Verify that project_client_contacts base table was NEVER queried
      expect(fromMock).not.toHaveBeenCalledWith("project_client_contacts");
      expect(fromMock).toHaveBeenCalledWith("client_contacts");
      expect(chain.in).toHaveBeenCalledWith("id", [
        "11111111-1111-4111-8111-111111111111",
      ]);

      expect(result).toEqual({
        status: "available",
        data: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            full_name: "Direct Client User",
            email: "direct@client.com",
            profile_id: "prof-1",
            job_title: "CEO",
          },
        ],
      });
    });

    it("returns available empty list when association RPC returns empty set", async () => {
      rpcMock.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await listEligibleClientMembersForProject(mockSupabase, {
        id: "proj-100",
        client_id: null,
      });

      expect(result).toEqual({ status: "available", data: [] });
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("returns unavailable when association RPC returns error or malformed UUID", async () => {
      // 1. RPC error
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "RPC failed" },
      });

      const resError = await listEligibleClientMembersForProject(mockSupabase, {
        id: "proj-100",
        client_id: null,
      });
      expect(resError).toEqual({ status: "unavailable" });

      // 2. Malformed UUID row
      rpcMock.mockResolvedValueOnce({
        data: [{ contact_id: "invalid-uuid" }],
        error: null,
      });

      const resMalformed = await listEligibleClientMembersForProject(
        mockSupabase,
        { id: "proj-100", client_id: null },
      );
      expect(resMalformed).toEqual({ status: "unavailable" });
    });
  });

  describe("Organization Client Project Path (project.client_id !== null)", () => {
    it("queries client_contacts filtered by project.client_id", async () => {
      const chain = createQueryChainMock({
        data: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            full_name: "Org Client User",
            email: "org@client.com",
            profile_id: "prof-2",
            job_title: "Director",
            profiles: { role: "client", is_active: true, deleted_at: null },
          },
        ],
        error: null,
      });

      fromMock.mockReturnValue(chain);

      const result = await listEligibleClientMembersForProject(mockSupabase, {
        id: "proj-200",
        client_id: "org-500",
      });

      expect(rpcMock).not.toHaveBeenCalled();
      expect(fromMock).toHaveBeenCalledWith("client_contacts");
      expect(chain.eq).toHaveBeenCalledWith("client_id", "org-500");

      expect(result).toEqual({
        status: "available",
        data: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            full_name: "Org Client User",
            email: "org@client.com",
            profile_id: "prof-2",
            job_title: "Director",
          },
        ],
      });
    });
  });
});
