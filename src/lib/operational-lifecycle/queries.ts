import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";
import type { DeletionPreviewInput } from "./schemas";
import type {
  AvailableResult,
  OperationalDeletionBlockerCode,
  OperationalDeletionPreviewDto,
  OperationalLifecycleEntityType,
  OperationalRecycleBinItem,
} from "./types";

type TypedSupabase = SupabaseClient<Database>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_ENTITY_TYPES = new Set<OperationalLifecycleEntityType>([
  "project",
  "task",
  "deliverable",
  "milestone",
]);

const KNOWN_BLOCKER_CODES = new Set<OperationalDeletionBlockerCode>([
  "archive_required",
  "dependencies_present",
  "not_found",
  "not_found_or_parent_archived",
  "not_found_or_archive_required",
]);

export async function fetchOperationalRecycleBin(
  supabase: TypedSupabase,
  projectId?: string | null,
): Promise<AvailableResult<OperationalRecycleBinItem[]>> {
  try {
    const { data, error } = await supabase.rpc("list_operational_recycle_bin", {
      p_project_id: projectId ?? undefined,
    });

    if (error || !data || !Array.isArray(data)) {
      if (error) {
        logger.debug("list_operational_recycle_bin RPC failed", {
          error: error.message,
        });
      }
      return { status: "unavailable" };
    }

    const items: OperationalRecycleBinItem[] = [];

    for (const row of data) {
      if (!row || typeof row !== "object") {
        return { status: "unavailable" };
      }

      const raw = row as Record<string, unknown>;

      // entity_type validation
      if (
        typeof raw.entity_type !== "string" ||
        !VALID_ENTITY_TYPES.has(
          raw.entity_type as OperationalLifecycleEntityType,
        )
      ) {
        return { status: "unavailable" };
      }

      // entity_id validation (must be valid UUID)
      if (
        typeof raw.entity_id !== "string" ||
        !UUID_REGEX.test(raw.entity_id)
      ) {
        return { status: "unavailable" };
      }

      // project_id validation (nullable UUID)
      if (
        raw.project_id !== null &&
        (typeof raw.project_id !== "string" || !UUID_REGEX.test(raw.project_id))
      ) {
        return { status: "unavailable" };
      }

      // title validation (non-empty trimmed string)
      if (typeof raw.title !== "string" || raw.title.trim().length === 0) {
        return { status: "unavailable" };
      }

      // archived_at validation (valid ISO date-time)
      if (
        typeof raw.archived_at !== "string" ||
        isNaN(Date.parse(raw.archived_at))
      ) {
        return { status: "unavailable" };
      }

      // archived_by validation (nullable UUID)
      if (
        raw.archived_by !== null &&
        (typeof raw.archived_by !== "string" ||
          !UUID_REGEX.test(raw.archived_by))
      ) {
        return { status: "unavailable" };
      }

      // archive_reason validation (nullable string)
      if (
        raw.archive_reason !== null &&
        typeof raw.archive_reason !== "string"
      ) {
        return { status: "unavailable" };
      }

      // parent_is_archived validation (boolean)
      if (typeof raw.parent_is_archived !== "boolean") {
        return { status: "unavailable" };
      }

      items.push({
        entityType: raw.entity_type as OperationalLifecycleEntityType,
        entityId: raw.entity_id,
        projectId: raw.project_id,
        title: raw.title.trim(),
        archivedAt: raw.archived_at,
        archivedBy: raw.archived_by,
        archiveReason: raw.archive_reason ? raw.archive_reason.trim() : null,
        parentIsArchived: raw.parent_is_archived,
      });
    }

    return { status: "available", data: items };
  } catch (err) {
    logger.debug("Exception in fetchOperationalRecycleBin", { err });
    return { status: "unavailable" };
  }
}

export async function fetchOperationalDeletionPreview(
  supabase: TypedSupabase,
  input: DeletionPreviewInput,
): Promise<AvailableResult<OperationalDeletionPreviewDto>> {
  try {
    const { data, error } = await supabase.rpc(
      "get_operational_deletion_preview",
      {
        p_entity_type: input.entityType,
        p_entity_id: input.entityId,
      },
    );

    if (error || !data || !Array.isArray(data) || data.length !== 1) {
      if (error) {
        logger.debug("get_operational_deletion_preview RPC failed", {
          error: error.message,
        });
      }
      return { status: "unavailable" };
    }

    const row = data[0];
    if (!row || typeof row !== "object") {
      return { status: "unavailable" };
    }

    // Entity type and entity ID match invariant
    if (
      row.entity_type !== input.entityType ||
      row.entity_id !== input.entityId
    ) {
      return { status: "unavailable" };
    }

    // Title validation (must be non-empty trimmed string)
    if (typeof row.title !== "string" || row.title.trim().length === 0) {
      return { status: "unavailable" };
    }

    // can_delete validation (must be boolean)
    if (typeof row.can_delete !== "boolean") {
      return { status: "unavailable" };
    }

    // State invariant pair enforcement:
    // can_delete === true => blocker_code must be null
    // can_delete === false => blocker_code must be a known blocker code
    let normalizedBlockerCode: OperationalDeletionBlockerCode | null = null;

    if (row.can_delete === true) {
      if (
        row.blocker_code !== null &&
        row.blocker_code !== undefined &&
        row.blocker_code !== ""
      ) {
        return { status: "unavailable" };
      }
      normalizedBlockerCode = null;
    } else {
      if (
        typeof row.blocker_code !== "string" ||
        !KNOWN_BLOCKER_CODES.has(
          row.blocker_code as OperationalDeletionBlockerCode,
        )
      ) {
        return { status: "unavailable" };
      }
      normalizedBlockerCode =
        row.blocker_code as OperationalDeletionBlockerCode;
    }

    return {
      status: "available",
      data: {
        entityType: row.entity_type as OperationalLifecycleEntityType,
        entityId: row.entity_id,
        title: row.title.trim(),
        canDelete: row.can_delete,
        blockerCode: normalizedBlockerCode,
      },
    };
  } catch (err) {
    logger.debug("Exception in fetchOperationalDeletionPreview", { err });
    return { status: "unavailable" };
  }
}
