export type AppCommandErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "INVARIANT_VIOLATION"
  | "VALIDATION_FAILED"
  | "CONFLICT"
  | "UNKNOWN";

export type AppCommandError = {
  code: AppCommandErrorCode;
  message: string;
  detail?: string;
};

export type CommandResult<T> =
  { ok: true; data: T } | { ok: false; error: AppCommandError };

/**
 * Maps Supabase PostgREST and RPC/trigger exceptions to structured, safe application errors.
 * Never exposes raw database error strings, internal function names, or sensitive details to the browser.
 */
export function mapSupabaseError(
  error: { code?: string; message?: string } | null,
): AppCommandError {
  if (!error)
    return { code: "UNKNOWN", message: "An unexpected error occurred." };

  const msg = error.message ?? "";

  if (
    msg.includes("Not authorized") ||
    msg.includes("Only an active PM Lead") ||
    msg.includes("Only active PM Lead") ||
    msg.includes("Only Admin") ||
    msg.includes(
      "Only the direct Client assignee can submit this deliverable",
    ) ||
    msg.includes("cannot post internal collaboration comments") ||
    error.code === "42501"
  ) {
    return {
      code: "UNAUTHORIZED",
      message: "You do not have permission to perform this action.",
    };
  }

  if (
    msg.includes("not found or deleted") ||
    msg.includes("not found") ||
    error.code === "PGRST116"
  ) {
    return {
      code: "NOT_FOUND",
      message: "The requested item could not be found.",
    };
  }

  if (
    msg.includes("Illegal transition") ||
    msg.includes("cannot be transitioned") ||
    msg.includes("cannot submit version") ||
    msg.includes("is not in awaiting_internal_review") ||
    msg.includes("must be approved before marking delivered") ||
    msg.includes("is not pending") ||
    msg.includes("is not a client_submission workflow")
  ) {
    return {
      code: "INVALID_TRANSITION",
      message: "This action is not allowed in the current status.",
    };
  }

  if (
    msg.includes("Submission URL must be a valid public HTTPS URL") ||
    msg.includes("Submission note must be 1000 characters or fewer")
  ) {
    return {
      code: "VALIDATION_FAILED",
      message: "The submitted data is invalid.",
    };
  }

  if (
    msg.includes("unfinished") ||
    msg.includes("requires a non-empty") ||
    msg.includes("Comments are mandatory") ||
    msg.includes("confirm_unfinished") ||
    msg.includes("Only client projects can have production deliverables") ||
    msg.includes("Project must have at least one active PM Lead") ||
    msg.includes("Project must have exactly one primary PM Lead")
  ) {
    return {
      code: "INVARIANT_VIOLATION",
      message: "Required conditions or confirmation are missing.",
    };
  }

  if (
    msg.includes("duplicate") ||
    msg.includes("already exists") ||
    msg.includes("unique") ||
    error.code === "23505"
  ) {
    return {
      code: "CONFLICT",
      message: "This item already exists or conflicts with existing data.",
    };
  }

  return {
    code: "UNKNOWN",
    message: "An unexpected error occurred. Please try again.",
  };
}
