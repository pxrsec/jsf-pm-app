import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";
import type {
  AvailableResult,
  OrdinaryInvitationCursor,
  OrdinaryInvitationListItemDto,
  OrdinaryInvitationPageDto,
  OrdinaryInvitationRole,
  OrdinaryInvitationStatus,
} from "./types";

type TypedSupabase = SupabaseClient<Database>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_ROLES = new Set<OrdinaryInvitationRole>(["client", "operator"]);
const VALID_STATUSES = new Set<OrdinaryInvitationStatus>([
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

export async function fetchOrdinaryInvitationPage(
  supabase: TypedSupabase,
  cursor?: OrdinaryInvitationCursor | null,
  pageSize = 20,
): Promise<AvailableResult<OrdinaryInvitationPageDto>> {
  try {
    const limit = Math.max(1, Math.min(pageSize, 50));
    const { data, error } = await supabase.rpc(
      "list_ordinary_invitation_administration",
      {
        p_limit: limit + 1,
        p_before_created_at: cursor?.beforeCreatedAt ?? undefined,
        p_before_invitation_id: cursor?.beforeInvitationId ?? undefined,
      },
    );

    if (error || !data) {
      if (error) {
        logger.debug("Error in list_ordinary_invitation_administration RPC", {
          error: error.message,
        });
      }
      return { status: "unavailable" };
    }

    // Cardinality & row validation: validate ALL rows before slicing
    const validatedItems: OrdinaryInvitationListItemDto[] = [];
    for (const row of data) {
      if (
        typeof row.invitation_id !== "string" ||
        !UUID_REGEX.test(row.invitation_id) ||
        !VALID_ROLES.has(row.role as OrdinaryInvitationRole) ||
        !VALID_STATUSES.has(row.status as OrdinaryInvitationStatus) ||
        typeof row.recipient_label !== "string" ||
        typeof row.created_at !== "string" ||
        typeof row.expires_at !== "string" ||
        (row.contact_id !== null &&
          (typeof row.contact_id !== "string" ||
            !UUID_REGEX.test(row.contact_id))) ||
        (row.project_id !== null &&
          (typeof row.project_id !== "string" ||
            !UUID_REGEX.test(row.project_id))) ||
        (row.project_name !== null && typeof row.project_name !== "string") ||
        (row.accepted_at !== null && typeof row.accepted_at !== "string") ||
        (row.revoked_at !== null && typeof row.revoked_at !== "string")
      ) {
        return { status: "unavailable" };
      }

      validatedItems.push({
        invitationId: row.invitation_id,
        role: row.role as OrdinaryInvitationRole,
        status: row.status as OrdinaryInvitationStatus,
        recipientLabel: row.recipient_label,
        contactId: row.contact_id,
        projectId: row.project_id,
        projectName: row.project_name,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at,
        revokedAt: row.revoked_at,
      });
    }

    const hasMore = validatedItems.length > limit;
    const visibleItems = hasMore
      ? validatedItems.slice(0, limit)
      : validatedItems;

    let nextCursor: OrdinaryInvitationCursor | null = null;
    if (hasMore && visibleItems.length > 0) {
      const lastVisible = visibleItems[visibleItems.length - 1];
      nextCursor = {
        beforeCreatedAt: lastVisible.createdAt,
        beforeInvitationId: lastVisible.invitationId,
      };
    }

    return {
      status: "available",
      data: {
        items: visibleItems,
        nextCursor,
      },
    };
  } catch (err) {
    logger.debug("Failed in fetchOrdinaryInvitationPage", { err });
    return { status: "unavailable" };
  }
}
