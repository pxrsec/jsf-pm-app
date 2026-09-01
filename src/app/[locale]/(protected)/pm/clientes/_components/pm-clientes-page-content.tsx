"use client";

import { ClientAdministrationView } from "@/components/shared/client-administration/client-administration-view";
import type {
  AvailableResult,
  ClientContactAdministrationDto,
  ClientOrganizationAdministrationDto,
  ClientManagementProjectDto,
} from "@/lib/clients/types";
import type { OrdinaryInvitationPageDto } from "@/lib/invitations/types";

interface PmClientesPageContentProps {
  contactsResult: AvailableResult<ClientContactAdministrationDto[]>;
  organizationsResult: AvailableResult<ClientOrganizationAdministrationDto[]>;
  projectsResult: AvailableResult<ClientManagementProjectDto[]>;
  invitationsResult: AvailableResult<OrdinaryInvitationPageDto>;
}

export function PmClientesPageContent({
  contactsResult,
  organizationsResult,
  projectsResult,
  invitationsResult,
}: PmClientesPageContentProps) {
  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <ClientAdministrationView
        contactsResult={contactsResult}
        organizationsResult={organizationsResult}
        projectsResult={projectsResult}
        invitationsResult={invitationsResult}
      />
    </div>
  );
}
