import { TZDate } from "@date-fns/tz";
import {
  CALENDAR_TIME_ZONE,
  formatIsoWithOffset,
} from "@/lib/calendar/date-utils";
import type {
  FinalizedArchiveQuery,
  FinalizedArchiveStatus,
  LinkIncidentQuery,
  LinkIncidentStatus,
} from "./types";

export { CALENDAR_TIME_ZONE, formatIsoWithOffset };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ISO_DATETIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

/**
 * Calculates the canonical latest 90-day archive date range:
 * [now - 90 days, now) formatted with offset in America/Mexico_City.
 */
export function getDefaultArchiveRange(referenceDate?: Date): {
  from: string;
  to: string;
} {
  const ref = referenceDate ?? new Date();
  const toTz = new TZDate(ref, CALENDAR_TIME_ZONE);
  const fromTz = new TZDate(
    toTz.getTime() - 90 * 24 * 60 * 60 * 1000,
    CALENDAR_TIME_ZONE,
  );

  return {
    from: formatIsoWithOffset(fromTz),
    to: formatIsoWithOffset(toTz),
  };
}

/**
 * Validates whether a given ISO date range is valid:
 * 1. Both from and to match ISO regex with offset/Z
 * 2. from < to
 * 3. (to - from) <= 93 days in milliseconds
 */
export function isValidArchiveRange(from: string, to: string): boolean {
  if (!ISO_DATETIME_REGEX.test(from) || !ISO_DATETIME_REGEX.test(to)) {
    return false;
  }
  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();
  if (isNaN(fromTime) || isNaN(toTime)) return false;
  if (fromTime >= toTime) return false;

  const maxDurationMs = 93 * 24 * 60 * 60 * 1000;
  if (toTime - fromTime > maxDurationMs) return false;

  return true;
}

/**
 * Normalizes raw URL search parameters into a safe FinalizedArchiveQuery.
 * Supports optional keyPrefix (e.g. "archive" -> "archiveFrom", "archiveTo", "archiveStatus").
 */
export function normalizeArchiveSearchState(
  rawParams: Record<string, string | undefined | string[]>,
  options?: { keyPrefix?: string; fixedProjectId?: string },
): FinalizedArchiveQuery {
  const prefix = options?.keyPrefix ?? "";
  const fromKey = prefix ? `${prefix}From` : "from";
  const toKey = prefix ? `${prefix}To` : "to";
  const statusKey = prefix ? `${prefix}Status` : "status";
  const projectKey = prefix ? `${prefix}ProjectId` : "projectId";

  const getParam = (key: string): string | undefined => {
    const val = rawParams[key];
    return Array.isArray(val) ? val[0] : val;
  };

  const rawFrom = getParam(fromKey);
  const rawTo = getParam(toKey);
  const rawStatus = getParam(statusKey);
  const rawProjectId = options?.fixedProjectId ?? getParam(projectKey);

  const defaultRange = getDefaultArchiveRange();
  let from = defaultRange.from;
  let to = defaultRange.to;

  if (rawFrom && rawTo && isValidArchiveRange(rawFrom, rawTo)) {
    from = rawFrom;
    to = rawTo;
  }

  let status: FinalizedArchiveStatus | undefined = undefined;
  if (rawStatus === "approved" || rawStatus === "delivered") {
    status = rawStatus;
  }

  let projectId: string | undefined = undefined;
  if (rawProjectId && UUID_REGEX.test(rawProjectId)) {
    projectId = rawProjectId;
  }

  return {
    from,
    to,
    status,
    projectId,
  };
}

/**
 * Normalizes raw URL search parameters into a safe LinkIncidentQuery.
 */
export function normalizeIncidentSearchState(
  rawParams: Record<string, string | undefined | string[]>,
): LinkIncidentQuery {
  const getParam = (key: string): string | undefined => {
    const val = rawParams[key];
    return Array.isArray(val) ? val[0] : val;
  };

  const rawFrom = getParam("from");
  const rawTo = getParam("to");
  const rawStatus = getParam("status");
  const rawProjectId = getParam("projectId");

  const defaultRange = getDefaultArchiveRange();
  let from = defaultRange.from;
  let to = defaultRange.to;

  if (rawFrom && rawTo && isValidArchiveRange(rawFrom, rawTo)) {
    from = rawFrom;
    to = rawTo;
  }

  let status: LinkIncidentStatus | undefined = undefined;
  if (
    rawStatus === "open" ||
    rawStatus === "resolved" ||
    rawStatus === "dismissed"
  ) {
    status = rawStatus;
  }

  let projectId: string | undefined = undefined;
  if (rawProjectId && UUID_REGEX.test(rawProjectId)) {
    projectId = rawProjectId;
  }

  return {
    from,
    to,
    status,
    projectId,
  };
}
