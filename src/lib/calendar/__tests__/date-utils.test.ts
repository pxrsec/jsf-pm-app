import { describe, it, expect } from "vitest";
import {
  CALENDAR_TIME_ZONE,
  getDefaultMonthRange,
  getWeekRange,
  normalizeCalendarRange,
  parseMilestoneInputToIso,
  parseIsoToLocalInput,
  formatCalendarDate,
  groupEventsByDate,
} from "../date-utils";
import { getCalendarEventKey, type CalendarEventDto } from "../types";

describe("Calendar Date Utilities", () => {
  it("uses America/Mexico_City as operational timezone", () => {
    expect(CALENDAR_TIME_ZONE).toBe("America/Mexico_City");
  });

  describe("getDefaultMonthRange", () => {
    it("returns exclusive [startOfMonth, startOfNextMonth) with timezone offset", () => {
      const ref = new Date("2026-08-15T12:00:00Z");
      const range = getDefaultMonthRange(ref);

      expect(range.from).toBe("2026-08-01T00:00:00-06:00");
      expect(range.to).toBe("2026-09-01T00:00:00-06:00");
    });
  });

  describe("getWeekRange", () => {
    it("returns 7-day half-open interval in America/Mexico_City", () => {
      const ref = new Date("2026-08-19T12:00:00-06:00"); // Wednesday, Aug 19, 2026
      const range = getWeekRange(ref);

      // Sunday Aug 16, 2026 through Sunday Aug 23, 2026
      expect(range.from).toBe("2026-08-16T00:00:00-06:00");
      expect(range.to).toBe("2026-08-23T00:00:00-06:00");
    });
  });

  describe("normalizeCalendarRange", () => {
    const ref = new Date("2026-08-15T12:00:00-06:00");

    it("returns valid provided range cleanly", () => {
      const result = normalizeCalendarRange(
        {
          from: "2026-08-01T00:00:00-06:00",
          to: "2026-08-15T00:00:00-06:00",
          view: "week",
          projectId: "00000000-0000-0000-0000-000000000001",
        },
        ref,
      );

      expect(result.view).toBe("week");
      expect(result.from).toBe("2026-08-01T00:00:00-06:00");
      expect(result.to).toBe("2026-08-15T00:00:00-06:00");
      expect(result.projectId).toBe("00000000-0000-0000-0000-000000000001");
    });

    it("falls back to default month on missing from/to for month/agenda/list views", () => {
      const result = normalizeCalendarRange({}, ref);
      expect(result.view).toBe("month");
      expect(result.from).toBe("2026-08-01T00:00:00-06:00");
      expect(result.to).toBe("2026-09-01T00:00:00-06:00");

      const resultAgenda = normalizeCalendarRange({ view: "agenda" }, ref);
      expect(resultAgenda.view).toBe("agenda");
      expect(resultAgenda.from).toBe("2026-08-01T00:00:00-06:00");
      expect(resultAgenda.to).toBe("2026-09-01T00:00:00-06:00");
    });

    it("falls back to default week range when view is week and from/to are missing", () => {
      const result = normalizeCalendarRange({ view: "week" }, ref);
      expect(result.view).toBe("week");
      expect(result.from).toBe("2026-08-09T00:00:00-06:00");
      expect(result.to).toBe("2026-08-16T00:00:00-06:00");
    });

    it("falls back to default month on inverted range (from >= to)", () => {
      const result = normalizeCalendarRange(
        {
          from: "2026-09-01T00:00:00-06:00",
          to: "2026-08-01T00:00:00-06:00",
        },
        ref,
      );
      expect(result.from).toBe("2026-08-01T00:00:00-06:00");
      expect(result.to).toBe("2026-09-01T00:00:00-06:00");
    });

    it("falls back to default month on oversized range (>93 days)", () => {
      const result = normalizeCalendarRange(
        {
          from: "2026-01-01T00:00:00-06:00",
          to: "2026-06-01T00:00:00-06:00",
        },
        ref,
      );
      expect(result.from).toBe("2026-08-01T00:00:00-06:00");
      expect(result.to).toBe("2026-09-01T00:00:00-06:00");
    });

    it("supports keyPrefix for workspace query params", () => {
      const result = normalizeCalendarRange(
        {
          calendarFrom: "2026-08-10T00:00:00-06:00",
          calendarTo: "2026-08-20T00:00:00-06:00",
          calendarView: "list",
        },
        ref,
        { keyPrefix: "calendar" },
      );

      expect(result.view).toBe("list");
      expect(result.from).toBe("2026-08-10T00:00:00-06:00");
      expect(result.to).toBe("2026-08-20T00:00:00-06:00");
      expect(result.projectId).toBeUndefined();
    });
  });

  describe("parseMilestoneInputToIso", () => {
    it("converts all-day start to 00:00:00 in America/Mexico_City", () => {
      const iso = parseMilestoneInputToIso({
        value: "2026-09-01",
        isAllDay: true,
        boundary: "start",
      });
      expect(iso).toBe("2026-09-01T00:00:00-06:00");
    });

    it("converts all-day inclusive-end to next day 00:00:00 in America/Mexico_City", () => {
      const iso = parseMilestoneInputToIso({
        value: "2026-09-01",
        isAllDay: true,
        boundary: "inclusive-end",
      });
      // End of day Aug 31 / inclusive day Sept 1 maps to Sept 2 00:00:00
      expect(iso).toBe("2026-09-02T00:00:00-06:00");
    });

    it("persists 1-day all-day milestone as [day-start, next-day-start)", () => {
      const startIso = parseMilestoneInputToIso({
        value: "2026-09-15",
        isAllDay: true,
        boundary: "start",
      });
      const endIso = parseMilestoneInputToIso({
        value: "2026-09-15",
        isAllDay: true,
        boundary: "inclusive-end",
      });

      expect(startIso).toBe("2026-09-15T00:00:00-06:00");
      expect(endIso).toBe("2026-09-16T00:00:00-06:00");
    });

    it("converts timed input to offset-bearing ISO in America/Mexico_City", () => {
      const iso = parseMilestoneInputToIso({
        value: "2026-09-01T14:30",
        isAllDay: false,
        boundary: "start",
      });
      expect(iso).toBe("2026-09-01T14:30:00-06:00");
    });
  });

  describe("parseIsoToLocalInput", () => {
    it("converts ISO to YYYY-MM-DD for all-day start", () => {
      const local = parseIsoToLocalInput(
        "2026-09-01T00:00:00-06:00",
        true,
        "start",
      );
      expect(local).toBe("2026-09-01");
    });

    it("converts next-day 00:00:00 ISO back to inclusive YYYY-MM-DD for all-day end", () => {
      const local = parseIsoToLocalInput(
        "2026-09-02T00:00:00-06:00",
        true,
        "inclusive-end",
      );
      expect(local).toBe("2026-09-01");
    });

    it("converts timed ISO to YYYY-MM-DDTHH:mm", () => {
      const local = parseIsoToLocalInput("2026-09-01T14:30:00-06:00", false);
      expect(local).toBe("2026-09-01T14:30");
    });
  });

  describe("formatCalendarDate", () => {
    it("forces America/Mexico_City formatting", () => {
      const str = formatCalendarDate("2026-08-01T00:00:00-06:00", "es-MX", {
        month: "long",
        year: "numeric",
      });
      expect(str.toLowerCase()).toContain("agosto");
      expect(str).toContain("2026");
    });
  });

  describe("groupEventsByDate", () => {
    it("groups events by YYYY-MM-DD in America/Mexico_City", () => {
      const events: CalendarEventDto[] = [
        {
          entity_id: "e1",
          project_id: "p1",
          project_name: "Project A",
          task_id: null,
          title: "Event 1",
          event_type: "project_deadline",
          starts_at: "2026-08-24T10:00:00-06:00",
          ends_at: null,
          is_all_day: false,
          color_override: null,
        },
        {
          entity_id: "e2",
          project_id: "p1",
          project_name: "Project A",
          task_id: null,
          title: "Event 2",
          event_type: "milestone",
          starts_at: "2026-08-24T23:30:00-06:00", // 05:30 UTC next day, but Aug 24 in Mexico City
          ends_at: null,
          is_all_day: false,
          color_override: "chart-1",
        },
        {
          entity_id: "e3",
          project_id: "p2",
          project_name: "Project B",
          task_id: null,
          title: "Event 3",
          event_type: "task_deadline",
          starts_at: "2026-08-25T08:00:00-06:00",
          ends_at: null,
          is_all_day: false,
          color_override: null,
        },
      ];

      const grouped = groupEventsByDate(events);
      expect(grouped.get("2026-08-24")?.length).toBe(2);
      expect(grouped.get("2026-08-25")?.length).toBe(1);
    });
  });

  describe("getCalendarEventKey", () => {
    it("generates deterministic composite key with event_type, entity_id, and starts_at", () => {
      const event: CalendarEventDto = {
        entity_id: "deliv-123",
        project_id: "proj-456",
        project_name: "Project A",
        task_id: null,
        title: "Client Delivery",
        event_type: "client_delivery_deadline",
        starts_at: "2026-08-20T18:00:00-06:00",
        ends_at: "2026-08-20T18:00:00-06:00",
        is_all_day: true,
        color_override: null,
      };

      expect(getCalendarEventKey(event)).toBe(
        "client_delivery_deadline-deliv-123-2026-08-20T18:00:00-06:00",
      );
    });

    it("generates distinct keys for events originating from the same entity", () => {
      const reviewEvent: CalendarEventDto = {
        entity_id: "deliv-123",
        project_id: "proj-456",
        project_name: "Project A",
        task_id: null,
        title: "Internal Review",
        event_type: "internal_review_deadline",
        starts_at: "2026-08-20T10:00:00-06:00",
        ends_at: null,
        is_all_day: true,
        color_override: null,
      };
      const deliveryEvent: CalendarEventDto = {
        entity_id: "deliv-123",
        project_id: "proj-456",
        project_name: "Project A",
        task_id: null,
        title: "Client Delivery",
        event_type: "client_delivery_deadline",
        starts_at: "2026-08-20T18:00:00-06:00",
        ends_at: null,
        is_all_day: true,
        color_override: null,
      };

      expect(getCalendarEventKey(reviewEvent)).not.toBe(
        getCalendarEventKey(deliveryEvent),
      );
    });
  });
});

