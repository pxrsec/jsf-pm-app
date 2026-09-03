"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveClientContactAction } from "@/lib/clients/actions";
import type {
  ClientContactAdministrationDto,
  ClientOrganizationAdministrationDto,
} from "@/lib/clients/types";
import { Loader2 } from "lucide-react";

const DIRECT_CLIENT_VALUE = "__direct__";

interface ContactDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organizations: ClientOrganizationAdministrationDto[];
  contactToEdit?: ClientContactAdministrationDto | null;
}

interface ContactFormProps {
  onClose: () => void;
  onSuccess: () => void;
  organizations: ClientOrganizationAdministrationDto[];
  contactToEdit?: ClientContactAdministrationDto | null;
}

function ContactForm({
  onClose,
  onSuccess,
  organizations,
  contactToEdit,
}: ContactFormProps) {
  const t = useTranslations("clientAdministration.contactDialog");
  const isEditing = Boolean(contactToEdit);

  const [fullName, setFullName] = useState(contactToEdit?.fullName ?? "");
  const [email, setEmail] = useState(contactToEdit?.email ?? "");
  const [phoneE164, setPhoneE164] = useState(contactToEdit?.phoneE164 ?? "");
  const [jobTitle, setJobTitle] = useState(contactToEdit?.jobTitle ?? "");
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    contactToEdit?.clientId ?? DIRECT_CLIENT_VALUE,
  );
  const [isPrimary, setIsPrimary] = useState(contactToEdit?.isPrimary ?? false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDirect = selectedOrgId === DIRECT_CLIENT_VALUE;

  const handleOrgChange = (val: string) => {
    setSelectedOrgId(val);
    if (val === DIRECT_CLIENT_VALUE) {
      setIsPrimary(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phoneE164.trim() || null;
    const trimmedJob = jobTitle.trim() || null;
    const clientId = isDirect ? null : selectedOrgId;

    if (!trimmedName) {
      setErrorMessage(t("errors.fullNameRequired"));
      return;
    }
    if (!trimmedEmail) {
      setErrorMessage(t("errors.emailRequired"));
      return;
    }
    if (trimmedPhone && !/^\+[1-9][0-9]{7,14}$/.test(trimmedPhone)) {
      setErrorMessage(t("errors.invalidPhone"));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await saveClientContactAction({
        contactId: contactToEdit?.id ?? null,
        fullName: trimmedName,
        email: trimmedEmail,
        phoneE164: trimmedPhone,
        jobTitle: trimmedJob,
        clientId,
        isPrimary: isDirect ? false : isPrimary,
      });

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

      onSuccess();
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
        <Label htmlFor="contact-full-name">{t("fields.fullName")}</Label>
        <Input
          id="contact-full-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={t("placeholders.fullName")}
          disabled={isSubmitting}
          maxLength={120}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-email">{t("fields.email")}</Label>
        <Input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("placeholders.email")}
          disabled={isSubmitting}
          maxLength={320}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-org">{t("fields.organization")}</Label>
        <Select
          value={selectedOrgId}
          onValueChange={(val) => {
            if (val) handleOrgChange(val);
          }}
          disabled={isSubmitting}
          items={[
            { value: DIRECT_CLIENT_VALUE, label: t("directContactOption") },
            ...organizations.map((org) => ({
              value: org.id,
              label: org.displayName,
            })),
          ]}
        >
          <SelectTrigger id="contact-org" className="h-9 w-full">
            <SelectValue placeholder={t("placeholders.organization")} />
          </SelectTrigger>
          <SelectContent className="w-[var(--anchor-width)] min-w-[280px]">
            <SelectItem value={DIRECT_CLIENT_VALUE}>
              {t("directContactOption")}
            </SelectItem>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="contact-job-title">{t("fields.jobTitle")}</Label>
          <Input
            id="contact-job-title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder={t("placeholders.jobTitle")}
            disabled={isSubmitting}
            maxLength={120}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-phone">{t("fields.phone")}</Label>
          <Input
            id="contact-phone"
            value={phoneE164}
            onChange={(e) => setPhoneE164(e.target.value)}
            placeholder="+525512345678"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {!isDirect && (
        <div className="flex items-center space-x-2 pt-1">
          <Checkbox
            id="contact-is-primary"
            checked={isPrimary}
            onCheckedChange={(checked) => setIsPrimary(Boolean(checked))}
            disabled={isSubmitting}
          />
          <Label
            htmlFor="contact-is-primary"
            className="text-xs font-normal cursor-pointer text-muted-foreground"
          >
            {t("fields.isPrimary")}
          </Label>
        </div>
      )}

      {isDirect && (
        <p className="text-xs text-muted-foreground italic">
          {t("directContactNotice")}
        </p>
      )}

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
        >
          {t("actions.cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? t("actions.save") : t("actions.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ContactDialog({
  isOpen,
  onClose,
  onSuccess,
  organizations,
  contactToEdit,
}: ContactDialogProps) {
  const t = useTranslations("clientAdministration.contactDialog");
  const isEditing = Boolean(contactToEdit);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("editTitle") : t("createTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t("editDescription") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>

        {isOpen && (
          <ContactForm
            key={contactToEdit?.id ?? "new"}
            onClose={onClose}
            onSuccess={onSuccess}
            organizations={organizations}
            contactToEdit={contactToEdit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
