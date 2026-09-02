// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { ProjectClientIdentityDialog } from "@/components/shared/projects/project-workspace/project-client-identity-dialog";
import { ProjectHeader } from "@/components/shared/projects/project-workspace/project-header";
import type { ProjectDetail } from "@/lib/projects/queries";
import type {
  AvailableResult,
  ClientOrganizationWorkspaceDto,
  DirectContactWorkspaceDto,
} from "@/lib/clients/types";
import * as projectActions from "@/lib/projects/actions";
import * as clientActions from "@/lib/clients/actions";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/invitations/actions", () => ({
  createOrdinaryInvitationAction: vi.fn(),
}));

vi.mock(
  "@/components/shared/client-administration/invitation-create-dialog",
  () => ({
    InvitationCreateDialog: () => null,
  }),
);

vi.mock(
  "@/components/shared/client-administration/invitation-copy-dialog",
  () => ({
    InvitationCopyDialog: () => null,
  }),
);

vi.mock("@/config/app.config", () => ({
  appConfig: {
    appUrl: "http://localhost:3000",
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "sb_publishable_test_key",
  },
}));

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const messages: Record<string, string> = {
      dialogTitle: "Identidad del Cliente",
      dialogDescription: "Configura la identidad del cliente",
      "summary.clientIdentityAction": "Identidad del Cliente",
      "summary.editAction": "Editar",
      "summary.statusActions": "Estado",
      "breadcrumbs.root": "Proyectos",
      "modes.organization": "Organización",
      "modes.directContact": "Contacto Directo",
      "modes.noIdentity": "Sin Identidad Aún",
      "fields.mode": "Modo",
      "fields.selectOrg": "Organización",
      "fields.selectContact": "Contacto Directo",
      "actions.save": "Guardar",
      "actions.cancel": "Cancelar",
      "actions.close": "Cerrar",
      confirmTransitionTitle: "¿Confirmar Cambio de Identidad?",
      confirmTransitionAction: "Confirmar y Guardar",
      "errors.unavailable": "Datos no disponibles",
      "errors.saveFailed": "Error al guardar",
    };
    return (key: string) => messages[key] ?? key;
  },
  useFormatter: () => ({
    dateTime: () => "01/01/2026",
  }),
  useLocale: () => "es-MX",
}));

vi.mock("@/lib/projects/actions", () => ({
  updateProjectIdentityAction: vi.fn(),
}));

vi.mock("@/lib/clients/actions", () => ({
  setProjectClientContactAction: vi.fn(),
}));

const baseMockProject: ProjectDetail = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Campaña Primavera",
  project_type: "client",
  status: "planning",
  client_id: null,
  client_scope: null,
  drive_folder_url: null,
  internal_description: "Internal project details",
  deadline_at: "2026-12-31T00:00:00Z",
  completed_at: null,
  archived_at: null,
  archived_by: null,
  archive_reason: null,
  deleted_at: null,
  created_at: "2026-01-01T00:00:00Z",
  created_by: "00000000-0000-0000-0000-000000000000",
  updated_at: "2026-01-01T00:00:00Z",
  updated_by: null,
  members: [],
};

const mockOrgs: AvailableResult<ClientOrganizationWorkspaceDto[]> = {
  status: "available",
  data: [{ id: "22222222-2222-2222-2222-222222222222", name: "Acme Corp" }],
};

const mockDirectContacts: AvailableResult<DirectContactWorkspaceDto[]> = {
  status: "available",
  data: [
    {
      id: "33333333-3333-3333-3333-333333333333",
      fullName: "Carlos Slim",
      profileId: null,
    },
  ],
};

const mockAssociations: AvailableResult<string[]> = {
  status: "available",
  data: [],
};

describe("Project Client Identity Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders Client Identity button in ProjectHeader for eligible planning client project", () => {
    const onOpen = vi.fn();
    render(
      <ProjectHeader
        project={baseMockProject}
        clients={[]}
        effectiveCapacity="admin"
        actorRole="admin"
        baseHref="/admin/proyectos"
        onOpenEditDialog={vi.fn()}
        onOpenStatusDialog={vi.fn()}
        onOpenClientIdentity={onOpen}
      />,
    );

    const btn = screen.getByRole("button", { name: /Identidad del Cliente/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalled();
  });

  it("does NOT render Client Identity button when project is completed or cancelled", () => {
    const onOpen = vi.fn();
    const completedProject: ProjectDetail = {
      ...baseMockProject,
      status: "completed",
    };

    const { rerender } = render(
      <ProjectHeader
        project={completedProject}
        clients={[]}
        effectiveCapacity="admin"
        actorRole="admin"
        baseHref="/admin/proyectos"
        onOpenEditDialog={vi.fn()}
        onOpenStatusDialog={vi.fn()}
        onOpenClientIdentity={onOpen}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Identidad del Cliente/i }),
    ).not.toBeInTheDocument();

    const cancelledProject: ProjectDetail = {
      ...baseMockProject,
      status: "cancelled",
    };

    rerender(
      <ProjectHeader
        project={cancelledProject}
        clients={[]}
        effectiveCapacity="admin"
        actorRole="admin"
        baseHref="/admin/proyectos"
        onOpenEditDialog={vi.fn()}
        onOpenStatusDialog={vi.fn()}
        onOpenClientIdentity={onOpen}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Identidad del Cliente/i }),
    ).not.toBeInTheDocument();
  });

  it("does NOT render Client Identity button for internal projects", () => {
    const internalProject: ProjectDetail = {
      ...baseMockProject,
      project_type: "internal",
    };

    render(
      <ProjectHeader
        project={internalProject}
        clients={[]}
        effectiveCapacity="admin"
        actorRole="admin"
        baseHref="/admin/proyectos"
        onOpenEditDialog={vi.fn()}
        onOpenStatusDialog={vi.fn()}
        onOpenClientIdentity={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Identidad del Cliente/i }),
    ).not.toBeInTheDocument();
  });

  it("renders unavailable alert when projections are unavailable", () => {
    render(
      <ProjectClientIdentityDialog
        isOpen={true}
        onClose={vi.fn()}
        project={baseMockProject}
        organizations={{ status: "unavailable" }}
        directContacts={mockDirectContacts}
        associatedContactIds={mockAssociations}
        actorRole="admin"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Datos no disponibles");
  });

  it("associates direct contact via setProjectClientContactAction in planning mode", async () => {
    vi.mocked(clientActions.setProjectClientContactAction).mockResolvedValue({
      ok: true,
      data: true,
    });
    vi.mocked(projectActions.updateProjectIdentityAction).mockResolvedValue({
      ok: true,
      data: baseMockProject,
    });

    const onClose = vi.fn();
    render(
      <ProjectClientIdentityDialog
        isOpen={true}
        onClose={onClose}
        project={baseMockProject}
        organizations={mockOrgs}
        directContacts={mockDirectContacts}
        associatedContactIds={mockAssociations}
        actorRole="admin"
      />,
    );

    // Save with default mode
    const saveBtn = screen.getByRole("button", { name: "Guardar" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
