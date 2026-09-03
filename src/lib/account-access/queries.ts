import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  UUID_SCHEMA,
  IsoTimestampSchema,
  NullableIsoTimestampSchema,
  InitialUserAccessDirectoryCursorSchema,
  InitialBugReportCursorSchema,
} from "./schemas";
import type {
  AvailableResult,
  OwnAccountSettingsDto,
  UserAccessDirectoryPageDto,
  UserAccessDirectoryCursor,
  UserAccessDirectoryItemDto,
  StaleAccessCandidateDto,
  BugReportPageDto,
  BugReportCursor,
  BugReportItemDto,
  AppRole,
  BugReportStatus,
  AccessActionType,
  PreferredLocale,
} from "./types";

const VALID_ROLES: readonly AppRole[] = ["admin", "pm", "operator", "client"];
const VALID_BUG_STATUSES: readonly BugReportStatus[] = [
  "open",
  "triaged",
  "resolved",
  "dismissed",
];

export async function fetchOwnAccountSettings(
  supabase: SupabaseClient<Database>,
): Promise<AvailableResult<OwnAccountSettingsDto>> {
  try {
    const { data, error } = await supabase.rpc("get_own_account_settings");

    if (error || !Array.isArray(data) || data.length !== 1) {
      return { status: "unavailable" };
    }

    const row = data[0];
    if (!row || typeof row !== "object") {
      return { status: "unavailable" };
    }

    const userIdValid = UUID_SCHEMA.safeParse(row.user_id).success;
    const fullNameValid =
      typeof row.full_name === "string" &&
      row.full_name.trim().length >= 1 &&
      row.full_name.length <= 120;
    const localeValid =
      row.preferred_locale === "en-US" || row.preferred_locale === "es-MX";
    const timezoneValid =
      typeof row.timezone === "string" &&
      row.timezone.trim().length >= 1 &&
      row.timezone.length <= 100;
    const emailNotifValid =
      typeof row.email_notifications_enabled === "boolean";
    const roleValid = VALID_ROLES.includes(row.role as AppRole);

    if (
      !userIdValid ||
      !fullNameValid ||
      !localeValid ||
      !timezoneValid ||
      !emailNotifValid ||
      !roleValid
    ) {
      return { status: "unavailable" };
    }

    return {
      status: "available",
      data: {
        userId: row.user_id,
        fullName: row.full_name,
        preferredLocale: row.preferred_locale as PreferredLocale,
        timezone: row.timezone,
        emailNotificationsEnabled: row.email_notifications_enabled,
        role: row.role as AppRole,
      },
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function fetchUserAccessDirectory(
  supabase: SupabaseClient<Database>,
  cursor?: UserAccessDirectoryCursor | null,
): Promise<AvailableResult<UserAccessDirectoryPageDto>> {
  try {
    const cursorValidation =
      InitialUserAccessDirectoryCursorSchema.safeParse(cursor);
    if (!cursorValidation.success) {
      return { status: "unavailable" };
    }

    const { data, error } = await supabase.rpc("list_user_access_directory", {
      p_before_created_at: cursor?.beforeCreatedAt ?? undefined,
      p_before_user_id: cursor?.beforeUserId ?? undefined,
      p_limit: 26,
    });

    if (error || !Array.isArray(data) || data.length > 26) {
      return { status: "unavailable" };
    }

    for (const row of data) {
      if (!row || typeof row !== "object") {
        return { status: "unavailable" };
      }

      const uidValid = UUID_SCHEMA.safeParse(row.user_id).success;
      const createdAtValid = IsoTimestampSchema.safeParse(
        row.created_at,
      ).success;
      const nameValid =
        typeof row.full_name === "string" && row.full_name.trim().length > 0;
      const roleValid = VALID_ROLES.includes(row.application_role as AppRole);
      const activeValid = typeof row.is_active === "boolean";
      const lastAuthValid = NullableIsoTimestampSchema.safeParse(
        row.last_successful_auth_at,
      ).success;

      const pmCountValid =
        typeof row.active_project_membership_count === "number" &&
        Number.isSafeInteger(row.active_project_membership_count) &&
        row.active_project_membership_count >= 0;
      const taskCountValid =
        typeof row.active_task_assignment_count === "number" &&
        Number.isSafeInteger(row.active_task_assignment_count) &&
        row.active_task_assignment_count >= 0;
      const delivCountValid =
        typeof row.active_deliverable_assignment_count === "number" &&
        Number.isSafeInteger(row.active_deliverable_assignment_count) &&
        row.active_deliverable_assignment_count >= 0;
      const inviteCountValid =
        typeof row.pending_invitation_count === "number" &&
        Number.isSafeInteger(row.pending_invitation_count) &&
        row.pending_invitation_count >= 0;

      const lastActionValid =
        row.last_access_action === null ||
        row.last_access_action === "deactivated" ||
        row.last_access_action === "reactivated";
      const lastActionAtValid = NullableIsoTimestampSchema.safeParse(
        row.last_access_action_at,
      ).success;

      if (
        !uidValid ||
        !createdAtValid ||
        !nameValid ||
        !roleValid ||
        !activeValid ||
        !lastAuthValid ||
        !pmCountValid ||
        !taskCountValid ||
        !delivCountValid ||
        !inviteCountValid ||
        !lastActionValid ||
        !lastActionAtValid
      ) {
        return { status: "unavailable" };
      }
    }

    const hasMore = data.length === 26;
    const visibleRows = hasMore ? data.slice(0, 25) : data;

    const nextCursor: UserAccessDirectoryCursor | null = hasMore
      ? {
          beforeCreatedAt: visibleRows[24].created_at,
          beforeUserId: visibleRows[24].user_id,
        }
      : null;

    const items: readonly UserAccessDirectoryItemDto[] = visibleRows.map(
      (r) => ({
        userId: r.user_id,
        createdAt: r.created_at,
        fullName: r.full_name,
        applicationRole: r.application_role as AppRole,
        isActive: r.is_active,
        lastSuccessfulAuthAt: r.last_successful_auth_at,
        activeProjectMembershipCount: r.active_project_membership_count,
        activeTaskAssignmentCount: r.active_task_assignment_count,
        activeDeliverableAssignmentCount: r.active_deliverable_assignment_count,
        pendingInvitationCount: r.pending_invitation_count,
        lastAccessAction: r.last_access_action as AccessActionType | null,
        lastAccessActionAt: r.last_access_action_at,
      }),
    );

    return {
      status: "available",
      data: {
        items,
        nextCursor,
        hasMore,
      },
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function fetchStaleAccessReminderCandidates(
  supabase: SupabaseClient<Database>,
): Promise<AvailableResult<readonly StaleAccessCandidateDto[]>> {
  try {
    const { data, error } = await supabase.rpc(
      "list_stale_access_reminder_candidates",
    );

    if (error || !Array.isArray(data)) {
      return { status: "unavailable" };
    }

    const items: StaleAccessCandidateDto[] = [];

    for (const row of data) {
      if (!row || typeof row !== "object") {
        return { status: "unavailable" };
      }

      const uidValid = UUID_SCHEMA.safeParse(row.user_id).success;
      const nameValid =
        typeof row.full_name === "string" && row.full_name.trim().length > 0;
      const periodValid = IsoTimestampSchema.safeParse(
        row.inactivity_period_started_at,
      ).success;

      if (
        !uidValid ||
        !nameValid ||
        !periodValid ||
        (row.application_role !== "client" &&
          row.application_role !== "operator")
      ) {
        return { status: "unavailable" };
      }

      items.push({
        userId: row.user_id,
        fullName: row.full_name,
        applicationRole: row.application_role,
        inactivityPeriodStartedAt: row.inactivity_period_started_at,
      });
    }

    return {
      status: "available",
      data: items,
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function fetchBugReports(
  supabase: SupabaseClient<Database>,
  cursor?: BugReportCursor | null,
): Promise<AvailableResult<BugReportPageDto>> {
  try {
    const cursorValidation = InitialBugReportCursorSchema.safeParse(cursor);
    if (!cursorValidation.success) {
      return { status: "unavailable" };
    }

    const { data, error } = await supabase.rpc("list_bug_reports", {
      p_before_created_at: cursor?.beforeCreatedAt ?? undefined,
      p_before_report_id: cursor?.beforeReportId ?? undefined,
      p_limit: 26,
    });

    if (error || !Array.isArray(data) || data.length > 26) {
      return { status: "unavailable" };
    }

    for (const row of data) {
      if (!row || typeof row !== "object") {
        return { status: "unavailable" };
      }

      const reportIdValid = UUID_SCHEMA.safeParse(row.report_id).success;
      const titleValid =
        typeof row.title === "string" && row.title.trim().length > 0;
      const descValid =
        typeof row.description === "string" &&
        row.description.trim().length > 0;
      const statusValid = VALID_BUG_STATUSES.includes(
        row.status as BugReportStatus,
      );
      const roleValid = VALID_ROLES.includes(row.reporter_role as AppRole);
      const createdAtValid = IsoTimestampSchema.safeParse(
        row.created_at,
      ).success;
      const changedAtValid = NullableIsoTimestampSchema.safeParse(
        row.status_changed_at,
      ).success;

      if (
        !reportIdValid ||
        !titleValid ||
        !descValid ||
        !statusValid ||
        !roleValid ||
        !createdAtValid ||
        !changedAtValid
      ) {
        return { status: "unavailable" };
      }
    }

    const hasMore = data.length === 26;
    const visibleRows = hasMore ? data.slice(0, 25) : data;

    const nextCursor: BugReportCursor | null = hasMore
      ? {
          beforeCreatedAt: visibleRows[24].created_at,
          beforeReportId: visibleRows[24].report_id,
        }
      : null;

    const items: readonly BugReportItemDto[] = visibleRows.map((r) => ({
      reportId: r.report_id,
      title: r.title,
      description: r.description,
      status: r.status as BugReportStatus,
      reporterRole: r.reporter_role as AppRole,
      createdAt: r.created_at,
      statusChangedAt: r.status_changed_at,
    }));

    return {
      status: "available",
      data: {
        items,
        nextCursor,
        hasMore,
      },
    };
  } catch {
    return { status: "unavailable" };
  }
}
