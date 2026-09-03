"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireSession, AuthError } from "@/lib/auth/session";
import {
  UpdateOwnAccountSettingsSchema,
  SetUserAccessStateInputSchema,
  RecordStaleReminderSchema,
  SubmitBugReportSchema,
  SetBugReportStatusSchema,
  UserAccessDirectoryCursorSchema,
  BugReportCursorSchema,
} from "./schemas";
import {
  updateOwnAccountSettings,
  setUserAccessState,
  recordStaleAccessReminder,
  submitBugReport,
  setBugReportStatus,
} from "./commands";
import { fetchUserAccessDirectory, fetchBugReports } from "./queries";
import { revalidateAccountScope, revalidateManagerScope } from "./revalidation";
import type {
  AccountAccessActionResult,
  UpdateOwnAccountSettingsInput,
  SetUserAccessSuccessCode,
  SetUserAccessFailureCode,
  RecordStaleReminderSuccessCode,
  RecordStaleReminderFailureCode,
  SetBugReportStatusSuccessCode,
  SetBugReportStatusFailureCode,
  UserAccessDirectoryPageDto,
  BugReportPageDto,
} from "./types";

export async function updateOwnAccountSettingsAction(
  rawInput: unknown,
): Promise<
  AccountAccessActionResult<
    UpdateOwnAccountSettingsInput,
    "UNAUTHORIZED" | "VALIDATION_FAILED" | "UNAVAILABLE"
  >
> {
  const cookieStore = await cookies();
  try {
    await requireSession(cookieStore);
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: { code: "UNAUTHORIZED" } };
    }
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }

  const parsed = UpdateOwnAccountSettingsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_FAILED" } };
  }

  const supabase = createClient(cookieStore);
  const result = await updateOwnAccountSettings(supabase, parsed.data);
  if (result.ok) {
    revalidateAccountScope();
  }
  return result;
}

export async function setUserAccessStateAction(
  rawInput: unknown,
): Promise<
  AccountAccessActionResult<
    { code: SetUserAccessSuccessCode },
    SetUserAccessFailureCode
  >
> {
  const cookieStore = await cookies();
  let session;
  try {
    session = await requireSession(cookieStore);
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: { code: "UNAUTHORIZED" } };
    }
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }

  if (session.role !== "admin" && session.role !== "pm") {
    return { ok: false, error: { code: "UNAUTHORIZED" } };
  }

  const parsed = SetUserAccessStateInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_FAILED" } };
  }

  const supabase = createClient(cookieStore);
  const result = await setUserAccessState(
    supabase,
    parsed.data.targetUserId,
    parsed.data.isActive,
  );

  if (result.ok || (!result.ok && result.error.code === "not_found")) {
    revalidateManagerScope();
  }
  return result;
}

export async function recordStaleAccessReminderAction(
  rawInput: unknown,
): Promise<
  AccountAccessActionResult<
    { code: RecordStaleReminderSuccessCode },
    RecordStaleReminderFailureCode
  >
> {
  const cookieStore = await cookies();
  let session;
  try {
    session = await requireSession(cookieStore);
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: { code: "UNAUTHORIZED" } };
    }
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }

  if (session.role !== "admin" && session.role !== "pm") {
    return { ok: false, error: { code: "UNAUTHORIZED" } };
  }

  const parsed = RecordStaleReminderSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_FAILED" } };
  }

  const supabase = createClient(cookieStore);
  const result = await recordStaleAccessReminder(
    supabase,
    parsed.data.targetUserId,
  );

  if (
    result.ok ||
    (!result.ok && result.error.code === "not_eligible_or_already_recorded")
  ) {
    revalidateManagerScope();
  }
  return result;
}

export async function submitBugReportAction(
  rawInput: unknown,
): Promise<
  AccountAccessActionResult<
    { reportId: string; status: "open" },
    "UNAUTHORIZED" | "VALIDATION_FAILED" | "UNAVAILABLE"
  >
> {
  const cookieStore = await cookies();
  try {
    await requireSession(cookieStore);
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: { code: "UNAUTHORIZED" } };
    }
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }

  const parsed = SubmitBugReportSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_FAILED" } };
  }

  const supabase = createClient(cookieStore);
  const result = await submitBugReport(supabase, parsed.data);
  if (result.ok) {
    revalidateManagerScope();
  }
  return result;
}

export async function setBugReportStatusAction(
  rawInput: unknown,
): Promise<
  AccountAccessActionResult<
    { code: SetBugReportStatusSuccessCode },
    SetBugReportStatusFailureCode
  >
> {
  const cookieStore = await cookies();
  let session;
  try {
    session = await requireSession(cookieStore);
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: { code: "UNAUTHORIZED" } };
    }
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }

  if (session.role !== "admin" && session.role !== "pm") {
    return { ok: false, error: { code: "UNAUTHORIZED" } };
  }

  const parsed = SetBugReportStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_FAILED" } };
  }

  const supabase = createClient(cookieStore);
  const result = await setBugReportStatus(
    supabase,
    parsed.data.reportId,
    parsed.data.status,
  );

  if (
    result.ok ||
    (!result.ok && result.error.code === "not_found_or_unchanged")
  ) {
    revalidateManagerScope();
  }
  return result;
}

export async function loadMoreUserAccessDirectoryAction(
  rawCursor: unknown,
): Promise<
  AccountAccessActionResult<
    UserAccessDirectoryPageDto,
    "UNAUTHORIZED" | "VALIDATION_FAILED" | "UNAVAILABLE"
  >
> {
  const cookieStore = await cookies();
  let session;
  try {
    session = await requireSession(cookieStore);
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: { code: "UNAUTHORIZED" } };
    }
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }

  if (session.role !== "admin" && session.role !== "pm") {
    return { ok: false, error: { code: "UNAUTHORIZED" } };
  }

  const parsed = UserAccessDirectoryCursorSchema.safeParse(rawCursor);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_FAILED" } };
  }

  const supabase = createClient(cookieStore);
  const pageResult = await fetchUserAccessDirectory(supabase, parsed.data);
  return pageResult.status === "available"
    ? { ok: true, data: pageResult.data }
    : { ok: false, error: { code: "UNAVAILABLE" } };
}

export async function loadMoreBugReportsAction(
  rawCursor: unknown,
): Promise<
  AccountAccessActionResult<
    BugReportPageDto,
    "UNAUTHORIZED" | "VALIDATION_FAILED" | "UNAVAILABLE"
  >
> {
  const cookieStore = await cookies();
  let session;
  try {
    session = await requireSession(cookieStore);
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: { code: "UNAUTHORIZED" } };
    }
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }

  if (session.role !== "admin" && session.role !== "pm") {
    return { ok: false, error: { code: "UNAUTHORIZED" } };
  }

  const parsed = BugReportCursorSchema.safeParse(rawCursor);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_FAILED" } };
  }

  const supabase = createClient(cookieStore);
  const pageResult = await fetchBugReports(supabase, parsed.data);
  return pageResult.status === "available"
    ? { ok: true, data: pageResult.data }
    : { ok: false, error: { code: "UNAVAILABLE" } };
}
