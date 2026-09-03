import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  archiveOperationalEntityAction,
  getOperationalDeletionPreviewAction,
  permanentlyDeleteOperationalEntityAction,
  restoreArchivedOperationalEntityAction,
} from "@/lib/operational-lifecycle/actions";
import {
  requireSession,
  AuthError,
  type SessionContext,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  archiveOperationalEntity,
  permanentlyDeleteOperationalEntity,
  restoreArchivedOperationalEntity,
} from "@/lib/operational-lifecycle/commands";
import { fetchOperationalDeletionPreview } from "@/lib/operational-lifecycle/queries";
import { revalidateLifecycleScope } from "@/lib/operational-lifecycle/revalidation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { OperationalLifecycleEntityType } from "@/lib/operational-lifecycle/types";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(),
  AuthError: class AuthError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "AuthError";
      this.code = code;
    }
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/operational-lifecycle/commands", () => ({
  archiveOperationalEntity: vi.fn(),
  restoreArchivedOperationalEntity: vi.fn(),
  permanentlyDeleteOperationalEntity: vi.fn(),
}));

vi.mock("@/lib/operational-lifecycle/queries", () => ({
  fetchOperationalDeletionPreview: vi.fn(),
}));

vi.mock("@/lib/operational-lifecycle/revalidation", () => ({
  revalidateLifecycleScope: vi.fn(),
}));

const VALID_UUID = "12345678-1234-4234-8234-123456789012";

describe("Operational Lifecycle Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("archiveOperationalEntityAction", () => {
    it("allows admin and PM, revalidating on mutation", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "u-1" },
        role: "pm",
      } as unknown as SessionContext);
      vi.mocked(createClient).mockReturnValue(
        {} as unknown as SupabaseClient<Database>,
      );
      vi.mocked(archiveOperationalEntity).mockResolvedValue({
        ok: true,
        data: { code: "archived" },
      });

      const result = await archiveOperationalEntityAction({
        entityType: "project",
        entityId: VALID_UUID,
        reason: "Done",
      });

      expect(result).toEqual({ ok: true, data: { code: "archived" } });
      expect(revalidateLifecycleScope).toHaveBeenCalledWith(
        "project",
        "archived",
      );
    });

    it("does not revalidate on idempotent outcome already_archived", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "u-1" },
        role: "admin",
      } as unknown as SessionContext);
      vi.mocked(createClient).mockReturnValue(
        {} as unknown as SupabaseClient<Database>,
      );
      vi.mocked(archiveOperationalEntity).mockResolvedValue({
        ok: true,
        data: { code: "already_archived" },
      });

      const result = await archiveOperationalEntityAction({
        entityType: "task",
        entityId: VALID_UUID,
        reason: null,
      });

      expect(result).toEqual({ ok: true, data: { code: "already_archived" } });
      expect(revalidateLifecycleScope).not.toHaveBeenCalled();
    });

    it("returns UNAUTHORIZED on AuthError", async () => {
      vi.mocked(requireSession).mockRejectedValue(
        new AuthError("UNAUTHENTICATED", "No session"),
      );

      const result = await archiveOperationalEntityAction({
        entityType: "project",
        entityId: VALID_UUID,
        reason: null,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "UNAUTHORIZED" },
      });
    });

    it("returns UNAUTHORIZED for operator or client", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "u-2" },
        role: "operator",
      } as unknown as SessionContext);

      const result = await archiveOperationalEntityAction({
        entityType: "project",
        entityId: VALID_UUID,
        reason: null,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "UNAUTHORIZED" },
      });
    });

    it("returns VALIDATION_FAILED on malformed schema data", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "u-1" },
        role: "admin",
      } as unknown as SessionContext);

      const result = await archiveOperationalEntityAction({
        entityType: "invalid" as unknown as OperationalLifecycleEntityType,
        entityId: VALID_UUID,
        reason: null,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });
    });
  });

  describe("restoreArchivedOperationalEntityAction", () => {
    it("allows admin and pm to restore", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "u-1" },
        role: "admin",
      } as unknown as SessionContext);
      vi.mocked(createClient).mockReturnValue(
        {} as unknown as SupabaseClient<Database>,
      );
      vi.mocked(restoreArchivedOperationalEntity).mockResolvedValue({
        ok: true,
        data: { code: "restored" },
      });

      const result = await restoreArchivedOperationalEntityAction({
        entityType: "deliverable",
        entityId: VALID_UUID,
      });

      expect(result).toEqual({ ok: true, data: { code: "restored" } });
      expect(revalidateLifecycleScope).toHaveBeenCalledWith(
        "deliverable",
        "restored",
      );
    });

    it("rejects operator with UNAUTHORIZED", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "u-2" },
        role: "operator",
      } as unknown as SessionContext);

      const result = await restoreArchivedOperationalEntityAction({
        entityType: "deliverable",
        entityId: VALID_UUID,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "UNAUTHORIZED" },
      });
    });
  });

  describe("getOperationalDeletionPreviewAction", () => {
    it("allows admin and returns preview", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "u-1" },
        role: "admin",
      } as unknown as SessionContext);
      vi.mocked(createClient).mockReturnValue(
        {} as unknown as SupabaseClient<Database>,
      );
      vi.mocked(fetchOperationalDeletionPreview).mockResolvedValue({
        status: "available",
        data: {
          entityType: "project",
          entityId: VALID_UUID,
          title: "Project to delete",
          canDelete: true,
          blockerCode: null,
        },
      });

      const result = await getOperationalDeletionPreviewAction({
        entityType: "project",
        entityId: VALID_UUID,
      });

      expect(result).toEqual({
        ok: true,
        data: {
          entityType: "project",
          entityId: VALID_UUID,
          title: "Project to delete",
          canDelete: true,
          blockerCode: null,
        },
      });
    });

    it("rejects PM with UNAUTHORIZED", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "u-3" },
        role: "pm",
      } as unknown as SessionContext);

      const result = await getOperationalDeletionPreviewAction({
        entityType: "project",
        entityId: VALID_UUID,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "UNAUTHORIZED" },
      });
    });
  });

  describe("permanentlyDeleteOperationalEntityAction", () => {
    it("allows admin and revalidates on permanent deletion", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "u-1" },
        role: "admin",
      } as unknown as SessionContext);
      vi.mocked(createClient).mockReturnValue(
        {} as unknown as SupabaseClient<Database>,
      );
      vi.mocked(permanentlyDeleteOperationalEntity).mockResolvedValue({
        ok: true,
        data: { code: "permanently_deleted" },
      });

      const result = await permanentlyDeleteOperationalEntityAction({
        entityType: "milestone",
        entityId: VALID_UUID,
      });

      expect(result).toEqual({
        ok: true,
        data: { code: "permanently_deleted" },
      });
      expect(revalidateLifecycleScope).toHaveBeenCalledWith(
        "milestone",
        "permanently_deleted",
      );
    });

    it("rejects PM with UNAUTHORIZED", async () => {
      vi.mocked(requireSession).mockResolvedValue({
        user: { id: "u-3" },
        role: "pm",
      } as unknown as SessionContext);

      const result = await permanentlyDeleteOperationalEntityAction({
        entityType: "milestone",
        entityId: VALID_UUID,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "UNAUTHORIZED" },
      });
    });
  });
});
