import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { UUID_SCHEMA } from "./schemas";
import type {
  AccountAccessActionResult,
  UpdateOwnAccountSettingsInput,
  SetUserAccessSuccessCode,
  SetUserAccessFailureCode,
  RecordStaleReminderSuccessCode,
  RecordStaleReminderFailureCode,
  SubmitBugReportInput,
  BugReportStatus,
  SetBugReportStatusSuccessCode,
  SetBugReportStatusFailureCode,
} from "./types";

export async function updateOwnAccountSettings(
  supabase: SupabaseClient<Database>,
  input: UpdateOwnAccountSettingsInput,
): Promise<
  AccountAccessActionResult<UpdateOwnAccountSettingsInput, "UNAVAILABLE">
> {
  try {
    const { data, error } = await supabase.rpc("update_own_account_settings", {
      p_full_name: input.fullName,
      p_preferred_locale: input.preferredLocale,
      p_timezone: input.timezone,
      p_email_notifications_enabled: input.emailNotificationsEnabled,
    });

    if (error || !Array.isArray(data) || data.length !== 1) {
      return { ok: false, error: { code: "UNAVAILABLE" } };
    }

    const row = data[0];
    if (
      row &&
      typeof row === "object" &&
      row.success === true &&
      row.code === "updated"
    ) {
      return { ok: true, data: input };
    }

    return { ok: false, error: { code: "UNAVAILABLE" } };
  } catch {
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }
}

export async function setUserAccessState(
  supabase: SupabaseClient<Database>,
  targetUserId: string,
  isActive: boolean,
): Promise<
  AccountAccessActionResult<
    { code: SetUserAccessSuccessCode },
    SetUserAccessFailureCode
  >
> {
  try {
    const { data, error } = await supabase.rpc("set_user_access_state", {
      p_target_user_id: targetUserId,
      p_is_active: isActive,
    });

    if (error || !Array.isArray(data) || data.length !== 1) {
      return { ok: false, error: { code: "UNAVAILABLE" } };
    }

    const row = data[0];
    if (!row || typeof row !== "object") {
      return { ok: false, error: { code: "UNAVAILABLE" } };
    }

    if (row.success === true) {
      if (
        row.code === "deactivated" ||
        row.code === "reactivated" ||
        row.code === "already_in_requested_state"
      ) {
        return {
          ok: true,
          data: { code: row.code as SetUserAccessSuccessCode },
        };
      }
    } else if (row.success === false) {
      if (
        row.code === "self_lockout_forbidden" ||
        row.code === "last_management_account_forbidden" ||
        row.code === "not_found"
      ) {
        return {
          ok: false,
          error: { code: row.code as SetUserAccessFailureCode },
        };
      }
    }

    return { ok: false, error: { code: "UNAVAILABLE" } };
  } catch {
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }
}

export async function recordStaleAccessReminder(
  supabase: SupabaseClient<Database>,
  targetUserId: string,
): Promise<
  AccountAccessActionResult<
    { code: RecordStaleReminderSuccessCode },
    RecordStaleReminderFailureCode
  >
> {
  try {
    const { data, error } = await supabase.rpc("record_stale_access_reminder", {
      p_target_user_id: targetUserId,
    });

    if (error || !Array.isArray(data) || data.length !== 1) {
      return { ok: false, error: { code: "UNAVAILABLE" } };
    }

    const row = data[0];
    if (!row || typeof row !== "object") {
      return { ok: false, error: { code: "UNAVAILABLE" } };
    }

    if (row.success === true && row.code === "recorded") {
      return { ok: true, data: { code: "recorded" } };
    }

    if (
      row.success === false &&
      row.code === "not_eligible_or_already_recorded"
    ) {
      return {
        ok: false,
        error: { code: "not_eligible_or_already_recorded" },
      };
    }

    return { ok: false, error: { code: "UNAVAILABLE" } };
  } catch {
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }
}

export async function submitBugReport(
  supabase: SupabaseClient<Database>,
  input: SubmitBugReportInput,
): Promise<
  AccountAccessActionResult<{ reportId: string; status: "open" }, "UNAVAILABLE">
> {
  try {
    const { data, error } = await supabase.rpc("submit_bug_report", {
      p_title: input.title,
      p_description: input.description,
    });

    if (error || !Array.isArray(data) || data.length !== 1) {
      return { ok: false, error: { code: "UNAVAILABLE" } };
    }

    const row = data[0];
    if (!row || typeof row !== "object") {
      return { ok: false, error: { code: "UNAVAILABLE" } };
    }

    const reportIdValid = UUID_SCHEMA.safeParse(row.report_id).success;
    if (reportIdValid && row.status === "open") {
      return { ok: true, data: { reportId: row.report_id, status: "open" } };
    }

    return { ok: false, error: { code: "UNAVAILABLE" } };
  } catch {
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }
}

export async function setBugReportStatus(
  supabase: SupabaseClient<Database>,
  reportId: string,
  status: BugReportStatus,
): Promise<
  AccountAccessActionResult<
    { code: SetBugReportStatusSuccessCode },
    SetBugReportStatusFailureCode
  >
> {
  try {
    const { data, error } = await supabase.rpc("set_bug_report_status", {
      p_report_id: reportId,
      p_status: status,
    });

    if (error || !Array.isArray(data) || data.length !== 1) {
      return { ok: false, error: { code: "UNAVAILABLE" } };
    }

    const row = data[0];
    if (!row || typeof row !== "object") {
      return { ok: false, error: { code: "UNAVAILABLE" } };
    }

    if (row.success === true && row.code === "updated") {
      return { ok: true, data: { code: "updated" } };
    }

    if (row.success === false && row.code === "not_found_or_unchanged") {
      return {
        ok: false,
        error: { code: "not_found_or_unchanged" },
      };
    }

    return { ok: false, error: { code: "UNAVAILABLE" } };
  } catch {
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }
}
