import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { SessionContext } from "@/lib/auth/session";

export class NotificationOperationsAuthorizationError extends Error {
  constructor() {
    super("Notification operations access denied");
    this.name = "NotificationOperationsAuthorizationError";
  }
}

/**
 * Checks whether a user holds at least one active, non-deleted pm_lead project membership
 * with an active, non-deleted pm profile.
 * Uses an existence query (.limit(1)) to support multiple PM lead memberships safely.
 */
export async function hasActivePmLeadMembership(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("project_members")
    .select("id, profiles!inner(is_active, deleted_at, role)")
    .eq("user_id", userId)
    .eq("member_type", "pm_lead")
    .is("deleted_at", null)
    .eq("profiles.is_active", true)
    .is("profiles.deleted_at", null)
    .eq("profiles.role", "pm")
    .limit(1);

  return !error && Boolean(data?.length);
}

/**
 * Validates that the active session has authorized internal operational queue capacity.
 * Admin succeeds globally without membership query.
 * PM requires active pm_lead membership.
 * All other roles / inactive states fail closed and throw NotificationOperationsAuthorizationError.
 */
export async function assertNotificationOperationsAccess(
  supabase: SupabaseClient<Database>,
  session: SessionContext,
): Promise<"admin" | "pm_lead"> {
  if (session.role === "admin") {
    return "admin";
  }

  if (session.role === "pm") {
    const isLead = await hasActivePmLeadMembership(supabase, session.user.id);
    if (isLead) {
      return "pm_lead";
    }
    throw new NotificationOperationsAuthorizationError();
  }

  throw new NotificationOperationsAuthorizationError();
}
