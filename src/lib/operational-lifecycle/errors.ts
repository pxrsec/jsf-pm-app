import type { OperationalLifecycleFailureCode } from "./types";

const KNOWN_FAILURE_CODES = new Set<OperationalLifecycleFailureCode>([
  "archive_required",
  "dependencies_present",
  "not_found",
  "not_found_or_parent_archived",
  "not_found_or_archive_required",
  "not_found_or_archived",
  "not_found_or_active",
  "UNAUTHORIZED",
  "VALIDATION_FAILED",
  "UNAVAILABLE",
]);

export function mapOperationalLifecycleFailureCode(
  rawCode: unknown,
): OperationalLifecycleFailureCode {
  if (
    typeof rawCode === "string" &&
    KNOWN_FAILURE_CODES.has(rawCode as OperationalLifecycleFailureCode)
  ) {
    return rawCode as OperationalLifecycleFailureCode;
  }
  return "UNAVAILABLE";
}

export function getOperationalLifecycleErrorKey(
  code: OperationalLifecycleFailureCode,
): string {
  switch (code) {
    case "archive_required":
      return "archiveRequired";
    case "dependencies_present":
      return "dependenciesPresent";
    case "not_found":
      return "notFound";
    case "not_found_or_parent_archived":
      return "notFoundOrParentArchived";
    case "not_found_or_archive_required":
      return "notFoundOrArchiveRequired";
    case "not_found_or_archived":
      return "notFoundOrArchived";
    case "not_found_or_active":
      return "notFoundOrActive";
    case "UNAUTHORIZED":
      return "unauthorized";
    case "VALIDATION_FAILED":
      return "invalidInput";
    case "UNAVAILABLE":
    default:
      return "lifecycleUnavailable";
  }
}
