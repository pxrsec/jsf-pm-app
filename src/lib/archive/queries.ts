import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { AppRole } from "@/lib/auth/routes";
import { logger } from "@/lib/logger";
import type {
  ArchiveProjectFilterOption,
  FinalizedArchiveCursor,
  FinalizedArchiveItem,
  FinalizedArchivePage,
  FinalizedArchiveQuery,
  LinkIncidentCursor,
  LinkIncidentItem,
  LinkIncidentPage,
  LinkIncidentQuery,
} from "./types";
import {
  sanitizeSubmissionUrl,
  sanitizeDriveFolderUrl,
} from "./url-validators";

export const ARCHIVE_PAGE_SIZE = 25;

/**
 * Server-derived role-safe project workspace href.
 * Operator never receives a project workspace link.
 */
export function deriveProjectHref(
  role: AppRole,
  projectId: string | null,
): string | null {
  if (!projectId) return null;
  switch (role) {
    case "admin":
      return `/admin/proyectos/${projectId}`;
    case "pm":
      return `/pm/proyectos/${projectId}`;
    case "client":
      return `/cliente/proyectos/${projectId}`;
    case "operator":
    default:
      return null;
  }
}

/**
 * Server-only helper query fetching narrow project options (id, name) for Admin archive filtering.
 * Includes all authorized non-deleted projects (including completed and archived).
 */
export async function fetchArchiveProjectFilterOptionsForAdmin(
  supabase: SupabaseClient<Database>,
): Promise<ArchiveProjectFilterOption[]> {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name")
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error || !data) {
      logger.debug("archive-project-filter-admin-error", {
        error: error?.message,
      });
      return [];
    }

    return data.map((p) => ({ id: p.id, name: p.name }));
  } catch (err) {
    logger.debug("archive-project-filter-admin-failed", { err });
    return [];
  }
}

/**
 * Server-only helper query fetching narrow project options (id, name) for PM archive filtering.
 * Includes all authorized non-deleted PM projects (including completed and archived).
 */
