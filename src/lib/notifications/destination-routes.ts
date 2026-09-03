import type { NotificationDestination } from "./inbox-contracts";

/**
 * Pure, closed, locale-agnostic route helper that maps a validated
 * NotificationDestination to an internal application path.
 *
 * Emits canonical unprefixed paths. Locale prefixing is handled
 * at navigation/render time by @/i18n/routing (Link/useRouter).
 */
export function resolveNotificationDestinationHref(
  destination: NotificationDestination,
): string | null {
  switch (destination.kind) {
    case "admin_project_overview":
      return `/admin/proyectos/${destination.projectId}`;
    case "admin_project_tasks":
      return destination.taskId
        ? `/admin/tareas/${destination.taskId}`
        : `/admin/proyectos/${destination.projectId}?tab=tasks`;
    case "admin_project_deliverables":
      return `/admin/proyectos/${destination.projectId}?tab=deliverables`;
    case "pm_project_overview":
      return `/pm/proyectos/${destination.projectId}`;
    case "pm_project_tasks":
      return destination.taskId
        ? `/pm/tareas/${destination.taskId}`
        : `/pm/proyectos/${destination.projectId}?tab=tasks`;
    case "pm_project_deliverables":
      return `/pm/proyectos/${destination.projectId}?tab=deliverables`;
    case "operator_task":
      return `/operador/tareas/${destination.taskId}`;
    case "client_task":
      return `/cliente/tareas/${destination.taskId}`;
    case "client_deliverable_review":
      return `/cliente/entregables/${destination.deliverableId}`;
    case "client_project":
      return `/cliente/proyectos/${destination.projectId}`;
    case "none":
      return null;
  }
}
