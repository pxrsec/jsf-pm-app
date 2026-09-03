"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  User,
  AlertCircle,
  Loader2,
  MailPlus,
  ShieldCheck,
  Ban,
} from "lucide-react";
import type { ProjectDetail } from "@/lib/projects/queries";
import type {
  AvailableResult,
  ClientOrganizationWorkspaceDto,
  DirectContactWorkspaceDto,
} from "@/lib/clients/types";
import { updateProjectIdentityAction } from "@/lib/projects/actions";
import { setProjectClientContactAction } from "@/lib/clients/actions";
import {
  InvitationCreateDialog,
  type DirectClientProjectInviteMode,
} from "@/components/shared/client-administration/invitation-create-dialog";
import { InvitationCopyDialog } from "@/components/shared/client-administration/invitation-copy-dialog";

export interface ProjectClientIdentityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectDetail;
  organizations?: AvailableResult<ClientOrganizationWorkspaceDto[]>;
  directContacts?: AvailableResult<DirectContactWorkspaceDto[]>;
  associatedContactIds?: AvailableResult<string[]>;
  actorRole: "admin" | "pm";
}

type IdentityMode = "organization" | "direct_contact" | "none";

export function ProjectClientIdentityDialog({
  isOpen,
  onClose,
  project,
  organizations,
  directContacts,
  associatedContactIds,
}: ProjectClientIdentityDialogProps) {
  const t = useTranslations("projects.workspace.clientIdentity");
  const router = useRouter();
  const [, startTransition] = useTransition();

  const isPlanning = project.status === "planning";

  // Check unavailable state
  const isUnavailable =
    !organizations ||
    organizations.status === "unavailable" ||
    !directContacts ||
    directContacts.status === "unavailable" ||
    !associatedContactIds ||
    associatedContactIds.status === "unavailable";

  const orgsList =
    organizations?.status === "available" ? organizations.data : [];
  const directList =
    directContacts?.status === "available" ? directContacts.data : [];
  const currentAssocIds =
    associatedContactIds?.status === "available"
      ? associatedContactIds.data
      : [];

  // Determine initial mode
  const initialMode: IdentityMode = project.client_id
    ? "organization"
    : currentAssocIds.length > 0
      ? "direct_contact"
      : "none";

  const [mode, setMode] = useState<IdentityMode>(initialMode);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    project.client_id ?? (orgsList[0]?.id || ""),
  );
  const [selectedContactId, setSelectedContactId] = useState<string>(
    currentAssocIds[0] ?? (directList[0]?.id || ""),
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Destructive transition confirmation state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Invitation creation & copy dialog state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [isCopyOpen, setIsCopyOpen] = useState(false);

  const associatedDirectContact = directList.find((c) =>
    currentAssocIds.includes(c.id),
  );

  const handleClose = () => {
    if (isSubmitting) return;
    setErrorMessage(null);
    setInvitationUrl(null);
    onClose();
  };

  const isDestructiveTransition = (): boolean => {
    if (initialMode === "direct_contact") {
      if (
        mode === "direct_contact" &&
        selectedContactId !== currentAssocIds[0]
      ) {
        return true;
      }
      if (mode === "organization" || mode === "none") {
        return true;
      }
    }
    if (
      initialMode === "organization" &&
      (mode === "direct_contact" || mode === "none")
    ) {
      return true;
    }
    return false;
  };

  const executeMutationSequence = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (mode === "organization") {
        if (!selectedOrgId) {
          setErrorMessage(t("errors.validationFailed"));
          setIsSubmitting(false);
          return;
        }

        // 1. Disassociate all currently associated direct contacts
        for (const contactId of currentAssocIds) {
          const res = await setProjectClientContactAction({
            projectId: project.id,
            contactId,
            associated: false,
          });
          if (!res.ok) {
            handleSequenceFailure();
            return;
          }
        }

        // 2. Update organization client_id
        const orgRes = await updateProjectIdentityAction(project.id, {
          client_id: selectedOrgId,
        });
        if (!orgRes.ok) {
          handleSequenceFailure();
          return;
        }
      } else if (mode === "direct_contact") {
        if (!isPlanning) {
          setErrorMessage(t("errors.readinessConflict"));
          setIsSubmitting(false);
          return;
        }
        if (!selectedContactId) {
          setErrorMessage(t("errors.validationFailed"));
          setIsSubmitting(false);
          return;
        }

        // 1. Clear organization if set
        if (project.client_id !== null) {
          const clearOrgRes = await updateProjectIdentityAction(project.id, {
            client_id: null,
          });
          if (!clearOrgRes.ok) {
            handleSequenceFailure();
            return;
          }
        }

        // 2. Disassociate non-selected direct contacts
        for (const contactId of currentAssocIds) {
          if (contactId !== selectedContactId) {
            const res = await setProjectClientContactAction({
              projectId: project.id,
              contactId,
              associated: false,
            });
            if (!res.ok) {
              handleSequenceFailure();
              return;
            }
          }
        }

        // 3. Associate selected direct contact if not already associated
        if (!currentAssocIds.includes(selectedContactId)) {
          const assocRes = await setProjectClientContactAction({
            projectId: project.id,
            contactId: selectedContactId,
            associated: true,
          });
          if (!assocRes.ok) {
            handleSequenceFailure();
            return;
          }
        }
      } else if (mode === "none") {
        if (!isPlanning) {
          setErrorMessage(t("errors.readinessConflict"));
          setIsSubmitting(false);
          return;
        }

        // 1. Disassociate all currently associated direct contacts
        for (const contactId of currentAssocIds) {
          const res = await setProjectClientContactAction({
            projectId: project.id,
            contactId,
            associated: false,
          });
          if (!res.ok) {
            handleSequenceFailure();
            return;
          }
        }

        // 2. Clear organization client_id
        if (project.client_id !== null) {
          const clearRes = await updateProjectIdentityAction(project.id, {
            client_id: null,
          });
          if (!clearRes.ok) {
            handleSequenceFailure();
            return;
          }
        }
      }

      // Reconciliation & success
      setInvitationUrl(null);
      startTransition(() => {
        router.refresh();
      });
      onClose();
    } catch {
      handleSequenceFailure();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSequenceFailure = () => {
    setErrorMessage(t("errors.saveFailed"));
    setInvitationUrl(null);
    startTransition(() => {
      router.refresh();
    });
  };

  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDestructiveTransition()) {
      setIsConfirmOpen(true);
    } else {
      executeMutationSequence();
    }
  };

  const directClientMode: DirectClientProjectInviteMode | undefined =
    associatedDirectContact
      ? {
          contactId: associatedDirectContact.id,
          contactName: associatedDirectContact.fullName,
          projectId: project.id,
        }
      : undefined;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span>{t("dialogTitle")}</span>
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              {t("dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          {isUnavailable ? (
            <div className="space-y-4 py-4">
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{t("errors.unavailable")}</p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  {t("actions.close")}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleSaveClick} className="space-y-5 pt-2">
              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Mode Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  {t("fields.mode")}
                </Label>
                {isPlanning ? (
                  <Select
                    value={mode}
                    onValueChange={(val) => {
                      if (val) setMode(val as IdentityMode);
                    }}
                    disabled={isSubmitting}
                    items={[
                      { value: "organization", label: t("modes.organization") },
                      {
                        value: "direct_contact",
                        label: t("modes.directContact"),
                      },
                      { value: "none", label: t("modes.noIdentity") },
                    ]}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="organization">
                        {t("modes.organization")}
                      </SelectItem>
                      <SelectItem value="direct_contact">
                        {t("modes.directContact")}
                      </SelectItem>
                      <SelectItem value="none">
                        {t("modes.noIdentity")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-md border border-border/80 bg-muted/40 px-3 py-2 text-xs font-medium text-foreground">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span>{t("modes.organization")}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {t("nonPlanningNotice")}
                    </p>
                  </div>
                )}
              </div>

              {/* Mode Specific Body */}
              {mode === "organization" && (
                <div className="space-y-2 rounded-lg border border-border/70 bg-card/60 p-3.5">
                  <Label htmlFor="select-org" className="text-xs font-medium">
                    {t("fields.selectOrg")}
                  </Label>
                  <Select
                    value={selectedOrgId}
                    onValueChange={(val) => {
                      if (val) setSelectedOrgId(val);
                    }}
                    disabled={isSubmitting || orgsList.length === 0}
                    items={orgsList.map((org) => ({
                      value: org.id,
                      label: org.name,
                    }))}
                  >
                    <SelectTrigger id="select-org" className="h-9 w-full">
                      <SelectValue placeholder={t("placeholders.org")} />
                    </SelectTrigger>
                    <SelectContent>
                      {orgsList.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {mode === "direct_contact" && isPlanning && (
                <div className="space-y-3 rounded-lg border border-border/70 bg-card/60 p-3.5">
                  <div className="space-y-2">
                    <Label
                      htmlFor="select-direct"
                      className="text-xs font-medium"
                    >
                      {t("fields.selectContact")}
                    </Label>
                    <Select
                      value={selectedContactId}
                      onValueChange={(val) => {
                        if (val) setSelectedContactId(val);
                      }}
                      disabled={isSubmitting || directList.length === 0}
                      items={directList.map((c) => ({
                        value: c.id,
                        label: c.fullName,
                      }))}
                    >
                      <SelectTrigger id="select-direct" className="h-9 w-full">
                        <SelectValue placeholder={t("placeholders.contact")} />
                      </SelectTrigger>
                      <SelectContent>
                        {directList.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center justify-between w-full gap-2">
                              <span>{c.fullName}</span>
                              {c.profileId ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] h-4"
                                >
                                  {t("linkedAccountBadge")}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] h-4"
                                >
                                  {t("noAccountBadge")}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {t("directContactNotice")}
                  </p>
                </div>
              )}

              {mode === "none" && isPlanning && (
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3.5">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("noIdentityPlanningNotice")}
                  </p>
                </div>
              )}

              {/* Associated Direct Contact Status & Invite Button */}
              {associatedDirectContact && initialMode === "direct_contact" && (
                <div className="rounded-lg border border-border/80 bg-accent/5 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-foreground">
                        {associatedDirectContact.fullName}
                      </span>
                    </div>
                    {associatedDirectContact.profileId ? (
                      <Badge variant="secondary" className="gap-1 text-[11px]">
                        <ShieldCheck className="h-3 w-3 text-emerald-600" />
                        <span>{t("linkedAccountBadge")}</span>
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[11px]">
                        {t("noAccountBadge")}
                      </Badge>
                    )}
                  </div>

                  {associatedDirectContact.profileId ? (
                    <p className="text-[11px] text-muted-foreground">
                      {t("linkedAccountMemberHint")}
                    </p>
                  ) : (
                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full gap-1.5 text-xs h-8 cursor-pointer font-medium"
                        onClick={() => setIsInviteOpen(true)}
                        disabled={isSubmitting}
                      >
                        <MailPlus className="h-3.5 w-3.5 text-primary" />
                        <span>{t("inviteClientAction")}</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  {t("actions.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (mode === "organization" && !selectedOrgId) ||
                    (mode === "direct_contact" && !selectedContactId)
                  }
                >
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("actions.save")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Destructive Transition Confirmation Dialog */}
      <AlertDialog
        open={isConfirmOpen}
        onOpenChange={(open) => !open && setIsConfirmOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-amber-600" />
              <span>{t("confirmTransitionTitle")}</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              {t("confirmTransitionDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              {t("actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={() => {
                setIsConfirmOpen(false);
                executeMutationSequence();
              }}
            >
              {t("confirmTransitionAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Constrained Invitation Creation Dialog */}
      {directClientMode && (
        <InvitationCreateDialog
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
          directClientMode={directClientMode}
          onSuccess={(url) => {
            setInvitationUrl(url);
            setIsCopyOpen(true);
          }}
        />
      )}

      {/* One-Time Link Copy Dialog */}
      <InvitationCopyDialog
        isOpen={isCopyOpen}
        onDismiss={() => {
          setInvitationUrl(null);
          setIsCopyOpen(false);
          startTransition(() => {
            router.refresh();
          });
        }}
        invitationUrl={invitationUrl}
      />
    </>
  );
}
