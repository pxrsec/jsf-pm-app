// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ClientAdministrationView } from "../client-administration-view";
import { ContactCard } from "../contact-card";
import { InvitationCard } from "../invitation-card";
import type {
  ClientContactAdministrationDto,
  ClientOrganizationAdministrationDto,
  ClientManagementProjectDto,
} from "@/lib/clients/types";
import type {
  OrdinaryInvitationListItemDto,
  OrdinaryInvitationPageDto,
} from "@/lib/invitations/types";

vi.mock("@/lib/clients/actions", () => ({
  setProjectClientContactAction: vi
    .fn()
    .mockResolvedValue({ ok: true, data: undefined }),
  loadProjectClientContactAssociationsAction: vi
    .fn()
    .mockResolvedValue({ ok: true, data: [] }),
  saveClientContactAction: vi
    .fn()
    .mockResolvedValue({ ok: true, data: undefined }),
}));

vi.mock("@/lib/invitations/actions", () => ({
  createOrdinaryInvitationAction: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      invitationId: "mock-id",
      role: "client",
      expiresAt: "2026-09-08T00:00:00Z",
      invitationUrl: "https://example.com/invitacion?token=abc",
    },
  }),
  rotateOrdinaryInvitationAction: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      invitationId: "mock-id",
      role: "client",
      expiresAt: "2026-09-08T00:00:00Z",
      invitationUrl: "https://example.com/invitacion?token=xyz",
    },
  }),
  revokeOrdinaryInvitationAction: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      changed: true,
      invitationId: "mock-id",
      invitationStatus: "revoked",
    },
  }),
  loadOrdinaryInvitationPageAction: vi.fn().mockResolvedValue({
    ok: true,
    data: { items: [], nextCursor: null },
  }),
}));

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/admin/clientes",
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
  useTranslations: (namespace?: string) => (key: string) => {
    if (namespace === "clientAdministration.contactsPanel") {
      const panelMap: Record<string, string> = {
        title: "Client Directory",
        description: "Directory of client contacts.",
        createContact: "New Contact",
        projectAssociationTitle: "Project Association Toolbar",
        selectProjectPlaceholder: "Select project...",
        noProjectSelectedPlaceholder: "No project selected",
        emptyState: "No contacts found",
        directContactBadge: "Direct Contact",
        primaryBadge: "Primary",
        unknownOrg: "Unknown",
        accountLinked: "Account Linked",
        noAccount: "No Account",
        orgContactNotToggled: "Organization contact",
        toggleAssociationAria: "Toggle project association for",
        editContactAria: "Edit contact",
      };
      return panelMap[key] ?? key;
    }

    if (namespace === "clientAdministration.invitationsPanel") {
      const inviteMap: Record<string, string> = {
        title: "Invitations",
        description: "Manage system invitations.",
        createInvitation: "Issue Invitation",
        emptyState: "No invitations found",
        terminalState: "Finalized",
        "roles.client": "Client",
        "roles.operator": "Operator",
        "statuses.pending": "Pending",
        "statuses.accepted": "Accepted",
        "statuses.expired": "Expired",
        "statuses.revoked": "Revoked",
        "actions.rotate": "Resend / Rotate Link",
        "actions.revoke": "Revoke Invitation",
        "columns.role": "Role",
        "columns.recipient": "Recipient",
        "columns.project": "Project",
        "columns.status": "Status",
        "columns.createdAt": "Issued",
        "columns.expiresAt": "Expires",
        "columns.resolvedAt": "Resolved",
        "columns.actions": "Actions",
      };
      return inviteMap[key] ?? key;
    }

    const translations: Record<string, string> = {
      title: "Client Administration",
      description: "Manage client directory and invitations.",
      "tabs.contacts": "Contacts & Directory",
      "tabs.invitations": "Invitations",
      directContactBadge: "Direct Contact",
      primaryBadge: "Primary",
      unknownOrg: "Unknown",
      accountLinked: "Account Linked",
      noAccount: "No Account",
      "columns.accountStatus": "Account Status",
      "columns.projectAssociated": "Associated with Project",
      "columns.createdAt": "Issued",
      "columns.expiresAt": "Expires",
      "columns.resolvedAt": "Resolved",
      "actions.rotate": "Resend / Rotate Link",
      "actions.revoke": "Revoke Invitation",
      terminalState: "Finalized",
      "roles.client": "Client",
      "roles.operator": "Operator",
      "statuses.pending": "Pending",
      "statuses.accepted": "Accepted",
      "statuses.expired": "Expired",
      "statuses.revoked": "Revoked",
      editContactAria: "Edit contact",
      toggleAssociationAria: "Toggle project association for",
    };
    return translations[key] ?? `${namespace ? namespace + "." : ""}${key}`;
  },
  useFormatter: () => ({
    dateTime: (date: Date) => date.toISOString(),
  }),
  useLocale: () => "es-MX",
}));

const mockContactDirect: ClientContactAdministrationDto = {
  id: "contact-1",
  clientId: null,
  profileId: null,
  fullName: "Alice Direct",
  email: "alice@example.com",
  phoneE164: "+525511223344",
  jobTitle: "Direct Producer",
  isPrimary: false,
  createdAt: "2026-08-30T10:00:00Z",
  updatedAt: "2026-08-30T10:00:00Z",
};

const mockContactOrg: ClientContactAdministrationDto = {
  id: "contact-2",
  clientId: "org-1",
  profileId: "profile-1",
  fullName: "Bob Org",
  email: "bob@acme.com",
  phoneE164: null,
  jobTitle: "Marketing Lead",
  isPrimary: true,
  createdAt: "2026-08-30T10:00:00Z",
  updatedAt: "2026-08-30T10:00:00Z",
};

