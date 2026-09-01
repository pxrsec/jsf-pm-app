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

interface InvitationCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (invitationUrl: string) => void;
  contacts: ClientContactAdministrationDto[];
  projects: ClientManagementProjectDto[];
}

interface InvitationCreateFormProps {
  onClose: () => void;
  onSuccess: (invitationUrl: string) => void;
  contacts: ClientContactAdministrationDto[];
  projects: ClientManagementProjectDto[];
}

function InvitationCreateForm({
  onClose,
  onSuccess,
  contacts,
  projects,
}: InvitationCreateFormProps) {
  const t = useTranslations("clientAdministration.createInviteDialog");
  const locale = useLocale() as InvitationLinkLocale;

  // Eligible contacts for invitation: contacts without a linked profile
  const unlinkedContacts = contacts.filter((c) => c.profileId === null);

  const [role, setRole] = useState<OrdinaryInvitationRole>("client");
  const [selectedContactId, setSelectedContactId] = useState<string>(
    unlinkedContacts[0]?.id ?? "",
  );
  const [operatorEmail, setOperatorEmail] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] =
    useState<string>(NO_PROJECT_VALUE);
  const [expiresInHours, setExpiresInHours] = useState<number>(168);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const projectId =
      selectedProjectId === NO_PROJECT_VALUE ? null : selectedProjectId;

    if (role === "client") {
      if (!selectedContactId) {
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
        role === "client"
          ? {
              role: "client" as const,
              contactId: selectedContactId,
              projectId,
              expiresInHours,
            }
          : {
              role: "operator" as const,
              recipientEmail: operatorEmail.trim(),
              projectId,
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

      <div className="space-y-1.5">
        <Label htmlFor="invite-lifetime">{t("fields.lifetime")}</Label>
        <Select
          value={String(expiresInHours)}
          onValueChange={(val) => {
            if (val) setExpiresInHours(Number(val));
          }}
          disabled={isSubmitting}
          items={[
            { value: "24", label: t("lifetimes.24h") },
            { value: "72", label: t("lifetimes.72h") },
            { value: "168", label: t("lifetimes.7d") },
            { value: "336", label: t("lifetimes.14d") },
            { value: "720", label: t("lifetimes.30d") },
          ]}
        >
          <SelectTrigger id="invite-lifetime" className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-[var(--anchor-width)] min-w-[280px]">
            <SelectItem value="24">{t("lifetimes.24h")}</SelectItem>
            <SelectItem value="72">{t("lifetimes.72h")}</SelectItem>
            <SelectItem value="168">{t("lifetimes.7d")}</SelectItem>
            <SelectItem value="336">{t("lifetimes.14d")}</SelectItem>
            <SelectItem value="720">{t("lifetimes.30d")}</SelectItem>
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
            isSubmitting || (role === "client" && unlinkedContacts.length === 0)
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
  contacts,
  projects,
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
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
