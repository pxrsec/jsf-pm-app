"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContactDialog } from "./contact-dialog";
import { ContactCard } from "./contact-card";
import {
  setProjectClientContactAction,
  loadProjectClientContactAssociationsAction,
} from "@/lib/clients/actions";
import type {
  ClientContactAdministrationDto,
  ClientOrganizationAdministrationDto,
  ClientManagementProjectDto,
} from "@/lib/clients/types";
import {
  Plus,
  Edit2,
  FolderKanban,
  Info,
  Loader2,
  CheckCircle2,
  HelpCircle,
  Building2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";

interface ContactsPanelProps {
  contacts: ClientContactAdministrationDto[];
  organizations: ClientOrganizationAdministrationDto[];
  projects: ClientManagementProjectDto[];
  onRefresh: () => void;
}

const NO_PROJECT_SELECTED = "__none__";

export function ContactsPanel({
  contacts,
  organizations,
  projects,
  onRefresh,
}: ContactsPanelProps) {
  const t = useTranslations("clientAdministration.contactsPanel");
  const [, startTransition] = useTransition();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] =
    useState<ClientContactAdministrationDto | null>(null);

  // Project Association Toolbar state
  const [selectedProjectId, setSelectedProjectId] =
    useState<string>(NO_PROJECT_SELECTED);
  const [associatedContactIds, setAssociatedContactIds] = useState<Set<string>>(
    new Set(),
  );
  const [isLoadingAssociations, setIsLoadingAssociations] = useState(false);
  const [mutatingContactId, setMutatingContactId] = useState<string | null>(
    null,
  );

  const orgMap = new Map(organizations.map((org) => [org.id, org.displayName]));

  const handleOpenCreate = () => {
    setEditingContact(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (contact: ClientContactAdministrationDto) => {
    setEditingContact(contact);
    setIsDialogOpen(true);
  };

  const handleProjectSelect = async (projectId: string) => {
    setSelectedProjectId(projectId);
    if (projectId === NO_PROJECT_SELECTED) {
      setAssociatedContactIds(new Set());
      return;
    }

    setIsLoadingAssociations(true);
    try {
      const result = await loadProjectClientContactAssociationsAction({
        projectId,
      });
      if (result.ok) {
        setAssociatedContactIds(new Set(result.data));
      } else {
        toast.error(t("associationLoadFailed"));
        setAssociatedContactIds(new Set());
      }
    } catch {
      toast.error(t("associationLoadFailed"));
      setAssociatedContactIds(new Set());
    } finally {
      setIsLoadingAssociations(false);
    }
  };

  const handleToggleAssociation = async (
    contactId: string,
    nextAssociated: boolean,
  ) => {
    if (selectedProjectId === NO_PROJECT_SELECTED) return;

    setMutatingContactId(contactId);
    try {
      const result = await setProjectClientContactAction({
        projectId: selectedProjectId,
        contactId,
        associated: nextAssociated,
      });

      if (result.ok) {
        setAssociatedContactIds((prev) => {
          const next = new Set(prev);
          if (nextAssociated) {
            next.add(contactId);
          } else {
            next.delete(contactId);
          }
          return next;
        });
        toast.success(
          nextAssociated ? t("associatedSuccess") : t("disassociatedSuccess"),
        );
        startTransition(() => {
          onRefresh();
        });
      } else {
        toast.error(t("associationMutationFailed"));
      }
    } catch {
      toast.error(t("associationMutationFailed"));
    } finally {
      setMutatingContactId(null);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold text-foreground">
            {t("title")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("description")}</p>
        </div>
        <Button
          onClick={handleOpenCreate}
          size="sm"
          className="gap-1.5 w-full sm:w-auto h-9 font-medium shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>{t("createContact")}</span>
        </Button>
      </div>

      {/* Project Association Toolbar */}
      <div className="p-3.5 sm:p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-foreground">
              {t("projectAssociationTitle")}
            </span>
          </div>
          <div className="w-full sm:w-80">
            <Select
              value={selectedProjectId}
              onValueChange={(val) => {
                if (val) handleProjectSelect(val);
              }}
              items={[
                {
                  value: NO_PROJECT_SELECTED,
                  label: t("noProjectSelectedPlaceholder"),
                },
                ...projects.map((p) => ({
                  value: p.id,
                  label: p.name,
                })),
              ]}
            >
              <SelectTrigger
                id="toolbar-project-select"
                className="h-9 w-full text-xs"
              >
                <SelectValue placeholder={t("selectProjectPlaceholder")} />
              </SelectTrigger>
              <SelectContent className="w-[var(--anchor-width)] min-w-[280px]">
                <SelectItem value={NO_PROJECT_SELECTED}>
                  {t("noProjectSelectedPlaceholder")}
                </SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedProjectId !== NO_PROJECT_SELECTED && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 text-blue-900 dark:text-blue-200 text-xs">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <p className="leading-relaxed">
              {t("associationExplanationNotice")}
            </p>
          </div>
        )}
      </div>

      {/* Mobile Card List (< sm) */}
      <div className="block sm:hidden space-y-3">
        {contacts.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-border bg-card/50 text-center space-y-2">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">{t("emptyState")}</p>
          </div>
        ) : (
          contacts.map((contact) => {
            const isDirect = contact.clientId === null;
            const orgName = contact.clientId
              ? (orgMap.get(contact.clientId) ?? null)
              : null;
            const isAssociated =
              isDirect && associatedContactIds.has(contact.id);
            const isMutating = mutatingContactId === contact.id;

            return (
              <ContactCard
                key={contact.id}
                contact={contact}
                orgName={orgName}
                selectedProjectId={selectedProjectId}
                isAssociated={isAssociated}
                isMutating={isMutating}
                isLoadingAssociations={isLoadingAssociations}
                onToggleAssociation={handleToggleAssociation}
                onOpenEdit={handleOpenEdit}
                t={t}
              />
            );
          })
        )}
      </div>

      {/* Desktop Data Table (>= sm) */}
      <div className="hidden sm:block rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-semibold text-xs">
                {t("columns.name")}
              </TableHead>
              <TableHead className="font-semibold text-xs">
                {t("columns.organization")}
              </TableHead>
              <TableHead className="font-semibold text-xs">
                {t("columns.jobTitle")}
              </TableHead>
              <TableHead className="font-semibold text-xs">
                {t("columns.email")}
              </TableHead>
              <TableHead className="font-semibold text-xs">
                {t("columns.accountStatus")}
              </TableHead>
              {selectedProjectId !== NO_PROJECT_SELECTED && (
                <TableHead className="font-semibold text-xs text-center">
                  {t("columns.projectAssociated")}
                </TableHead>
              )}
              <TableHead className="w-[80px] text-right font-semibold text-xs">
                {t("columns.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={selectedProjectId !== NO_PROJECT_SELECTED ? 7 : 6}
                  className="h-32 text-center text-xs text-muted-foreground"
                >
                  {t("emptyState")}
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => {
                const isDirect = contact.clientId === null;
                const orgName = contact.clientId
                  ? orgMap.get(contact.clientId)
                  : null;
                const isLinked = contact.profileId !== null;
                const isAssociated =
                  isDirect && associatedContactIds.has(contact.id);
                const isMutating = mutatingContactId === contact.id;

                return (
                  <TableRow key={contact.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-xs">
                      <div className="flex items-center gap-2">
                        {isDirect ? (
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span>{contact.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {isDirect ? (
                        <Badge
                          variant="secondary"
                          className="font-normal text-[11px] bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                        >
                          {t("directContactBadge")}
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span>{orgName ?? t("unknownOrg")}</span>
                          {contact.isPrimary && (
                            <Badge
                              variant="outline"
                              className="text-[10px] h-4 px-1 font-normal text-muted-foreground"
                            >
                              {t("primaryBadge")}
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {contact.jobTitle || "—"}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {contact.email}
                    </TableCell>
                    <TableCell className="text-xs">
                      {isLinked ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-normal text-[11px]"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{t("accountLinked")}</span>
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 border-border text-muted-foreground font-normal text-[11px]"
                        >
                          <HelpCircle className="h-3 w-3" />
                          <span>{t("noAccount")}</span>
                        </Badge>
                      )}
                    </TableCell>
                    {selectedProjectId !== NO_PROJECT_SELECTED && (
                      <TableCell className="text-center">
                        {isDirect ? (
                          <div className="flex justify-center items-center">
                            {isLoadingAssociations ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            ) : (
                              <Checkbox
                                checked={isAssociated}
                                onCheckedChange={(checked) =>
                                  handleToggleAssociation(
                                    contact.id,
                                    Boolean(checked),
                                  )
                                }
                                disabled={isMutating}
                                aria-label={`${t("toggleAssociationAria")} ${contact.fullName}`}
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            {t("orgContactNotToggled")}
                          </span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleOpenEdit(contact)}
                        aria-label={`${t("editContactAria")} ${contact.fullName}`}
                      >
                        <Edit2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ContactDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={() => {
          onRefresh();
          if (selectedProjectId !== NO_PROJECT_SELECTED) {
            handleProjectSelect(selectedProjectId);
          }
        }}
        organizations={organizations}
        contactToEdit={editingContact}
      />
    </div>
  );
}
