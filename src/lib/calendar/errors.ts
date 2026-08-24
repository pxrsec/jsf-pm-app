export type CalendarErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "CONFLICT"
  | "INVARIANT_VIOLATION"
  | "UNKNOWN";

export interface CalendarError {
  code: CalendarErrorCode;
  message: string;
}

export type CalendarCommandResult<T> =
  { ok: true; data: T } | { ok: false; error: CalendarError };

/**
 * Maps Supabase RPC and PostgREST errors to safe, non-leaking application errors.
 * Never exposes raw SQL error messages, internal function names, or table internals.
 */
export function mapCalendarSupabaseError(
  error: { code?: string; message?: string } | null | undefined,
): CalendarError {
  if (!error) {
    return { code: "UNKNOWN", message: "An unexpected error occurred." };
  }

  const msg = error.message ?? "";

  if (
    msg.includes("Authentication with an active profile is required") ||
    msg.includes("Calendar milestone management is not permitted") ||
    msg.includes("Not authorized") ||
    msg.includes("permission denied") ||
    error.code === "42501"
  ) {
    return {
      code: "UNAUTHORIZED",
      message: "You do not have permission to perform this action.",
    };
  }

  if (
    msg.includes("Calendar milestone not found") ||
    msg.includes("Calendar milestone project not found") ||
    error.code === "PGRST116"
  ) {
    return {
      code: "NOT_FOUND",
      message: "The requested milestone or project could not be found.",
    };
  }

  if (
    msg.includes(
      "Calendar milestone task must belong to the milestone project",
    ) ||
    msg.includes("Calendar milestone task must exist and be active") ||
    msg.includes("Milestone ends_at must not precede starts_at")
  ) {
    return {
      code: "INVARIANT_VIOLATION",
      message: "The milestone data violates project or task consistency rules.",
    };
  }

  if (
    msg.includes("Milestone title must contain") ||
    msg.includes("Milestone description must not exceed") ||
    msg.includes("Calendar range must") ||
    msg.includes("Milestone color_override must be") ||
    error.code === "22000" ||
    error.code === "23502"
  ) {
    return {
      code: "VALIDATION_FAILED",
      message: "The submitted milestone information is invalid.",
    };
  }

  return {
    code: "UNKNOWN",
    message:
      "An unexpected error occurred while processing the calendar request.",
  };
}
