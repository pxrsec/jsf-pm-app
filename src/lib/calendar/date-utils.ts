import { TZDate } from "@date-fns/tz";
import type {
  CalendarEventDto,
  CalendarRangeState,
  CalendarView,
} from "./types";

export const CALENDAR_TIME_ZONE = "America/Mexico_City";

const ISO_DATETIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function padZero(num: number): string {
  return String(num).padStart(2, "0");
}

/**
 * Formats a Date or TZDate as an offset-bearing ISO 8601 string in America/Mexico_City.
 */
export function formatIsoWithOffset(date: Date | TZDate): string {
  const tz =
    date instanceof TZDate ? date : new TZDate(date, CALENDAR_TIME_ZONE);
  const year = tz.getFullYear();
  const month = padZero(tz.getMonth() + 1);
  const day = padZero(tz.getDate());
  const hours = padZero(tz.getHours());
  const minutes = padZero(tz.getMinutes());
  const seconds = padZero(tz.getSeconds());

  const offsetMinutes = -tz.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const offH = padZero(Math.floor(absOffset / 60));
  const offM = padZero(absOffset % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offH}:${offM}`;
}

/**
 * Calculates the canonical month range [startOfMonth, startOfNextMonth) in America/Mexico_City.
 */
export function getDefaultMonthRange(referenceDate?: Date): {
  from: string;
  to: string;
} {
  const ref = referenceDate ?? new Date();
  const tz = new TZDate(ref, CALENDAR_TIME_ZONE);
  const year = tz.getFullYear();
  const month = tz.getMonth();

  const startOfMonth = new TZDate(
    year,
    month,
    1,
    0,
    0,
    0,
    0,
    CALENDAR_TIME_ZONE,
  );
  const startOfNextMonth = new TZDate(
    year,
    month + 1,
    1,
    0,
    0,
    0,
    0,
    CALENDAR_TIME_ZONE,
  );

  return {
    from: formatIsoWithOffset(startOfMonth),
    to: formatIsoWithOffset(startOfNextMonth),
  };
}

/**
 * Calculates the 7-day week range [startOfWeek, startOfNextWeek) in America/Mexico_City.
 * Week starts on Sunday (day 0) or standard calendar boundary.
 */
export function getWeekRange(referenceDate?: Date): {
  from: string;
  to: string;
} {
  const ref = referenceDate ?? new Date();
  const tz = new TZDate(ref, CALENDAR_TIME_ZONE);
  const year = tz.getFullYear();
  const month = tz.getMonth();
  const date = tz.getDate();
  const dayOfWeek = tz.getDay();

  const startOfWeek = new TZDate(
    year,
    month,
    date - dayOfWeek,
    0,
    0,
    0,
    0,
    CALENDAR_TIME_ZONE,
  );
  const startOfNextWeek = new TZDate(
    year,
    month,
    date - dayOfWeek + 7,
    0,
    0,
    0,
    0,
    CALENDAR_TIME_ZONE,
  );

  return {
    from: formatIsoWithOffset(startOfWeek),
    to: formatIsoWithOffset(startOfNextWeek),
  };
}

/**
 * Normalizes URL search parameters into a safe, valid CalendarRangeState.
 * Invalid, offsetless, inverted, oversized (>93 days) or malformed values fall back to canonical default month.
 */
export function normalizeCalendarRange(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  referenceDate?: Date,
  options?: { keyPrefix?: string },
): CalendarRangeState {
  const prefix = options?.keyPrefix ?? "";
  const fromKey = prefix ? `${prefix}From` : "from";
  const toKey = prefix ? `${prefix}To` : "to";
  const viewKey = prefix ? `${prefix}View` : "view";

  const rawFrom =
    typeof searchParams?.[fromKey] === "string"
      ? searchParams[fromKey]
      : undefined;
  const rawTo =
    typeof searchParams?.[toKey] === "string" ? searchParams[toKey] : undefined;
  const rawView =
    typeof searchParams?.[viewKey] === "string"
      ? searchParams[viewKey]
      : undefined;
  const rawProjectId =
    typeof searchParams?.["projectId"] === "string"
      ? searchParams["projectId"]
      : undefined;

  let view: CalendarView = "month";
  if (
    rawView === "month" ||
    rawView === "week" ||
    rawView === "agenda" ||
    rawView === "list"
  ) {
    view = rawView;
  }

  let projectId: string | undefined = undefined;
  if (!prefix && rawProjectId && UUID_REGEX.test(rawProjectId)) {
    projectId = rawProjectId;
  }

  const defaultRange =
    view === "week"
      ? getWeekRange(referenceDate)
      : getDefaultMonthRange(referenceDate);

  if (
    !rawFrom ||
    !rawTo ||
    !ISO_DATETIME_REGEX.test(rawFrom) ||
    !ISO_DATETIME_REGEX.test(rawTo)
  ) {
    return {
      view,
      from: defaultRange.from,
      to: defaultRange.to,
      projectId,
    };
  }

  const fromTime = Date.parse(rawFrom);
  const toTime = Date.parse(rawTo);

  if (isNaN(fromTime) || isNaN(toTime)) {
    return {
      view,
      from: defaultRange.from,
      to: defaultRange.to,
      projectId,
    };
  }

  if (fromTime >= toTime) {
    return {
      view,
      from: defaultRange.from,
      to: defaultRange.to,
      projectId,
    };
  }

  const maxRangeMs = 93 * 24 * 60 * 60 * 1000;
  if (toTime - fromTime > maxRangeMs) {
    return {
      view,
      from: defaultRange.from,
      to: defaultRange.to,
      projectId,
    };
  }

  return {
    view,
    from: rawFrom,
    to: rawTo,
    projectId,
  };
}

/**
 * Converts form input into an offset-bearing ISO string in America/Mexico_City.
 * - All-day start: YYYY-MM-DD -> start of that day at 00:00:00.
 * - All-day inclusive-end: YYYY-MM-DD -> start of next calendar day at 00:00:00.
 * - Timed event: YYYY-MM-DDTHH:mm -> exact instant in America/Mexico_City.
 */
export function parseMilestoneInputToIso(params: {
  value: string | null | undefined;
  isAllDay: boolean;
  boundary: "start" | "inclusive-end";
}): string | null {
  const { value, isAllDay, boundary } = params;
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const trimmed = value.trim();

  if (isAllDay) {
    const parts = trimmed.split("-");
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

    if (boundary === "start") {
      const tzDate = new TZDate(
        year,
        month - 1,
        day,
        0,
        0,
        0,
        0,
        CALENDAR_TIME_ZONE,
      );
      return formatIsoWithOffset(tzDate);
    } else {
      // Inclusive end: converts to next calendar day's 00:00:00
      const tzDate = new TZDate(
        year,
        month - 1,
        day + 1,
        0,
        0,
        0,
        0,
        CALENDAR_TIME_ZONE,
      );
      return formatIsoWithOffset(tzDate);
    }
  }

  // Timed event: YYYY-MM-DDTHH:mm
  const [datePart, timePart] = trimmed.split("T");
  if (!datePart || !timePart) return null;

  const dateSegments = datePart.split("-");
  const timeSegments = timePart.split(":");
  if (dateSegments.length !== 3 || timeSegments.length < 2) return null;

  const year = parseInt(dateSegments[0], 10);
  const month = parseInt(dateSegments[1], 10);
  const day = parseInt(dateSegments[2], 10);
  const hours = parseInt(timeSegments[0], 10);
  const minutes = parseInt(timeSegments[1], 10);

  if (
    isNaN(year) ||
    isNaN(month) ||
    isNaN(day) ||
    isNaN(hours) ||
    isNaN(minutes)
  ) {
    return null;
  }

  const tzDate = new TZDate(
    year,
    month - 1,
    day,
    hours,
    minutes,
    0,
    0,
    CALENDAR_TIME_ZONE,
  );
  return formatIsoWithOffset(tzDate);
}

/**
 * Converts a stored ISO string to an input string for HTML form elements.
 * Returns YYYY-MM-DD for date inputs and YYYY-MM-DDTHH:mm for datetime-local inputs.
 */
export function parseIsoToLocalInput(
  isoStr: string | null | undefined,
  isAllDay: boolean,
  boundary?: "start" | "inclusive-end",
): string {
  if (!isoStr || typeof isoStr !== "string" || isNaN(Date.parse(isoStr))) {
    return "";
  }

  let tz = new TZDate(new Date(isoStr), CALENDAR_TIME_ZONE);

  if (isAllDay && boundary === "inclusive-end") {
    // If persisted as next-day 00:00:00, subtract 1 second to get the user's inclusive date
    tz = new TZDate(tz.getTime() - 1000, CALENDAR_TIME_ZONE);
  }

  const year = tz.getFullYear();
  const month = padZero(tz.getMonth() + 1);
  const day = padZero(tz.getDate());

  if (isAllDay) {
    return `${year}-${month}-${day}`;
  }

  const hours = padZero(tz.getHours());
  const minutes = padZero(tz.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Formats a calendar date using Intl.DateTimeFormat forced to America/Mexico_City.
 */
export function formatCalendarDate(
  value: string | Date,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: CALENDAR_TIME_ZONE,
  }).format(date);
}

/**
 * Groups events by date key (YYYY-MM-DD in America/Mexico_City) preserving database sort order.
 */
export function groupEventsByDate(
  events: CalendarEventDto[],
): Map<string, CalendarEventDto[]> {
  const groups = new Map<string, CalendarEventDto[]>();

  for (const event of events) {
    const tz = new TZDate(new Date(event.starts_at), CALENDAR_TIME_ZONE);
    const dateKey = `${tz.getFullYear()}-${padZero(tz.getMonth() + 1)}-${padZero(tz.getDate())}`;

    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(dateKey, [event]);
    }
  }

  return groups;
}
