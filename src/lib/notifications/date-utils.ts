import { TZDate } from "@date-fns/tz";
import {
  CALENDAR_TIME_ZONE,
  formatIsoWithOffset,
} from "@/lib/calendar/date-utils";
import type {
  NotificationReadFilter,
  RecipientInboxQuery,
} from "./inbox-contracts";

export { CALENDAR_TIME_ZONE, formatIsoWithOffset };

const ISO_DATETIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

/**
 * Calculates the canonical latest 90-day notification history date range:
 * [now - 90 days, now) formatted with offset in America/Mexico_City.
 */
export function getDefaultNotificationRange(referenceDate?: Date): {
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
 * Validates whether a given ISO date range is valid for notification history:
 * 1. Both from and to match ISO regex with offset/Z
 * 2. from < to
 * 3. (to - from) <= 93 days in milliseconds
 */
export function isValidNotificationRange(from: string, to: string): boolean {
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
 * Checks if a given range represents the default latest 90-day notification history window.
 */
export function isDefaultNotificationRange(
  from: string,
  to: string,
  referenceDate?: Date,
): boolean {
  const refTime = (referenceDate ?? new Date()).getTime();
  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();
  if (isNaN(fromTime) || isNaN(toTime)) return false;

  const durationMs = toTime - fromTime;
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  const isNinetyDays = Math.abs(durationMs - ninetyDaysMs) < 60000;
  const isRecent = Math.abs(toTime - refTime) < 5 * 60 * 1000;

  return isNinetyDays && isRecent;
}

/**
 * Normalizes raw URL search parameters into a safe RecipientInboxQuery.
 */
export function normalizeNotificationSearchState(
  rawParams: Record<string, string | undefined | string[]>,
): RecipientInboxQuery {
  const getParam = (key: string): string | undefined => {
    const val = rawParams[key];
    return Array.isArray(val) ? val[0] : val;
  };

  const rawFrom = getParam("from");
  const rawTo = getParam("to");
  const rawRead = getParam("read");

  const defaultRange = getDefaultNotificationRange();
  let from = defaultRange.from;
  let to = defaultRange.to;

  if (rawFrom && rawTo && isValidNotificationRange(rawFrom, rawTo)) {
    from = rawFrom;
    to = rawTo;
  }

  let readFilter: NotificationReadFilter = "all";
  if (rawRead === "unread" || rawRead === "read") {
    readFilter = rawRead;
  }

  return {
    from,
    to,
    readFilter,
  };
}
