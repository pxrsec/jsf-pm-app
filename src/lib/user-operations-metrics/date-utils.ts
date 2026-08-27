import {
  CALENDAR_TIME_ZONE,
  convertLocalDateToMexicoCityRange,
  formatIsoWithOffset,
  getDefaultMetricsRange,
  isValidMetricsRange,
} from "@/lib/operations-metrics/date-utils";
import type { AppRole } from "@/lib/auth/routes";
import type { UserOperationsMetricsQuery } from "./types";

export {
  CALENDAR_TIME_ZONE,
  convertLocalDateToMexicoCityRange,
  formatIsoWithOffset,
  getDefaultMetricsRange,
  isValidMetricsRange,
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Normalizes raw URL search parameters into a safe UserOperationsMetricsQuery.
 */
export function normalizeUserMetricsSearchState(
  rawParams: Record<string, string | undefined | string[]>,
  role: AppRole,
  options?: {
    fixedProjectId?: string;
    validUserIds?: readonly string[];
  },
): UserOperationsMetricsQuery {
  const getParam = (key: string): string | undefined => {
    const val = rawParams[key];
    return Array.isArray(val) ? val[0] : val;
  };

  const rawFrom = getParam("from");
  const rawTo = getParam("to");
  const rawProjectId = options?.fixedProjectId ?? getParam("projectId");
  const rawUserId = getParam("userId");

  const defaultRange = getDefaultMetricsRange();
  let from = defaultRange.from;
  let to = defaultRange.to;

  if (rawFrom && rawTo && isValidMetricsRange(rawFrom, rawTo)) {
    from = rawFrom;
    to = rawTo;
  }

  let projectId: string | undefined = undefined;
  if (role === "pm") {
    if (rawProjectId && UUID_REGEX.test(rawProjectId)) {
      projectId = rawProjectId;
    }
  } else if (role === "admin") {
    if (rawProjectId && UUID_REGEX.test(rawProjectId)) {
      projectId = rawProjectId;
    }
  }

  let userId: string | undefined = undefined;
  if (rawUserId && UUID_REGEX.test(rawUserId)) {
    if (!options?.validUserIds || options.validUserIds.includes(rawUserId)) {
      userId = rawUserId;
    }
  }

  return {
    from,
    to,
    projectId,
    userId,
  };
}
