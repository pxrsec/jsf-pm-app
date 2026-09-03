import { describe, it, expect } from "vitest";
import { resolveNotificationDestinationHref } from "../destination-routes";
import type { NotificationDestination } from "../inbox-contracts";

describe("TC-NOTIF-ROUTE: Destination Routes Helper", () => {
  const projectId = "11111111-1111-1111-1111-111111111111";
  const taskId = "22222222-2222-2222-2222-222222222222";
  const deliverableId = "33333333-3333-3333-3333-333333333333";

  it("1. Maps admin_project_overview to /admin/proyectos/{projectId}", () => {
    const destination: NotificationDestination = {
      kind: "admin_project_overview",
      projectId,
    };
    expect(resolveNotificationDestinationHref(destination)).toBe(
      `/admin/proyectos/${projectId}`,
    );
  });

  it("2. Maps admin_project_tasks to /admin/proyectos/{projectId}?tab=tasks when taskId is omitted", () => {
    const destination: NotificationDestination = {
      kind: "admin_project_tasks",
      projectId,
    };
    expect(resolveNotificationDestinationHref(destination)).toBe(
      `/admin/proyectos/${projectId}?tab=tasks`,
    );
  });

  it("2b. Maps admin_project_tasks to dedicated /admin/tareas/{taskId} when taskId is present", () => {
    const destination: NotificationDestination = {
      kind: "admin_project_tasks",
      projectId,
      taskId,
    };
    expect(resolveNotificationDestinationHref(destination)).toBe(
      `/admin/tareas/${taskId}`,
    );
  });

  it("3. Maps admin_project_deliverables to /admin/proyectos/{projectId}?tab=deliverables", () => {
    const destination: NotificationDestination = {
      kind: "admin_project_deliverables",
      projectId,
    };
    expect(resolveNotificationDestinationHref(destination)).toBe(
      `/admin/proyectos/${projectId}?tab=deliverables`,
    );
  });

  it("4. Maps pm_project_overview to /pm/proyectos/{projectId}", () => {
    const destination: NotificationDestination = {
      kind: "pm_project_overview",
      projectId,
    };
    expect(resolveNotificationDestinationHref(destination)).toBe(
      `/pm/proyectos/${projectId}`,
    );
  });

  it("5. Maps pm_project_tasks to /pm/proyectos/{projectId}?tab=tasks without typos or spaces", () => {
    const destination: NotificationDestination = {
      kind: "pm_project_tasks",
      projectId,
    };
    expect(resolveNotificationDestinationHref(destination)).toBe(
      `/pm/proyectos/${projectId}?tab=tasks`,
    );
  });

  it("5b. Maps pm_project_tasks to dedicated /pm/tareas/{taskId} when taskId is present", () => {
    const destination: NotificationDestination = {
      kind: "pm_project_tasks",
      projectId,
      taskId,
    };
    expect(resolveNotificationDestinationHref(destination)).toBe(
      `/pm/tareas/${taskId}`,
    );
  });

  it("6. Maps pm_project_deliverables to /pm/proyectos/{projectId}?tab=deliverables", () => {
    const destination: NotificationDestination = {
      kind: "pm_project_deliverables",
      projectId,
    };
    expect(resolveNotificationDestinationHref(destination)).toBe(
      `/pm/proyectos/${projectId}?tab=deliverables`,
    );
  });

  it("7. Maps operator_task to /operador/tareas/{taskId}", () => {
    const destination: NotificationDestination = {
      kind: "operator_task",
      taskId,
    };
    expect(resolveNotificationDestinationHref(destination)).toBe(
      `/operador/tareas/${taskId}`,
    );
  });

  it("8. Maps client_task to /cliente/tareas/{taskId}", () => {
    const destination: NotificationDestination = {
      kind: "client_task",
      taskId,
    };
    expect(resolveNotificationDestinationHref(destination)).toBe(
      `/cliente/tareas/${taskId}`,
    );
  });

  it("9. Maps client_deliverable_review to /cliente/entregables/{deliverableId}", () => {
    const destination: NotificationDestination = {
      kind: "client_deliverable_review",
      deliverableId,
    };
    expect(resolveNotificationDestinationHref(destination)).toBe(
      `/cliente/entregables/${deliverableId}`,
    );
  });

  it("10. Maps client_project to /cliente/proyectos/{projectId}", () => {
    const destination: NotificationDestination = {
      kind: "client_project",
      projectId,
    };
    expect(resolveNotificationDestinationHref(destination)).toBe(
      `/cliente/proyectos/${projectId}`,
    );
  });

  it("11. Maps none to null", () => {
    const destination: NotificationDestination = {
      kind: "none",
    };
    expect(resolveNotificationDestinationHref(destination)).toBeNull();
  });

  it("12. Emits canonical unprefixed paths (no /en prefix)", () => {
    const destinations: NotificationDestination[] = [
      { kind: "admin_project_overview", projectId },
      { kind: "pm_project_overview", projectId },
      { kind: "operator_task", taskId },
      { kind: "client_task", taskId },
      { kind: "client_deliverable_review", deliverableId },
      { kind: "client_project", projectId },
    ];

    for (const d of destinations) {
      const href = resolveNotificationDestinationHref(d);
      expect(href).not.toBeNull();
      expect(href?.startsWith("/en")).toBe(false);
    }
  });
});
