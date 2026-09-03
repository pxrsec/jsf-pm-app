import type { Database } from "@/lib/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type BugReportStatus = Database["public"]["Enums"]["bug_report_status"];
export type AccessActionType = "deactivated" | "reactivated";
export type PreferredLocale = "en-US" | "es-MX";

export interface OwnAccountSettingsDto {
  readonly userId: string;
  readonly fullName: string;
  readonly preferredLocale: PreferredLocale;
  readonly timezone: string;
  readonly emailNotificationsEnabled: boolean;
  readonly role: AppRole;
}

export interface UpdateOwnAccountSettingsInput {
  readonly fullName: string;
  readonly preferredLocale: PreferredLocale;
  readonly timezone: string;
  readonly emailNotificationsEnabled: boolean;
}

export interface UserAccessDirectoryItemDto {
  readonly userId: string;
  readonly createdAt: string; // cursor carrier only; not rendered in UI
  readonly fullName: string;
  readonly applicationRole: AppRole;
  readonly isActive: boolean;
  readonly lastSuccessfulAuthAt: string | null;
  readonly activeProjectMembershipCount: number;
  readonly activeTaskAssignmentCount: number;
  readonly activeDeliverableAssignmentCount: number;
  readonly pendingInvitationCount: number;
  readonly lastAccessAction: AccessActionType | null;
  readonly lastAccessActionAt: string | null;
}

export interface UserAccessDirectoryCursor {
  readonly beforeCreatedAt: string;
  readonly beforeUserId: string;
}

export interface UserAccessDirectoryPageDto {
  readonly items: readonly UserAccessDirectoryItemDto[];
  readonly nextCursor: UserAccessDirectoryCursor | null;
  readonly hasMore: boolean;
}

export type SetUserAccessSuccessCode =
  "deactivated" | "reactivated" | "already_in_requested_state";

export type SetUserAccessFailureCode =
  | "self_lockout_forbidden"
  | "last_management_account_forbidden"
  | "not_found"
  | "UNAUTHORIZED"
  | "VALIDATION_FAILED"
  | "UNAVAILABLE";

export interface StaleAccessCandidateDto {
  readonly userId: string;
  readonly fullName: string;
  readonly applicationRole: "client" | "operator";
  readonly inactivityPeriodStartedAt: string;
}

export type RecordStaleReminderSuccessCode = "recorded";
export type RecordStaleReminderFailureCode =
  | "not_eligible_or_already_recorded"
  | "UNAUTHORIZED"
  | "VALIDATION_FAILED"
  | "UNAVAILABLE";

export interface SubmitBugReportInput {
  readonly title: string;
  readonly description: string;
}

export interface BugReportItemDto {
  readonly reportId: string;
  readonly title: string;
  readonly description: string;
  readonly status: BugReportStatus;
  readonly reporterRole: AppRole;
  readonly createdAt: string;
  readonly statusChangedAt: string | null;
}

export interface BugReportCursor {
  readonly beforeCreatedAt: string;
  readonly beforeReportId: string;
}

export interface BugReportPageDto {
  readonly items: readonly BugReportItemDto[];
  readonly nextCursor: BugReportCursor | null;
  readonly hasMore: boolean;
}

export type SetBugReportStatusSuccessCode = "updated";
export type SetBugReportStatusFailureCode =
  | "not_found_or_unchanged"
  | "UNAUTHORIZED"
  | "VALIDATION_FAILED"
  | "UNAVAILABLE";

export type AvailableResult<T> =
  { status: "available"; data: T } | { status: "unavailable" };

export type AccountAccessActionResult<TData, TError = string> =
  { ok: true; data: TData } | { ok: false; error: { code: TError } };

export interface DateTimePresentationContext {
  readonly locale: "es-MX" | "en-US";
  readonly timeZone: string;
}
