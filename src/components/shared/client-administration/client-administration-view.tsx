"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactsPanel } from "./contacts-panel";
import { InvitationsPanel } from "./invitations-panel";
import type {
  AvailableResult,
  ClientContactAdministrationDto,
  ClientOrganizationAdministrationDto,
  ClientManagementProjectDto,
} from "@/lib/clients/types";
import type { OrdinaryInvitationPageDto } from "@/lib/invitations/types";
import { Users, Mail, AlertTriangle } from "lucide-react";

interface ClientAdministrationViewProps {
  contactsResult: AvailableResult<ClientContactAdministrationDto[]>;
  organizationsResult: AvailableResult<ClientOrganizationAdministrationDto[]>;
  projectsResult: AvailableResult<ClientManagementProjectDto[]>;
  invitationsResult: AvailableResult<OrdinaryInvitationPageDto>;
}

export function ClientAdministrationView({
  contactsResult,
  organizationsResult,
  projectsResult,
  invitationsResult,
}: ClientAdministrationViewProps) {
  const t = useTranslations("clientAdministration");
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"contacts" | "invitations">(
    "contacts",
  );

  const handleRefresh = () => {
    router.refresh();
  };

  const isContactsUnavailable =
    contactsResult.status === "unavailable" ||
    organizationsResult.status === "unavailable" ||
    projectsResult.status === "unavailable";

  const isInvitationsUnavailable =
    invitationsResult.status === "unavailable" ||
    contactsResult.status === "unavailable" ||
    projectsResult.status === "unavailable";

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "contacts" | "invitations")}
        className="w-full space-y-6"
      >
        <div className="w-full border-b border-border/80 pb-1">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex sm:grid-cols-none h-10 p-1 bg-muted/60">
            <TabsTrigger
              value="contacts"
              className="gap-2 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium"
            >
              <Users className="h-4 w-4 shrink-0" />
              <span className="truncate">{t("tabs.contacts")}</span>
            </TabsTrigger>
            <TabsTrigger
              value="invitations"
              className="gap-2 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium"
            >
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{t("tabs.invitations")}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="contacts" className="space-y-4 outline-none">
          {isContactsUnavailable ? (
            <div
              role="alert"
              className="p-6 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive flex items-center gap-3 text-sm"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">{t("unavailableTitle")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("unavailableDescription")}
                </p>
              </div>
            </div>
          ) : (
            <ContactsPanel
              contacts={contactsResult.data}
              organizations={organizationsResult.data}
              projects={projectsResult.data}
              onRefresh={handleRefresh}
            />
          )}
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4 outline-none">
          {isInvitationsUnavailable ? (
            <div
              role="alert"
              className="p-6 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive flex items-center gap-3 text-sm"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">{t("unavailableTitle")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("unavailableDescription")}
                </p>
              </div>
            </div>
          ) : (
            <InvitationsPanel
              initialItems={invitationsResult.data.items}
              initialNextCursor={invitationsResult.data.nextCursor}
              contacts={contactsResult.data}
              projects={projectsResult.data}
              onRefresh={handleRefresh}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
