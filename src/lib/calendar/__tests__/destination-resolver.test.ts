import { describe, it, expect } from "vitest";
import {
  resolveCalendarEventDestination,
  type CalendarEventDto,
} from "@/lib/calendar/types";

describe("resolveCalendarEventDestination", () => {
  const baseEvent: CalendarEventDto = {
    entity_id: "e0000000-0000-0000-0000-000000000001",
    event_type: "task_deadline",
    title: "Test Task Deadline",
    starts_at: "2026-09-10T10:00:00Z",
    ends_at: "2026-09-10T11:00:00Z",
    is_all_day: false,
    project_id: "p0000000-0000-0000-0000-000000000001",
    task_id: "t0000000-0000-0000-0000-000000000001",
    project_name: "Test Project",
    color_override: null,
  };

  describe("Task deadlines and review/delivery deadlines", () => {
    const taskEventTypes = [
      "task_deadline",
      "internal_review_deadline",
      "client_delivery_deadline",
    ] as const;

    taskEventTypes.forEach((eventType) => {
      it(`routes ${eventType} to manager-task for admin`, () => {
        const event = { ...baseEvent, event_type: eventType };
        const dest = resolveCalendarEventDestination(event, "admin");
        expect(dest).toEqual({
          kind: "manager-task",
          href: `/admin/tareas/${event.task_id}`,
        });
      });

      it(`routes ${eventType} to manager-task for pm`, () => {
        const event = { ...baseEvent, event_type: eventType };
        const dest = resolveCalendarEventDestination(event, "pm");
        expect(dest).toEqual({
          kind: "manager-task",
          href: `/pm/tareas/${event.task_id}`,
        });
      });

      it(`routes ${eventType} to operator-task for operator`, () => {
        const event = { ...baseEvent, event_type: eventType };
        const dest = resolveCalendarEventDestination(event, "operator");
        expect(dest).toEqual({
          kind: "operator-task",
          href: `/operador/tareas/${event.task_id}`,
        });
      });

      it(`routes ${eventType} to client-task for client`, () => {
        const event = { ...baseEvent, event_type: eventType };
        const dest = resolveCalendarEventDestination(event, "client");
        expect(dest).toEqual({
          kind: "client-task",
          href: `/cliente/tareas/${event.task_id}`,
        });
      });

      it(`returns none if task_id is missing for ${eventType}`, () => {
        const event = { ...baseEvent, event_type: eventType, task_id: null };
        expect(resolveCalendarEventDestination(event, "admin")).toEqual({
          kind: "none",
        });
        expect(resolveCalendarEventDestination(event, "pm")).toEqual({
          kind: "none",
        });
        expect(resolveCalendarEventDestination(event, "operator")).toEqual({
          kind: "none",
        });
        expect(resolveCalendarEventDestination(event, "client")).toEqual({
          kind: "none",
        });
      });
    });
  });

  describe("Milestones", () => {
    const milestoneEvent: CalendarEventDto = {
      ...baseEvent,
      event_type: "milestone",
      entity_id: "m0000000-0000-0000-0000-000000000001",
    };

    it("routes to milestone-detail dialog for admin", () => {
      expect(resolveCalendarEventDestination(milestoneEvent, "admin")).toEqual({
        kind: "milestone-detail",
        milestoneId: milestoneEvent.entity_id,
      });
    });

    it("routes to milestone-detail dialog for pm", () => {
      expect(resolveCalendarEventDestination(milestoneEvent, "pm")).toEqual({
        kind: "milestone-detail",
        milestoneId: milestoneEvent.entity_id,
      });
    });

    it("returns none for operator and client", () => {
      expect(
        resolveCalendarEventDestination(milestoneEvent, "operator"),
      ).toEqual({
        kind: "none",
      });
      expect(resolveCalendarEventDestination(milestoneEvent, "client")).toEqual(
        {
          kind: "none",
        },
      );
    });
  });

  describe("Project deadlines", () => {
    const projectEvent: CalendarEventDto = {
      ...baseEvent,
      event_type: "project_deadline",
      task_id: null,
    };

    it("routes to project-overview for admin, pm, and client", () => {
      expect(resolveCalendarEventDestination(projectEvent, "admin")).toEqual({
        kind: "project-overview",
        href: `/admin/proyectos/${projectEvent.project_id}`,
      });
      expect(resolveCalendarEventDestination(projectEvent, "pm")).toEqual({
        kind: "project-overview",
        href: `/pm/proyectos/${projectEvent.project_id}`,
      });
      expect(resolveCalendarEventDestination(projectEvent, "client")).toEqual({
        kind: "project-overview",
        href: `/cliente/proyectos/${projectEvent.project_id}`,
      });
    });

    it("returns none for operator", () => {
      expect(resolveCalendarEventDestination(projectEvent, "operator")).toEqual(
        {
          kind: "none",
        },
      );
    });

    it("returns none if project_id is null", () => {
      const eventNoProj = { ...projectEvent, project_id: null };
      expect(resolveCalendarEventDestination(eventNoProj, "admin")).toEqual({
        kind: "none",
      });
    });
  });
});
