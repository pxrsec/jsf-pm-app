import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";
import { mapOperationalLifecycleFailureCode } from "./errors";
import type {
  ArchiveOperationalEntityInput,
  RestoreOperationalEntityInput,
  PermanentDeletionInput,
} from "./schemas";
import type {
  OperationalLifecycleActionResult,
  OperationalLifecycleMutationOutcome,
} from "./types";

type TypedSupabase = SupabaseClient<Database>;

const KNOWN_OUTCOME_CODES = new Set<string>([
  "archived",
  "restored",
  "already_archived",
  "already_active",
  "permanently_deleted",
]);

export async function archiveOperationalEntity(
  supabase: TypedSupabase,
  input: ArchiveOperationalEntityInput,
): Promise<
  OperationalLifecycleActionResult<OperationalLifecycleMutationOutcome>
> {
  try {
    const { data, error } = await supabase.rpc("archive_operational_entity", {
      p_entity_type: input.entityType,
      p_entity_id: input.entityId,
      p_reason: input.reason ?? undefined,
    });

    if (error || !data || !Array.isArray(data) || data.length !== 1) {
      if (error) {
        logger.debug("archive_operational_entity RPC failed", {
          error: error.message,
        });
      }
      return { ok: false, error: { code: "UNAVAILABLE" } };
    }

    const row = data[0];
    if (typeof row?.success !== "boolean" || typeof row?.code !== "string") {
      return { ok: false, error: { code: "UNAVAILABLE" } };
    }

    if (row.success) {
      if (!KNOWN_OUTCOME_CODES.has(row.code)) {
        return { ok: false, error: { code: "UNAVAILABLE" } };
      }
      return {
        ok: true,
        data: {
          code: row.code as OperationalLifecycleMutationOutcome["code"],
        },
      };
    }

    return {
      ok: false,
      error: {
        code: mapOperationalLifecycleFailureCode(row.code),
      },
    };
  } catch (err) {
    logger.debug("Exception in archiveOperationalEntity", { err });
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }
}

export async function restoreArchivedOperationalEntity(
  supabase: TypedSupabase,
  input: RestoreOperationalEntityInput,
): Promise<
  OperationalLifecycleActionResult<OperationalLifecycleMutationOutcome>
> {
  try {
    const { data, error } = await supabase.rpc(
      "restore_archived_operational_entity",
      {
        p_entity_type: input.entityType,
        p_entity_id: input.entityId,
      },
    );

    if (error || !data || !Array.isArray(data) || data.length !== 1) {
      if (error) {
        logger.debug("restore_archived_operational_entity RPC failed", {
          error: error.message,
        });
      }
      return { ok: false, error: { code: "UNAVAILABLE" } };
    }

    const row = data[0];
    if (typeof row?.success !== "boolean" || typeof row?.code !== "string") {
      return { ok: false, error: { code: "UNAVAILABLE" } };
    }

    if (row.success) {
      if (!KNOWN_OUTCOME_CODES.has(row.code)) {
        return { ok: false, error: { code: "UNAVAILABLE" } };
      }
      return {
        ok: true,
        data: {
          code: row.code as OperationalLifecycleMutationOutcome["code"],
        },
      };
    }

    return {
      ok: false,
      error: {
        code: mapOperationalLifecycleFailureCode(row.code),
      },
    };
  } catch (err) {
    logger.debug("Exception in restoreArchivedOperationalEntity", { err });
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }
}

export async function permanentlyDeleteOperationalEntity(
  supabase: TypedSupabase,
  input: PermanentDeletionInput,
): Promise<
  OperationalLifecycleActionResult<OperationalLifecycleMutationOutcome>
> {
  try {
    const { data, error } = await supabase.rpc(
      "permanently_delete_operational_entity",
      {
        p_entity_type: input.entityType,
        p_entity_id: input.entityId,
      },
    );

    if (error || !data || !Array.isArray(data) || data.length !== 1) {
      if (error) {
        logger.debug("permanently_delete_operational_entity RPC failed", {
          error: error.message,
        });
      }
      return { ok: false, error: { code: "UNAVAILABLE" } };
    }

    const row = data[0];
    if (typeof row?.success !== "boolean" || typeof row?.code !== "string") {
      return { ok: false, error: { code: "UNAVAILABLE" } };
    }

    if (row.success) {
      if (!KNOWN_OUTCOME_CODES.has(row.code)) {
        return { ok: false, error: { code: "UNAVAILABLE" } };
      }
      return {
        ok: true,
        data: {
          code: row.code as OperationalLifecycleMutationOutcome["code"],
        },
      };
    }

    return {
      ok: false,
      error: {
        code: mapOperationalLifecycleFailureCode(row.code),
      },
    };
  } catch (err) {
    logger.debug("Exception in permanentlyDeleteOperationalEntity", { err });
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }
}
