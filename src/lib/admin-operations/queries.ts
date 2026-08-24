import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";
import type {
  AdminAuditCursor,
  AdminAuditItemDto,
  AdminAuditPage,
  AdminAuditQuery,
  AdminInvitationStateItem,
  AdminProfileStateItem,
  AdminSectionResult,
  AdminUserInvitationCursor,
  AdminUserInvitationPage,
  AdminUserInvitationStateItem,
} from "./types";
import {
  adminAuditCursorSchema,
  adminAuditQuerySchema,
  adminUserInvitationCursorSchema,
} from "./schemas";

const PAGE_LIMIT = 25;
const FETCH_LIMIT = PAGE_LIMIT + 1;

export async function fetchAdminAuditPage(
  supabase: SupabaseClient<Database>,
  query: AdminAuditQuery,
  cursor?: AdminAuditCursor | null,
): Promise<AdminSectionResult<AdminAuditPage>> {
  const queryParsed = adminAuditQuerySchema.safeParse(query);
  if (!queryParsed.success) {
    logger.debug("fetchAdminAuditPage: query validation failed", {
      errors: queryParsed.error.errors,
    });
    return { status: "unavailable", code: "UNAVAILABLE" };
  }

  if (cursor !== undefined && cursor !== null) {
    const cursorParsed = adminAuditCursorSchema.safeParse(cursor);
    if (!cursorParsed.success) {
      logger.debug("fetchAdminAuditPage: cursor validation failed", {
        errors: cursorParsed.error.errors,
      });
      return { status: "unavailable", code: "UNAVAILABLE" };
    }
  }

  try {
    const { data, error } = await supabase.rpc("list_admin_audit_history", {
      p_from: query.from,
      p_to: query.to,
      p_before_created_at: cursor?.beforeCreatedAt ?? undefined,
      p_before_audit_id: cursor?.beforeAuditId ?? undefined,
      p_limit: FETCH_LIMIT,
    });

    if (error || !data) {
      logger.debug("fetchAdminAuditPage: RPC error", { error: error?.message });
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    if (!Array.isArray(data)) {
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    const hasMore = data.length > PAGE_LIMIT;
    const rawItems = data.slice(0, PAGE_LIMIT);

    let nextCursor: AdminAuditCursor | null = null;
    if (hasMore && rawItems.length > 0) {
      const lastRaw = rawItems[rawItems.length - 1];
      if (
        lastRaw &&
        lastRaw.created_at &&
        typeof lastRaw.audit_id === "number"
      ) {
        nextCursor = {
          beforeCreatedAt: lastRaw.created_at,
          beforeAuditId: lastRaw.audit_id,
        };
      }
    }

    const items: AdminAuditItemDto[] = rawItems.map((row) => ({
      createdAt: row.created_at,
      action: row.action,
      entityType: row.entity_type,
      projectName: row.project_name,
      actorRole: row.actor_role,
      oldStatus: row.old_status,
      newStatus: row.new_status,
      changedFieldSummary: row.changed_field_summary,
    }));

    return {
      status: "available",
      data: {
        items,
        nextCursor,
        hasMore,
      },
    };
  } catch (err) {
    logger.debug("fetchAdminAuditPage failed", { err });
    return { status: "unavailable", code: "UNAVAILABLE" };
  }
}

export async function fetchAdminUserInvitationStatePage(
  supabase: SupabaseClient<Database>,
  cursor?: AdminUserInvitationCursor | null,
): Promise<AdminSectionResult<AdminUserInvitationPage>> {
  if (cursor !== undefined && cursor !== null) {
    const cursorParsed = adminUserInvitationCursorSchema.safeParse(cursor);
    if (!cursorParsed.success) {
      logger.debug(
        "fetchAdminUserInvitationStatePage: cursor validation failed",
        {
          errors: cursorParsed.error.errors,
        },
      );
      return { status: "unavailable", code: "UNAVAILABLE" };
    }
  }

  try {
    const { data, error } = await supabase.rpc(
      "list_admin_user_invitation_state",
      {
        p_before_created_at: cursor?.beforeCreatedAt ?? undefined,
        p_before_profile_id: cursor?.beforeProfileId ?? undefined,
        p_limit: FETCH_LIMIT,
      },
    );

    if (error || !data) {
      logger.debug("fetchAdminUserInvitationStatePage: RPC error", {
        error: error?.message,
      });
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    if (!Array.isArray(data)) {
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    const hasMore = data.length > PAGE_LIMIT;
    const rawItems = data.slice(0, PAGE_LIMIT);

    let nextCursor: AdminUserInvitationCursor | null = null;
    if (hasMore && rawItems.length > 0) {
      const lastRaw = rawItems[rawItems.length - 1];
      if (lastRaw && lastRaw.created_at && lastRaw.record_id) {
        nextCursor = {
          beforeCreatedAt: lastRaw.created_at,
          beforeProfileId: lastRaw.record_id,
        };
      }
    }

    const items: AdminUserInvitationStateItem[] = [];

    for (const row of rawItems) {
      if (row.record_kind === "profile") {
        if (
          !row.profile_id ||
          !row.full_name ||
          typeof row.is_active !== "boolean" ||
          typeof row.email_notifications_enabled !== "boolean" ||
          typeof row.whatsapp_opt_in !== "boolean"
        ) {
          logger.debug(
            "fetchAdminUserInvitationStatePage: malformed profile row",
          );
          return { status: "unavailable", code: "UNAVAILABLE" };
        }

        const profileItem: AdminProfileStateItem = {
          kind: "profile",
          createdAt: row.created_at,
          fullName: row.full_name,
          applicationRole: row.application_role,
          isActive: row.is_active,
          preferredLocale:
            row.preferred_locale === "es-MX" || row.preferred_locale === "en-US"
              ? row.preferred_locale
              : null,
          emailNotificationsEnabled: row.email_notifications_enabled,
          whatsappOptIn: row.whatsapp_opt_in,
          lastSeenAt: row.last_seen_at,
        };
        items.push(profileItem);
      } else if (row.record_kind === "invitation") {
        if (
          !row.invitation_id ||
          !row.invitation_status ||
          !["pending", "accepted", "expired", "revoked"].includes(
            row.invitation_status,
          )
        ) {
          logger.debug(
            "fetchAdminUserInvitationStatePage: malformed invitation row",
          );
          return { status: "unavailable", code: "UNAVAILABLE" };
        }

        const invitationItem: AdminInvitationStateItem = {
          kind: "invitation",
          createdAt: row.created_at,
          applicationRole: row.application_role,
          invitationStatus: row.invitation_status,
          projectName: row.project_name,
          invitationExpiresAt: row.invitation_expires_at,
          invitationAcceptedAt: row.invitation_accepted_at,
          invitationRevokedAt: row.invitation_revoked_at,
        };
        items.push(invitationItem);
      } else {
        logger.debug("fetchAdminUserInvitationStatePage: unknown record_kind", {
          kind: row.record_kind,
        });
        return { status: "unavailable", code: "UNAVAILABLE" };
      }
    }

    return {
      status: "available",
      data: {
        items,
        nextCursor,
        hasMore,
      },
    };
  } catch (err) {
    logger.debug("fetchAdminUserInvitationStatePage failed", { err });
    return { status: "unavailable", code: "UNAVAILABLE" };
  }
}
