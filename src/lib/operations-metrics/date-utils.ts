import { TZDate } from "@date-fns/tz";
import {
  CALENDAR_TIME_ZONE,
  formatIsoWithOffset,
} from "@/lib/calendar/date-utils";
import type { OperationsMetricsQuery } from "./types";

export { CALENDAR_TIME_ZONE, formatIsoWithOffset };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ISO_DATETIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

const CALENDAR_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const MAX_RANGE_MS = 93 * 24 * 60 * 60 * 1000;

/**
 * Derives the canonical latest 90-day operational metrics date range:
 * [now - 90 days, now) formatted with offset in America/Mexico_City.
 */
export function getDefaultMetricsRange(referenceDate?: Date): {
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
export function isValidMetricsRange(from: string, to: string): boolean {
  if (!ISO_DATETIME_REGEX.test(from) || !ISO_DATETIME_REGEX.test(to)) {
    return false;
  }
  const fromTime = Date.parse(from);
  const toTime = Date.parse(to);
  if (isNaN(fromTime) || isNaN(toTime)) return false;
  if (fromTime >= toTime) return false;
  if (toTime - fromTime > MAX_RANGE_MS) return false;

  return true;
}

/**
 * Converts two calendar date strings (YYYY-MM-DD) into explicit offset-bearing ISO timestamps:
 * - startDate -> Mexico City start-of-day inclusive (00:00:00)
 * - endDate -> Mexico City next start-of-day exclusive (00:00:00 next day)
 * Serialized exclusively via formatIsoWithOffset.
 */
export function convertLocalDateToMexicoCityRange(
  startDateStr: string,
  endDateStr: string,
): { from: string; to: string } | null {
  if (
    !CALENDAR_DATE_REGEX.test(startDateStr) ||
    !CALENDAR_DATE_REGEX.test(endDateStr)
  ) {
    return null;
  }

  const [sYear, sMonth, sDay] = startDateStr.split("-").map(Number);
  const [eYear, eMonth, eDay] = endDateStr.split("-").map(Number);

  if (!sYear || !sMonth || !sDay || !eYear || !eMonth || !eDay) {
    return null;
  }

  const startTz = new TZDate(
    sYear,
    sMonth - 1,
    sDay,
    0,
    0,
    0,
    0,
    CALENDAR_TIME_ZONE,
  );
  // Upper bound is next start-of-day for the end date (exclusive half-open interval)
  const endTz = new TZDate(
    eYear,
    eMonth - 1,
    eDay + 1,
    0,
    0,
    0,
    0,
    CALENDAR_TIME_ZONE,
  );

  const from = formatIsoWithOffset(startTz);
  const to = formatIsoWithOffset(endTz);

  if (!isValidMetricsRange(from, to)) {
    return null;
  }

  return { from, to };
}

/**
 * Normalizes raw URL search parameters into a safe OperationsMetricsQuery.
 */
export function normalizeMetricsSearchState(
  rawParams: Record<string, string | undefined | string[]>,
): OperationsMetricsQuery {
  const getParam = (key: string): string | undefined => {
    const val = rawParams[key];
    return Array.isArray(val) ? val[0] : val;
  };

  const rawFrom = getParam("from");
  const rawTo = getParam("to");
  const rawProjectId = getParam("projectId");

  const defaultRange = getDefaultMetricsRange();
  let from = defaultRange.from;
  let to = defaultRange.to;

  if (rawFrom && rawTo && isValidMetricsRange(rawFrom, rawTo)) {
    from = rawFrom;
    to = rawTo;
  }

  const projectId =
    rawProjectId && UUID_REGEX.test(rawProjectId) ? rawProjectId : undefined;

  return {
    from,
    to,
    projectId,
  };
}
