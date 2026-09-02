export type OperationalLifecycleEntityType =
  "project" | "task" | "deliverable" | "milestone";

export type OperationalLifecycleMutationCode =
  "archived" | "restored" | "permanently_deleted";

export type OperationalLifecycleIdempotentCode =
  "already_archived" | "already_active";

export type OperationalLifecycleFailureCode =
  | "archive_required"
  | "dependencies_present"
  | "not_found"
  | "not_found_or_parent_archived"
  | "not_found_or_archive_required"
  | "not_found_or_archived"
  | "not_found_or_active"
  | "UNAUTHORIZED"
  | "VALIDATION_FAILED"
  | "UNAVAILABLE";

export type OperationalDeletionBlockerCode =
  | "archive_required"
  | "dependencies_present"
  | "not_found"
  | "not_found_or_parent_archived"
  | "not_found_or_archive_required";

export type OperationalLifecycleMutationOutcome = {
  code: OperationalLifecycleMutationCode | OperationalLifecycleIdempotentCode;
};

export type OperationalLifecycleActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: OperationalLifecycleFailureCode;
      };
    };

export type OperationalRecycleBinItem = {
  entityType: OperationalLifecycleEntityType;
  entityId: string;
  projectId: string | null;
  title: string;
  archivedAt: string;
  archivedBy: string | null;
  archiveReason: string | null;
  parentIsArchived: boolean;
};

export type OperationalDeletionPreviewDto = {
  entityType: OperationalLifecycleEntityType;
  entityId: string;
  title: string;
  canDelete: boolean;
  blockerCode: OperationalDeletionBlockerCode | null;
};

export type AvailableResult<T> =
  { status: "available"; data: T } | { status: "unavailable" };
