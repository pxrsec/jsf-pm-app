"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createOrdinaryInvitationAction } from "@/lib/invitations/actions";
import type {
  InvitationLinkLocale,
  OrdinaryInvitationRole,
} from "@/lib/invitations/types";
import type {
  ClientContactAdministrationDto,
  ClientManagementProjectDto,
} from "@/lib/clients/types";
import { Loader2 } from "lucide-react";

const NO_PROJECT_VALUE = "__none__";

export type DirectClientProjectInviteMode = {
  contactId: string;
  contactName: string;
  projectId: string;
};

interface InvitationCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (invitationUrl: string) => void;
  contacts?: ClientContactAdministrationDto[];
  projects?: ClientManagementProjectDto[];
  directClientMode?: DirectClientProjectInviteMode;
}

interface InvitationCreateFormProps {
  onClose: () => void;
  onSuccess: (invitationUrl: string) => void;
  contacts: ClientContactAdministrationDto[];
  projects: ClientManagementProjectDto[];
  directClientMode?: DirectClientProjectInviteMode;
}

function InvitationCreateForm({
  onClose,
  onSuccess,
  contacts,
  projects,
  directClientMode,
}: InvitationCreateFormProps) {
  const t = useTranslations("clientAdministration.createInviteDialog");
  const locale = useLocale() as InvitationLinkLocale;

  // Eligible contacts for invitation: contacts without a linked profile
  const unlinkedContacts = contacts.filter((c) => c.profileId === null);

  const [role, setRole] = useState<OrdinaryInvitationRole>(
    directClientMode ? "client" : "client",
  );
  const [selectedContactId, setSelectedContactId] = useState<string>(
    directClientMode
      ? directClientMode.contactId
      : (unlinkedContacts[0]?.id ?? ""),
  );
  const [operatorEmail, setOperatorEmail] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    directClientMode ? directClientMode.projectId : NO_PROJECT_VALUE,
  );
  const [expiresInHours, setExpiresInHours] = useState<number>(168);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const effectiveRole = directClientMode ? "client" : role;
    const effectiveContactId = directClientMode
      ? directClientMode.contactId
      : selectedContactId;
    const effectiveProjectId = directClientMode
      ? directClientMode.projectId
      : selectedProjectId === NO_PROJECT_VALUE
        ? null
        : selectedProjectId;

    if (effectiveRole === "client") {
      if (!effectiveContactId) {
        setErrorMessage(t("errors.contactRequired"));
        return;
      }
    } else {
      const trimmedEmail = operatorEmail.trim();
      if (!trimmedEmail) {
        setErrorMessage(t("errors.emailRequired"));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload =
        effectiveRole === "client"
          ? {
              role: "client" as const,
              contactId: effectiveContactId,
              projectId: effectiveProjectId,
              expiresInHours,
            }
          : {
              role: "operator" as const,
              recipientEmail: operatorEmail.trim(),
              projectId: effectiveProjectId,
              expiresInHours,
            };

      const result = await createOrdinaryInvitationAction(
        payload,
        locale === "en-US" ? "en-US" : "es-MX",
      );

      if (!result.ok) {
        if (result.code === "UNAUTHORIZED") {
          setErrorMessage(t("errors.unauthorized"));
        } else if (result.code === "VALIDATION_FAILED") {
          setErrorMessage(t("errors.validationFailed"));
        } else {
          setErrorMessage(t("errors.unavailable"));
        }
        return;
      }

      onSuccess(result.data.invitationUrl);
      onClose();
    } catch {
      setErrorMessage(t("errors.unavailable"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {errorMessage && (
        <div
          role="alert"
          className="p-3 text-xs rounded-md bg-destructive/10 text-destructive border border-destructive/20"
        >
          {errorMessage}
        </div>
      )}

      {directClientMode ? (
        <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/30 p-3">
          <Label className="text-xs text-muted-foreground">
            {t("fields.contact")}
          </Label>
          <p className="text-sm font-semibold text-foreground">
            {directClientMode.contactName}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">{t("fields.role")}</Label>
            <Select
              value={role}
              onValueChange={(val) => {
                if (val) {
                  setRole(val as OrdinaryInvitationRole);
                  setErrorMessage(null);
                }
              }}
              disabled={isSubmitting}
              items={[
                { value: "client", label: t("roles.client") },
                { value: "operator", label: t("roles.operator") },
              ]}
            >
              <SelectTrigger id="invite-role" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-[var(--anchor-width)] min-w-[280px]">
                <SelectItem value="client">{t("roles.client")}</SelectItem>
                <SelectItem value="operator">{t("roles.operator")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role === "client" ? (
            <div className="space-y-1.5">
              <Label htmlFor="invite-contact">{t("fields.contact")}</Label>
              <Select
                value={selectedContactId}
                onValueChange={(val) => {
                  if (val) setSelectedContactId(val);
                }}
                disabled={isSubmitting || unlinkedContacts.length === 0}
                items={unlinkedContacts.map((c) => ({
                  value: c.id,
                  label: `${c.fullName} (${c.email})`,
                }))}
              >
                <SelectTrigger id="invite-contact" className="h-9 w-full">
                  <SelectValue
                    placeholder={
                      unlinkedContacts.length === 0
                        ? t("noUnlinkedContacts")
                        : t("placeholders.contact")
                    }
                  />
                </SelectTrigger>
                <SelectContent className="w-[var(--anchor-width)] min-w-[280px]">
                  {unlinkedContacts.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground text-center">
                      {t("noUnlinkedContacts")}
                    </div>
                  ) : (
                    unlinkedContacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.fullName} ({c.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {unlinkedContacts.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("allContactsLinkedHint")}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="invite-operator-email">
                {t("fields.recipientEmail")}
              </Label>
              <Input
                id="invite-operator-email"
                type="email"
                value={operatorEmail}
                onChange={(e) => setOperatorEmail(e.target.value)}
                placeholder={t("placeholders.email")}
                disabled={isSubmitting}
                maxLength={320}
                className="h-9"
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="invite-project">{t("fields.project")}</Label>
            <Select
              value={selectedProjectId}
              onValueChange={(val) => {
                if (val) setSelectedProjectId(val);
              }}
              disabled={isSubmitting}
              items={[
                { value: NO_PROJECT_VALUE, label: t("noProjectOption") },
                ...projects.map((p) => ({
                  value: p.id,
                  label: p.name,
                })),
              ]}
            >
              <SelectTrigger id="invite-project" className="h-9 w-full">
                <SelectValue placeholder={t("placeholders.project")} />
              </SelectTrigger>
              <SelectContent className="w-[var(--anchor-width)] min-w-[280px]">
                <SelectItem value={NO_PROJECT_VALUE}>
                  {t("noProjectOption")}
                </SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="invite-lifetime">{t("fields.lifetime")}</Label>
        <Select
          value={String(expiresInHours)}
          onValueChange={(val) => {
            if (val) setExpiresInHours(Number(val));
          }}
          disabled={isSubmitting}
          items={[
            { value: "24", label: t("lifetimes.hours24") },
            { value: "72", label: t("lifetimes.hours72") },
            { value: "168", label: t("lifetimes.days7") },
            { value: "336", label: t("lifetimes.days14") },
            { value: "720", label: t("lifetimes.days30") },
          ]}
        >
          <SelectTrigger id="invite-lifetime" className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-[var(--anchor-width)] min-w-[280px]">
            <SelectItem value="24">{t("lifetimes.hours24")}</SelectItem>
            <SelectItem value="72">{t("lifetimes.hours72")}</SelectItem>
            <SelectItem value="168">{t("lifetimes.days7")}</SelectItem>
            <SelectItem value="336">{t("lifetimes.days14")}</SelectItem>
            <SelectItem value="720">{t("lifetimes.days30")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
        >
          {t("actions.cancel")}
        </Button>
        <Button
          type="submit"
          disabled={
            isSubmitting ||
            (!directClientMode &&
              role === "client" &&
              unlinkedContacts.length === 0)
          }
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("actions.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function InvitationCreateDialog({
  isOpen,
  onClose,
  onSuccess,
  contacts = [],
  projects = [],
  directClientMode,
}: InvitationCreateDialogProps) {
  const t = useTranslations("clientAdministration.createInviteDialog");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {isOpen && (
          <InvitationCreateForm
            onClose={onClose}
            onSuccess={onSuccess}
            contacts={contacts}
            projects={projects}
            directClientMode={directClientMode}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