const mockOrganizations: ClientOrganizationAdministrationDto[] = [
  { id: "org-1", displayName: "Acme Corp", slug: "acme-corp" },
];

const mockProjects: ClientManagementProjectDto[] = [
  { id: "proj-1", name: "Summer Commercial" },
];

const mockInvitation: OrdinaryInvitationListItemDto = {
  invitationId: "invite-1",
  role: "client",
  status: "pending",
  recipientLabel: "Charlie Client (charlie@example.com)",
  contactId: "contact-3",
  projectId: "proj-1",
  projectName: "Summer Commercial",
  createdAt: "2026-08-30T12:00:00Z",
  expiresAt: "2026-09-06T12:00:00Z",
  acceptedAt: null,
  revokedAt: null,
};

describe("Client Administration UI Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("ClientAdministrationView", () => {
    it("renders page header, description, and horizontal tabs list", () => {
      const contactsResult = {
        status: "available" as const,
        data: [mockContactDirect, mockContactOrg],
      };
      const organizationsResult = {
        status: "available" as const,
        data: mockOrganizations,
      };
      const projectsResult = {
        status: "available" as const,
        data: mockProjects,
      };
      const invitationsResult = {
        status: "available" as const,
        data: {
          items: [mockInvitation],
          nextCursor: null,
        } as OrdinaryInvitationPageDto,
      };

      render(
        <ClientAdministrationView
          contactsResult={contactsResult}
          organizationsResult={organizationsResult}
          projectsResult={projectsResult}
          invitationsResult={invitationsResult}
        />,
      );

      expect(screen.getByText("Client Administration")).toBeInTheDocument();
      expect(
        screen.getByText("Manage client directory and invitations."),
      ).toBeInTheDocument();
      expect(screen.getByText("Contacts & Directory")).toBeInTheDocument();
      expect(screen.getByText("Invitations")).toBeInTheDocument();
    });
  });

  describe("ContactCard (Mobile)", () => {
    it("renders direct contact with direct badge and unlinked account badge", () => {
      const onOpenEdit = vi.fn();
      const onToggleAssociation = vi.fn();
      const t = (key: string) => key;

      render(
        <ContactCard
          contact={mockContactDirect}
          orgName={null}
          selectedProjectId="proj-1"
          isAssociated={false}
          isMutating={false}
          isLoadingAssociations={false}
          onToggleAssociation={onToggleAssociation}
          onOpenEdit={onOpenEdit}
          t={t}
        />,
      );

      expect(screen.getByText("Alice Direct")).toBeInTheDocument();
      expect(screen.getByText("directContactBadge")).toBeInTheDocument();
      expect(screen.getByText("Direct Producer")).toBeInTheDocument();
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
      expect(screen.getByText("noAccount")).toBeInTheDocument();

      const editBtn = screen.getByLabelText("editContactAria Alice Direct");
      fireEvent.click(editBtn);
      expect(onOpenEdit).toHaveBeenCalledWith(mockContactDirect);
    });

    it("renders org contact with primary badge and linked account badge", () => {
      const onOpenEdit = vi.fn();
      const onToggleAssociation = vi.fn();
      const t = (key: string) => key;

      render(
        <ContactCard
          contact={mockContactOrg}
          orgName="Acme Corp"
          selectedProjectId="proj-1"
          isAssociated={false}
          isMutating={false}
          isLoadingAssociations={false}
          onToggleAssociation={onToggleAssociation}
          onOpenEdit={onOpenEdit}
          t={t}
        />,
      );

      expect(screen.getByText("Bob Org")).toBeInTheDocument();
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
      expect(screen.getByText("primaryBadge")).toBeInTheDocument();
      expect(screen.getByText("accountLinked")).toBeInTheDocument();
      expect(screen.getByText("orgContactNotToggled")).toBeInTheDocument();
    });
  });

  describe("InvitationCard (Mobile)", () => {
    it("renders invitation card with role, status, project and action buttons", () => {
      const onOpenRotate = vi.fn();
      const onOpenRevoke = vi.fn();
      const t = (key: string) => {
        const map: Record<string, string> = {
          "roles.client": "Client",
          "statuses.pending": "Pending",
          "actions.rotate": "Rotate",
          "actions.revoke": "Revoke",
          "columns.createdAt": "Issued",
          "columns.expiresAt": "Expires",
        };
        return map[key] ?? key;
      };

      render(
        <InvitationCard
          item={mockInvitation}
          onOpenRotate={onOpenRotate}
          onOpenRevoke={onOpenRevoke}
          formattedCreatedAt="2026-08-30 12:00"
          formattedExpiresAt="2026-09-06 12:00"
          formattedResolvedAt={null}
          t={t}
        />,
      );

      expect(screen.getByText("Client")).toBeInTheDocument();
      expect(screen.getByText("Pending")).toBeInTheDocument();
      expect(
        screen.getByText("Charlie Client (charlie@example.com)"),
      ).toBeInTheDocument();
      expect(screen.getByText("Summer Commercial")).toBeInTheDocument();

      const rotateBtn = screen.getByLabelText(
        "Rotate Charlie Client (charlie@example.com)",
      );
      fireEvent.click(rotateBtn);
      expect(onOpenRotate).toHaveBeenCalledWith(mockInvitation);

      const revokeBtn = screen.getByLabelText(
        "Revoke Charlie Client (charlie@example.com)",
      );
      fireEvent.click(revokeBtn);
      expect(onOpenRevoke).toHaveBeenCalledWith(mockInvitation);
    });
  });
});
