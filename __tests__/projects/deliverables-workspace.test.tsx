// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("server-only", () => ({}));

vi.mock("@/config/app.config", () => ({
  publicConfig: {
    appUrl: "http://localhost:3000",
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "sb_publishable_test_key",
  },
  serverConfig: {
    supabaseServiceRoleKey: "sb_secret_test_key",
  },
}));

vi.mock("@/lib/deliverables/actions", () => ({
  getDeliverableDetailAction: vi.fn().mockResolvedValue(null),
  createDeliverableAction: vi.fn().mockResolvedValue({ ok: true }),
  updateDeliverableAction: vi.fn().mockResolvedValue({ ok: true }),
  archiveDeliverableAction: vi.fn().mockResolvedValue({ ok: true }),
  submitDeliverableVersionAction: vi
    .fn()
    .mockResolvedValue({ ok: true, data: { version_number: 1 } }),
  reportDeliverableLinkAction: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/deliverables/review-actions", () => ({
  reviewDeliverableAction: vi.fn().mockResolvedValue({ ok: true }),
  markDeliverableDeliveredAction: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/deliverables/comment-actions", () => ({
  createDeliverableCommentAction: vi.fn().mockResolvedValue({ ok: true }),
  listDeliverableCommentsAction: vi.fn().mockResolvedValue([]),
}));

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    return (key: string, params?: Record<string, unknown>) => {
      if (namespace === "projects.workspace.deliverables.linkReportDialog") {
        const dialogMessages: Record<string, string> = {
          title: "Reportar Problema con Enlace",
          description: `Envía un reporte interno sobre el enlace de la versión v${params?.version ?? ""}.`,
          truthfulnessNotice:
            "Este reporte registra una alerta interna para el equipo. El sistema no valida ni descarga el enlace de forma remota y el estado del entregable no se modificará.",
          reasonLabel: "Motivo del reporte",
          reasonPlaceholder:
            "Ej. El enlace solicita permisos de acceso restringido...",
          cancelAction: "Cancelar",
          submitAction: "Enviar Reporte",
          submitting: "Enviando reporte...",
        };
        return dialogMessages[key] ?? key;
      }
      const messages: Record<string, string> = {
        internalIneligibleTitle: "Entregables no disponibles",
        internalIneligibleDescription:
          "Los proyectos internos no admiten entregables de producción.",
        incompleteClientSetupTitle: "Configuración de cliente pendiente",
        incompleteClientSetupDescription:
          "Se requiere vincular una organización de cliente y al menos un contacto activo antes de crear o enviar entregables de producción.",
        emptyStateTitle: "No hay entregables planificados",
        emptyStateDescription:
          "Planifica el primer entregable de producción vinculado a una tarea del proyecto.",
        emptyStateAction: "Planificar primer entregable",
        newDeliverableAction: "Nuevo Entregable",
        stalledBadge: "Estancado",
        versionZero: "v0 (Sin envíos)",
        unassigned: "Sin asignar",
        userFallback: "Usuario",
        pmLeadFallback: "PM Lead",
        teamMemberFallback: "Miembro del Equipo",
        actionsMenuAriaLabel: "Menú de acciones",
        "detailSheet.title": "Detalle del Entregable",
        "detailSheet.historyTitle": "Historial Inmutable de Versiones",
        "detailSheet.noHistory":
          "Aún no se ha enviado ninguna versión de este entregable.",
        "detailSheet.reviewHistoryRecord": "Registro formal de revisión",
        "detailSheet.openExternalLink": "Abrir en Google Drive",
        "detailSheet.reportLinkAction": "Reportar problema con enlace",
        "detailSheet.nextActionTitle": "Siguiente Acción",
        "detailSheet.submitCta": `Enviar Versión v${params?.version ?? ""}`,
        "detailSheet.submitCtaInitial": "Enviar Primera Versión (v1)",
        "detailSheet.reviewCta": `Revisar versión v${params?.version ?? ""}`,
        "detailSheet.deliverCta": "Marcar como entregado",
        "detailSheet.awaitingClientReviewTitle":
          "En Espera de Revisión del Cliente",
        "detailSheet.awaitingClientReviewNotice":
          "Entregable liberado para revisión de cliente.",
        "detailSheet.deliveredNotice":
          "Este entregable ha sido completado y entregado.",
        "detailSheet.internalStage": "Revisión Interna",
        "detailSheet.productionAssigneeRole": "Responsable de producción",
        "detailSheet.submissionDeadlineShort": "Envío",
        "detailSheet.internalReviewDeadlineShort": "Revisión PM",
        "detailSheet.clientDeliveryDeadlineShort": "Entrega Cliente",
        "linkReportDialog.title": "Reportar Problema con Enlace",
        "linkReportDialog.description": `Envía un reporte interno sobre el enlace de la versión v${params?.version ?? ""}.`,
        "linkReportDialog.reasonLabel": "Motivo del reporte",
        "linkReportDialog.cancelAction": "Cancelar",
        "linkReportDialog.submitAction": "Enviar Reporte",
        "linkReportDialog.submitting": "Enviando reporte...",
        "reviewDialog.title": "Revisión Interna del Entregable",
        "reviewDialog.description": `Emite un dictamen formal de revisión interna para la versión v${params?.version ?? ""}.`,
        "reviewDialog.decisionLabel": "Dictamen de revisión",
        "reviewDialog.approveOption": "Aprobar para revisión de cliente",
        "reviewDialog.approveHelp":
          "El entregable avanzará a en espera de revisión del cliente.",
        "reviewDialog.requestChangesOption": "Solicitar cambios",
        "reviewDialog.requestChangesHelp":
          "El entregable volverá a pendiente para corregir.",
        "reviewDialog.commentsLabel": "Comentarios de revisión",
        "reviewDialog.commentsOptionalPlaceholder": "Comentarios opcionales...",
        "reviewDialog.commentsRequiredPlaceholder":
          "Detalla los cambios solicitados...",
        "reviewDialog.commentsRequiredError":
          "El comentario es obligatorio al solicitar cambios.",
        "reviewDialog.immutableWarning":
          "Este dictamen quedará asentado de forma inmutable.",
        "reviewDialog.submitAction": "Asentar Dictamen",
        "reviewDialog.cancelAction": "Cancelar",
        "reviewDialog.submitting": "Asentando...",
        "deliveryDialog.title": "¿Confirmar Entrega Final?",
        "deliveryDialog.description":
          "¿Confirmar que el entregable ha sido completado y entregado?",
        "deliveryDialog.truthfulnessNotice":
          "La aplicación registra el estado final en el flujo de trabajo interno. No realiza transferencias de archivos, envíos de correo, mensajes externos ni verificación de recepción externa.",
        "deliveryDialog.confirmAction": "Marcar como Entregado",
        "deliveryDialog.cancelAction": "Cancelar",
        "deliveryDialog.delivering": "Registrando entrega...",
        "actions.openDetails": "Ver detalles",
        "actions.submitVersion": "Enviar enlace Drive",
        "actions.reviewVersion": "Revisar versión",
        "actions.markDelivered": "Marcar como entregado",
        "actions.edit": "Editar",
        "actions.archive": "Archivar",
        "columns.title": "Título",
        "columns.status": "Estado",
        "columns.version": "Versión",
        "columns.assignee": "Asignado a",
        "columns.deadlines": "Fechas Límite",
        "columns.actions": "Acciones",
        filterStatus: "Filtrar por estado...",
        filterAssignee: "Filtrar por asignado...",
        allStatuses: "Todos los estados",
        allAssignees: "Todos los miembros",
        clearFilters: "Limpiar filtros",
        viewTable: "Tabla",
        viewCards: "Tarjetas",
        "status.pending": "Pendiente",
        "status.awaitingInternalReview": "Esperando Revisión Interna",
        "status.awaitingClientReview": "Esperando Revisión de Cliente",
        "status.approved": "Aprobado",
        "status.changesRequested": "Cambios Solicitados",
        "status.delivered": "Entregado",
        pending: "Pendiente",
        awaitingInternalReview: "Esperando Revisión Interna",
        awaitingClientReview: "Esperando Revisión de Cliente",
        approved: "Aprobado",
        changesRequested: "Cambios Solicitados",
        delivered: "Entregado",
        "deadlines.noDeadlines": "Sin fechas límite",
        "watcherMode.cannotMutate":
          "Los observadores de PM pueden consultar el historial y comentar, pero no pueden planificar, editar, archivar ni enviar versiones.",
        "comments.title": "Discusión Interna",
        "comments.advisoryNotice":
          "Los comentarios son discusión colaborativa interna y no constituyen decisiones formales de revisión.",
        "comments.emptyState": "No hay comentarios en este entregable.",
        "comments.composePlaceholder": "Escribe un comentario interno...",
        "comments.submitAction": "Comentar",
      };

      if (namespace === "projects.workspace.deliverables.status") {
        const statusMap: Record<string, string> = {
          pending: "Pendiente",
          awaitingInternalReview: "Esperando Revisión Interna",
          awaitingClientReview: "Esperando Revisión de Cliente",
          approved: "Aprobado",
          changesRequested: "Cambios Solicitados",
          delivered: "Entregado",
        };
        return statusMap[key] ?? key;
      }

      return messages[key] ?? key;
    };
  },
  useFormatter: () => ({
    dateTime: (d: Date) => d.toISOString().slice(0, 10),
  }),
  useLocale: () => "es",
}));

