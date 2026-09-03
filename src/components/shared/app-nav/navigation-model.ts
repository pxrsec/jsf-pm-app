import type { AppRole } from "@/lib/auth/session";

export type AppNavigationItemKey =
  | "home"
  | "projects"
  | "agenda"
  | "operatorProjects"
  | "calendar"
  | "archive"
  | "recycleBin"
  | "clients"
  | "linkIncidents"
  | "metrics"
  | "operations"
  | "notifications"
  | "notificationOperations"
  | "accessManagement"
  | "account";

export type AppNavigationItem = {
  key: AppNavigationItemKey;
  href: string;
  label: string;
  ariaLabel: string;
  unreadCount?: number;
};

export interface BuildNavigationModelParams {
  role: AppRole;
  unreadCount: number;
  canAccessNotificationOperations: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
}

export function buildNavigationModel({
  role,
  unreadCount,
  canAccessNotificationOperations,
  t,
}: BuildNavigationModelParams): AppNavigationItem[] {
  const items: AppNavigationItem[] = [];

  // 1. Home
  const roleHomePath =
    role === "admin"
      ? "/admin"
      : role === "pm"
        ? "/pm"
        : role === "operator"
          ? "/operador"
          : "/cliente";
  const homeLabel = t("links.home");
  items.push({
    key: "home",
    href: roleHomePath,
    label: homeLabel,
    ariaLabel: homeLabel,
  });

  // 2. Projects / My Agenda
  if (role === "operator") {
    const agendaLabel = t("links.agenda");
    items.push({
      key: "agenda",
      href: "/operador/agenda",
      label: agendaLabel,
      ariaLabel: agendaLabel,
    });
    const operatorProjectsLabel = t("links.myProjects");
    items.push({
      key: "operatorProjects",
      href: "/operador/proyectos",
      label: operatorProjectsLabel,
      ariaLabel: operatorProjectsLabel,
    });
  } else {
    const projectsLabel = t("links.projects");
    const projectsHref =
      role === "admin"
        ? "/admin/proyectos"
        : role === "pm"
          ? "/pm/proyectos"
          : "/cliente/proyectos";
    items.push({
      key: "projects",
      href: projectsHref,
      label: projectsLabel,
      ariaLabel: projectsLabel,
    });
  }

  // 3. Calendar
  const calendarLabel = t("links.calendar");
  items.push({
    key: "calendar",
    href: "/calendario",
    label: calendarLabel,
    ariaLabel: calendarLabel,
  });

  // 4. Notifications (All roles)
  const notificationsLabel = t("links.notifications");
  const inboxAriaLabel =
    unreadCount > 0
      ? t("notifications.inboxLinkAriaWithCount", { count: unreadCount })
      : t("notifications.inboxLinkAria");
  items.push({
    key: "notifications",
    href: "/notificaciones",
    label: notificationsLabel,
    ariaLabel: inboxAriaLabel,
    unreadCount,
  });

  // 5. Clients (Admin and PM only)
  if (role === "admin" || role === "pm") {
    const clientsLabel = t("links.clients");
    const clientsHref = role === "admin" ? "/admin/clientes" : "/pm/clientes";
    items.push({
      key: "clients",
      href: clientsHref,
      label: clientsLabel,
      ariaLabel: clientsLabel,
    });
  }

  // 6. Metrics (Admin and PM only)
  if (role === "admin" || role === "pm") {
    const metricsLabel = t("links.metrics");
    const metricsHref = role === "admin" ? "/admin/metricas" : "/pm/metricas";
    items.push({
      key: "metrics",
      href: metricsHref,
      label: metricsLabel,
      ariaLabel: metricsLabel,
    });
  }

  // 7. Archive (All roles)
  const archiveLabel = t("links.archive");
  const archiveHref =
    role === "admin"
      ? "/admin/archivo"
      : role === "pm"
        ? "/pm/archivo"
        : role === "operator"
          ? "/operador/archivo"
          : "/cliente/archivo";
  items.push({
    key: "archive",
    href: archiveHref,
    label: archiveLabel,
    ariaLabel: archiveLabel,
  });

  // 8. Recycle Bin (Admin and PM only)
  if (role === "admin" || role === "pm") {
    const recycleBinLabel = t("links.recycleBin");
    const recycleBinHref =
      role === "admin" ? "/admin/papelera" : "/pm/papelera";
    items.push({
      key: "recycleBin",
      href: recycleBinHref,
      label: recycleBinLabel,
      ariaLabel: recycleBinLabel,
    });
  }

  // 9. Access Management (Admin and PM only)
  if (role === "admin" || role === "pm") {
    const accessManagementLabel = t("links.accessManagement");
    const accessManagementHref =
      role === "admin" ? "/admin/acceso" : "/pm/acceso";
    items.push({
      key: "accessManagement",
      href: accessManagementHref,
      label: accessManagementLabel,
      ariaLabel: accessManagementLabel,
    });
  }

  // 10. Link Incidents (Admin and PM only)
  if (role === "admin" || role === "pm") {
    const linkIncidentsLabel = t("links.linkIncidents");
    const linkIncidentsHref =
      role === "admin" ? "/admin/incidentes-enlaces" : "/pm/incidentes-enlaces";
    items.push({
      key: "linkIncidents",
      href: linkIncidentsHref,
      label: linkIncidentsLabel,
      ariaLabel: linkIncidentsLabel,
    });
  }

  // 11. Operations (Admin only)
  if (role === "admin") {
    const operationsLabel = t("links.operations");
    items.push({
      key: "operations",
      href: "/admin/operaciones",
      label: operationsLabel,
      ariaLabel: operationsLabel,
    });
  }

  // 12. Notification Operations (Admin or PM with canAccessNotificationOperations)
  if (canAccessNotificationOperations && (role === "admin" || role === "pm")) {
    const notifOpsLabel = t("links.notificationOperations");
    const notifOpsHref =
      role === "admin" ? "/admin/notificaciones" : "/pm/notificaciones";
    items.push({
      key: "notificationOperations",
      href: notifOpsHref,
      label: notifOpsLabel,
      ariaLabel: notifOpsLabel,
    });
  }

  // 13. Account (All roles)
  const accountLabel = t("links.account");
  items.push({
    key: "account",
    href: "/cuenta",
    label: accountLabel,
    ariaLabel: accountLabel,
  });

  return items;
}

export function buildMobileQuickAccessItems({
  items,
  role,
}: {
  items: AppNavigationItem[];
  role: AppRole;
}): AppNavigationItem[] {
  const keysByRole: Record<AppRole, readonly AppNavigationItemKey[]> = {
    admin: ["home", "projects", "operations"],
    pm: ["home", "projects", "calendar"],
    operator: ["home", "agenda", "calendar"],
    client: ["home", "projects", "calendar"],
  };
  return keysByRole[role].map((key) => {
    const item = items.find((candidate) => candidate.key === key);
    if (!item) {
      throw new Error(
        `Mobile quick-access invariant failed: missing authorized "${key}" item for role "${role}".`,
      );
    }
    return item;
  });
}