export async function fetchArchiveProjectFilterOptionsForPm(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ArchiveProjectFilterOption[]> {
  try {
    const { data, error } = await supabase
      .from("project_members")
      .select("projects!inner(id, name, deleted_at)")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .is("projects.deleted_at", null);

    if (error || !data) {
      logger.debug("archive-project-filter-pm-error", {
        error: error?.message,
      });
      return [];
    }

    type RawMemberRow = { projects: { id: string; name: string } | null };
    const rows = data as unknown as RawMemberRow[];

    const projectsMap = new Map<string, string>();
    for (const row of rows) {
      if (row.projects?.id && row.projects.name) {
        projectsMap.set(row.projects.id, row.projects.name);
      }
    }

    return Array.from(projectsMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    logger.debug("archive-project-filter-pm-failed", { err });
    return [];
  }
}

/**
 * Server-only typed query adapter for M2 list_finalized_production_archive RPC.
 */
export async function fetchFinalizedArchivePage(
  supabase: SupabaseClient<Database>,
  query: FinalizedArchiveQuery,
  cursor: FinalizedArchiveCursor | null | undefined,
  userRole: AppRole,
): Promise<FinalizedArchivePage> {
  const { data, error } = await supabase.rpc(
    "list_finalized_production_archive",
    {
      p_project_id: query.projectId ?? undefined,
      p_status: query.status ?? undefined,
      p_from: query.from,
      p_to: query.to,
      p_before_finalized_at: cursor?.beforeFinalizedAt ?? undefined,
      p_before_deliverable_id: cursor?.beforeDeliverableId ?? undefined,
      p_limit: ARCHIVE_PAGE_SIZE + 1,
    },
  );

  if (error) {
    logger.debug("archive-rpc-failed", {
      operation: "fetchFinalizedArchivePage",
      error: error.message,
    });
    throw new Error("Failed to fetch finalized production archive");
  }

  const rows = data ?? [];
  const hasMore = rows.length > ARCHIVE_PAGE_SIZE;
  const retainedRows = rows.slice(0, ARCHIVE_PAGE_SIZE);

  const items: FinalizedArchiveItem[] = [];

  for (const row of retainedRows) {
    if (
      !row.deliverable_id ||
      !row.deliverable_title ||
      !row.final_status ||
      (row.final_status !== "approved" && row.final_status !== "delivered") ||
      typeof row.current_version_number !== "number" ||
      !row.finalized_at
    ) {
      logger.debug("archive-row-malformed", { row });
      throw new Error("Failed to fetch finalized production archive");
    }

    const projectId = row.project_id ?? null;
    const projectHref = deriveProjectHref(userRole, projectId);

    items.push({
      deliverableId: row.deliverable_id,
      projectId,
      projectHref,
      deliverableTitle: row.deliverable_title,
      finalStatus: row.final_status,
      currentVersionNumber: row.current_version_number,
      finalizedAt: row.finalized_at,
      projectName: row.project_name ?? "",
      projectDriveFolderUrl: sanitizeDriveFolderUrl(
        row.project_drive_folder_url,
      ),
      currentSubmissionUrl: sanitizeSubmissionUrl(row.current_submission_url),
    });
  }

  const nextCursor: FinalizedArchiveCursor | null =
    hasMore && retainedRows.length === ARCHIVE_PAGE_SIZE
      ? {
          beforeFinalizedAt: retainedRows[ARCHIVE_PAGE_SIZE - 1].finalized_at,
          beforeDeliverableId:
            retainedRows[ARCHIVE_PAGE_SIZE - 1].deliverable_id,
        }
      : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}

/**
 * Server-only typed query adapter for M2 list_role_safe_link_incidents RPC.
 */
export async function fetchLinkIncidentsPage(
  supabase: SupabaseClient<Database>,
  query: LinkIncidentQuery,
  cursor: LinkIncidentCursor | null | undefined,
  userRole: AppRole,
): Promise<LinkIncidentPage> {
  const { data, error } = await supabase.rpc("list_role_safe_link_incidents", {
    p_project_id: query.projectId ?? undefined,
    p_status: query.status ?? undefined,
    p_from: query.from,
    p_to: query.to,
    p_before_reported_at: cursor?.beforeReportedAt ?? undefined,
    p_before_incident_id: cursor?.beforeIncidentId ?? undefined,
    p_limit: ARCHIVE_PAGE_SIZE + 1,
  });

  if (error) {
    logger.debug("incident-rpc-failed", {
      operation: "fetchLinkIncidentsPage",
      error: error.message,
    });
    throw new Error("Failed to fetch link incidents");
  }

  const rows = data ?? [];
  const hasMore = rows.length > ARCHIVE_PAGE_SIZE;
  const retainedRows = rows.slice(0, ARCHIVE_PAGE_SIZE);

  const items: LinkIncidentItem[] = [];

  for (const row of retainedRows) {
    if (
      !row.incident_id ||
      !row.deliverable_id ||
      !row.project_id ||
      !row.deliverable_title ||
      !row.incident_status ||
      !row.reported_at
    ) {
      logger.debug("incident-row-malformed", { row });
      throw new Error("Failed to fetch link incidents");
    }

    const projectHref = deriveProjectHref(userRole, row.project_id);

    items.push({
      incidentId: row.incident_id,
      deliverableId: row.deliverable_id,
      projectId: row.project_id,
      projectHref,
      deliverableTitle: row.deliverable_title,
      projectName: row.project_name ?? "",
      incidentStatus: row.incident_status,
      reportedAt: row.reported_at,
      resolvedAt: row.resolved_at ?? null,
      reason: row.reason ?? null,
      resolutionNote: row.resolution_note ?? null,
    });
  }

  const nextCursor: LinkIncidentCursor | null =
    hasMore && retainedRows.length === ARCHIVE_PAGE_SIZE
      ? {
          beforeReportedAt: retainedRows[ARCHIVE_PAGE_SIZE - 1].reported_at,
          beforeIncidentId: retainedRows[ARCHIVE_PAGE_SIZE - 1].incident_id,
        }
      : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}