import { DeliverablesTab } from "@/components/shared/projects/project-deliverables/deliverables-tab";
import { DeliverableHistory } from "@/components/shared/projects/project-deliverables/deliverable-history";
import { FormalFeedbackHistory } from "@/components/shared/projects/project-deliverables/formal-feedback-history";
import { DeliverableLinkReportDialog } from "@/components/shared/projects/project-deliverables/deliverable-link-report-dialog";
import { DeliverableReviewDialog } from "@/components/shared/projects/project-deliverables/deliverable-review-dialog";
import { DeliverableDeliveryDialog } from "@/components/shared/projects/project-deliverables/deliverable-delivery-dialog";
import { DeliverableDetailSheet } from "@/components/shared/projects/project-deliverables/deliverable-detail-sheet";
import { DeliverableList } from "@/components/shared/projects/project-deliverables/deliverable-list";
import { DeliverableCard } from "@/components/shared/projects/project-deliverables/deliverable-card";
import type { ProjectDetail, TaskWithAssignee } from "@/lib/projects/queries";
import type {
  DeliverableListItem,
  DeliverableDetailView,
  DeliverableVersionView,
  DeliverableFeedbackView,
} from "@/lib/deliverables/queries";

describe("Deliverables Workspace UI", () => {
  afterEach(() => {
    cleanup();
  });
  const mockInternalProject: ProjectDetail = {
    id: "proj-internal-1",
    name: "Internal Project",
    project_type: "internal",
    status: "in_progress",
    client_id: null,
    internal_description: "",
    deadline_at: "",
    client_scope: null,
    drive_folder_url: null,
    archived_at: null,
    created_by: "user-pm-1",
    updated_by: null,
    created_at: "2026-08-20T10:00:00.000Z",
    updated_at: "2026-08-20T10:00:00.000Z",
    deleted_at: null,
    completed_at: null,
    members: [],
  };

  const mockIncompleteClientProject: ProjectDetail = {
    id: "proj-incomplete-1",
    name: "Client Project without Client Member",
    project_type: "client",
    status: "planning",
    client_id: "client-org-1",
    internal_description: "",
    deadline_at: "",
    client_scope: null,
    drive_folder_url: null,
    archived_at: null,
    created_by: "user-pm-1",
    updated_by: null,
    created_at: "2026-08-20T10:00:00.000Z",
    updated_at: "2026-08-20T10:00:00.000Z",
    deleted_at: null,
    completed_at: null,
    members: [
      {
        id: "m-1",
        project_id: "proj-incomplete-1",
        user_id: "user-pm-1",
        member_type: "pm_lead",
        is_primary: true,
        receives_notifications: true,
        created_by: "user-pm-1",
        joined_at: "2026-08-20T10:00:00.000Z",
        created_at: "2026-08-20T10:00:00.000Z",
        updated_at: "2026-08-20T10:00:00.000Z",
        deleted_at: null,
        profile: {
          id: "user-pm-1",
          full_name: "PM Lead",
          role: "pm",
          avatar_url: null,
          is_active: true,
        },
      },
    ],
  };

  const mockReadyClientProject: ProjectDetail = {
    id: "proj-ready-1",
    name: "Ready Client Project",
    project_type: "client",
    status: "in_progress",
    client_id: "client-org-1",
    internal_description: "",
    deadline_at: "",
    client_scope: null,
    drive_folder_url: null,
    archived_at: null,
    created_by: "user-pm-1",
    updated_by: null,
    created_at: "2026-08-20T10:00:00.000Z",
    updated_at: "2026-08-20T10:00:00.000Z",
    deleted_at: null,
    completed_at: null,
    members: [
      {
        id: "m-1",
        project_id: "proj-ready-1",
        user_id: "user-pm-1",
        member_type: "pm_lead",
        is_primary: true,
        receives_notifications: true,
        created_by: "user-pm-1",
        joined_at: "2026-08-20T10:00:00.000Z",
        created_at: "2026-08-20T10:00:00.000Z",
        updated_at: "2026-08-20T10:00:00.000Z",
        deleted_at: null,
        profile: {
          id: "user-pm-1",
          full_name: "PM Lead",
          role: "pm",
          avatar_url: null,
          is_active: true,
        },
      },
      {
        id: "m-2",
        project_id: "proj-ready-1",
        user_id: "user-client-1",
        member_type: "client",
        is_primary: false,
        receives_notifications: true,
        created_by: "user-pm-1",
        joined_at: "2026-08-20T10:00:00.000Z",
        created_at: "2026-08-20T10:00:00.000Z",
        updated_at: "2026-08-20T10:00:00.000Z",
        deleted_at: null,
        profile: {
          id: "user-client-1",
          full_name: "Client Contact",
          role: "client",
          avatar_url: null,
          is_active: true,
        },
      },
    ],
  };

  const mockTasks: TaskWithAssignee[] = [
    {
      id: "task-1",
      project_id: "proj-ready-1",
      title: "Video Editing",
      description: "Edit video footage",
      status: "in_progress",
      priority: "high",
      task_type: "internal_work",
      has_deliverables: true,
      assignee_id: "user-pm-1",
      assigned_at: "2026-08-20T10:00:00.000Z",
      deadline_at: "",
      started_at: null,
      completed_at: null,
      created_by: "user-pm-1",
      updated_by: null,
      created_at: "2026-08-20T10:00:00.000Z",
      updated_at: "2026-08-20T10:00:00.000Z",
      deleted_at: null,
      assignee: null,
    },
  ];

  const mockDeliverables: DeliverableListItem[] = [
    {
      id: "deliv-1",
      project_id: "proj-ready-1",
      task_id: "task-1",
      assignee_id: "user-pm-1",
      title: "Promo Video 4K Cut",
      specifications: "ProRes 422 4K 60fps",
      workflow_type: "production",
      status: "pending",
      current_version_number: 0,
      is_stalled: false,
      submission_deadline_at: null,
      internal_review_deadline_at: null,
      client_delivery_deadline_at: null,
      approved_at: null,
      delivered_at: null,
      created_at: "2026-08-20T10:00:00.000Z",
      updated_at: "2026-08-20T10:00:00.000Z",
      assignee: {
        id: "user-pm-1",
        full_name: "PM Lead",
        role: "pm",
        avatar_url: null,
      },
    },
  ];

  it("renders internal project guard notice when project_type is internal", () => {
    const html = renderToStaticMarkup(
      <DeliverablesTab
        project={mockInternalProject}
        initialDeliverables={[]}
        tasks={[]}
        effectiveCapacity="pm_lead"
      />,
    );

    expect(html).toContain("Entregables no disponibles");
    expect(html).toContain(
      "Los proyectos internos no admiten entregables de producción.",
    );
  });

  it("renders client setup warning banner when client membership is incomplete", () => {
    const html = renderToStaticMarkup(
      <DeliverablesTab
        project={mockIncompleteClientProject}
        initialDeliverables={[]}
        tasks={[]}
        effectiveCapacity="pm_lead"
      />,
    );

    expect(html).toContain("Configuración de cliente pendiente");
    expect(html).toContain("Se requiere vincular una organización de cliente");
  });

  it("renders empty state prompt when no deliverables exist in ready client project", () => {
    const html = renderToStaticMarkup(
      <DeliverablesTab
        project={mockReadyClientProject}
        initialDeliverables={[]}
        tasks={mockTasks}
        effectiveCapacity="pm_lead"
      />,
    );

    expect(html).toContain("No hay entregables planificados");
    expect(html).toContain("Planificar primer entregable");
  });

  it("renders deliverables list with title, version, and status badge", () => {
    const html = renderToStaticMarkup(
      <DeliverablesTab
        project={mockReadyClientProject}
        initialDeliverables={mockDeliverables}
        tasks={mockTasks}
        effectiveCapacity="pm_lead"
      />,
    );

    expect(html).toContain("Promo Video 4K Cut");
    expect(html).toContain("v0");
    expect(html).toContain("Pendiente");
  });

  it("renders immutable version history with Google Drive external link notice", () => {
    const mockVersions: DeliverableVersionView[] = [
      {
        id: "v-1",
        deliverable_id: "deliv-1",
        version_number: 1,
        submission_url: "https://drive.google.com/file/d/abc12345/view",
        submission_provider: "google_drive",
        submission_note: "Initial render cut",
        submitted_at: "2026-08-20T12:00:00.000Z",
        submitted_by: "user-pm-1",
        created_at: "2026-08-20T12:00:00.000Z",
        submitter: {
          id: "user-pm-1",
          full_name: "PM Lead",
          role: "pm",
          avatar_url: null,
        },
      },
    ];

    const html = renderToStaticMarkup(
      <DeliverableHistory
        versions={mockVersions}
        feedback={[]}
        onReportLink={vi.fn()}
      />,
    );

    expect(html).toContain("v1");
    expect(html).toContain("Initial render cut");
    expect(html).toContain("Abrir en Google Drive");
    expect(html).toContain("https://drive.google.com/file/d/abc12345/view");
    expect(html).toContain("Reportar problema con enlace");
  });

  it("renders formal feedback history with decision badge and reviewer comments", () => {
    const mockFeedback: DeliverableFeedbackView[] = [
      {
        id: "fb-1",
        deliverable_id: "deliv-1",
        version_id: "v-1",
        stage: "internal",
        decision: "changes_requested",
        comments: "Please fix the color grading in the intro sequence.",
        reviewed_at: "2026-08-20T14:00:00.000Z",
        reviewed_by: "user-pm-1",
        created_at: "2026-08-20T14:00:00.000Z",
        reviewer: {
          id: "user-pm-1",
          full_name: "PM Lead",
          role: "pm",
          avatar_url: null,
        },
      },
    ];

    const html = renderToStaticMarkup(
      <FormalFeedbackHistory feedback={mockFeedback} />,
    );

    expect(html).toContain("Registro formal de revisión");
    expect(html).toContain("Cambios Solicitados");
    expect(html).toContain(
      "Please fix the color grading in the intro sequence.",
    );
  });

  it("renders link report dialog with truthfulness notice", () => {
    const mockVersion: DeliverableVersionView = {
      id: "v-1",
      deliverable_id: "deliv-1",
      version_number: 1,
      submission_url: "https://drive.google.com/file/d/abc12345/view",
      submission_provider: "google_drive",
      submission_note: null,
      submitted_at: "2026-08-20T12:00:00.000Z",
      submitted_by: "user-pm-1",
      created_at: "2026-08-20T12:00:00.000Z",
      submitter: null,
    };

    render(
      <DeliverableLinkReportDialog
        version={mockVersion}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText("Reportar Problema con Enlace")).toBeTruthy();
    expect(
      screen.getByText(
        /El sistema no valida ni descarga el enlace de forma remota/,
      ),
    ).toBeTruthy();
  });

  it("renders deliverable review dialog with decision options and character count", () => {
    const mockDeliv: DeliverableListItem = {
      ...mockDeliverables[0],
      status: "awaiting_internal_review",
      current_version_number: 1,
    };

    render(
      <DeliverableReviewDialog
        deliverable={mockDeliv}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText("Revisión Interna del Entregable")).toBeTruthy();
    expect(screen.getByText("Aprobar para revisión de cliente")).toBeTruthy();
    expect(screen.getByText("Solicitar cambios")).toBeTruthy();
    expect(
      screen.getByText(/Este dictamen quedará asentado de forma inmutable/),
    ).toBeTruthy();
    expect(screen.getByText("0/5000")).toBeTruthy();
  });

  it("renders deliverable delivery dialog with truthfulness disclaimer", () => {
    const mockDeliv: DeliverableListItem = {
      ...mockDeliverables[0],
      status: "approved",
      current_version_number: 2,
    };

    render(
      <DeliverableDeliveryDialog
        deliverable={mockDeliv}
        projectId={mockReadyClientProject.id}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText("¿Confirmar Entrega Final?")).toBeTruthy();
    expect(
      screen.getByText(
        /La aplicación registra el estado final en el flujo de trabajo interno/,
      ),
    ).toBeTruthy();
    expect(screen.getByText("Marcar como Entregado")).toBeTruthy();
  });

  it("renders truthful waiting banner in detail sheet for awaiting_client_review", () => {
    const mockDetail: DeliverableDetailView = {
      ...mockDeliverables[0],
      status: "awaiting_client_review",
      current_version_number: 1,
      versions: [],
      feedback: [],
    };

    render(
      <DeliverableDetailSheet
        deliverable={mockDetail}
        effectiveCapacity="pm_lead"
        isOpen={true}
        onClose={vi.fn()}
        onSubmitClick={vi.fn()}
        onReportLink={vi.fn()}
      />,
    );

    expect(screen.getByText("En Espera de Revisión del Cliente")).toBeTruthy();
    expect(
      screen.getByText("Entregable liberado para revisión de cliente."),
    ).toBeTruthy();
  });

  it("renders read-only notice banner in detail sheet for delivered state", () => {
    const mockDetail: DeliverableDetailView = {
      ...mockDeliverables[0],
      status: "delivered",
      current_version_number: 2,
      versions: [],
      feedback: [],
    };

    render(
      <DeliverableDetailSheet
        deliverable={mockDetail}
        effectiveCapacity="pm_lead"
        isOpen={true}
        onClose={vi.fn()}
        onSubmitClick={vi.fn()}
        onReportLink={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Este entregable ha sido completado y entregado."),
    ).toBeTruthy();
  });

  it("suppresses archive, submit, and edit menu options for delivered status in DeliverableList", () => {
    const deliveredItem: DeliverableListItem = {
      ...mockDeliverables[0],
      status: "delivered",
      current_version_number: 2,
    };

    render(
      <DeliverableList
        deliverables={[deliveredItem]}
        effectiveCapacity="pm_lead"
        onViewDetails={vi.fn()}
        onSubmitVersion={vi.fn()}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
      />,
    );

    const trigger = screen.getByLabelText("Menú de acciones");
    fireEvent.click(trigger);

    expect(screen.getByText("Ver detalles")).toBeTruthy();
    expect(screen.queryByText("Archivar")).toBeNull();
    expect(screen.queryByText("Enviar enlace Drive")).toBeNull();
    expect(screen.queryByText("Editar")).toBeNull();
    expect(screen.queryByText("Revisar versión")).toBeNull();
    expect(screen.queryByText("Marcar como entregado")).toBeNull();
  });

  it("suppresses archive, submit, and edit menu options for delivered status in DeliverableCard", () => {
    const deliveredItem: DeliverableListItem = {
      ...mockDeliverables[0],
      status: "delivered",
      current_version_number: 2,
    };

    render(
      <DeliverableCard
        deliverable={deliveredItem}
        effectiveCapacity="pm_lead"
        onViewDetails={vi.fn()}
        onSubmitVersion={vi.fn()}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
      />,
    );

    const trigger = screen.getByLabelText("Menú de acciones");
    fireEvent.click(trigger);

    expect(screen.getByText("Ver detalles")).toBeTruthy();
    expect(screen.queryByText("Archivar")).toBeNull();
    expect(screen.queryByText("Enviar enlace Drive")).toBeNull();
    expect(screen.queryByText("Editar")).toBeNull();
    expect(screen.queryByText("Revisar versión")).toBeNull();
    expect(screen.queryByText("Marcar como entregado")).toBeNull();
  });
});
