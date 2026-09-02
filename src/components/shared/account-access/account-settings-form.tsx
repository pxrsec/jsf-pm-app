"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateOwnAccountSettingsAction } from "@/lib/account-access/actions";
import type {
  OwnAccountSettingsDto,
  PreferredLocale,
} from "@/lib/account-access/types";

const COMMON_TIMEZONES: readonly string[] = [
  "America/Mexico_City",
  "America/Monterrey",
  "America/Tijuana",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Bogota",
  "America/Buenos_Aires",
  "America/Santiago",
  "America/Lima",
  "Europe/Madrid",
  "UTC",
];

export interface AccountSettingsFormProps {
  initialSettings: OwnAccountSettingsDto;
}

export function AccountSettingsForm({
  initialSettings,
}: AccountSettingsFormProps) {
  const t = useTranslations("accountAccess");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [fullName, setFullName] = useState(initialSettings.fullName);
  const [preferredLocale, setPreferredLocale] = useState<PreferredLocale>(
    initialSettings.preferredLocale,
  );
  const [timezone, setTimezone] = useState(initialSettings.timezone);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(
    initialSettings.emailNotificationsEnabled,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isFullNameValid = fullName.trim().length >= 1 && fullName.length <= 120;
  const isTimezoneValid = timezone.trim().length >= 1 && timezone.length <= 100;
  const isFormValid = isFullNameValid && isTimezoneValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isPending) return;

    setErrorMessage(null);
    setStatusMessage(null);

    startTransition(async () => {
      const result = await updateOwnAccountSettingsAction({
        fullName: fullName.trim(),
        preferredLocale,
        timezone: timezone.trim(),
        emailNotificationsEnabled,
      });

      if (result.ok) {
        setFullName(result.data.fullName);
        setPreferredLocale(result.data.preferredLocale);
        setTimezone(result.data.timezone);
        setEmailNotificationsEnabled(result.data.emailNotificationsEnabled);

        const successText = t("accountSettings.successToast");
        setStatusMessage(successText);
        toast.success(successText);
        router.refresh();
      } else {
        let errText = t("accountSettings.errorToast");
        if (result.error.code === "VALIDATION_FAILED") {
          errText = t("accountSettings.validationError");
        } else if (result.error.code === "UNAUTHORIZED") {
          errText = t("commonErrors.unauthorized");
        }
        setErrorMessage(errText);
        toast.error(errText);
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 max-w-xl"
      noValidate
      data-testid="account-settings-form"
    >
      {/* Read-only Role Badge */}
      <div className="space-y-2">
        <Label htmlFor="account-role">{t("accountSettings.roleLabel")}</Label>
        <div id="account-role" className="pt-1">
          <Badge variant="outline" className="text-sm font-medium px-3 py-1">
            {t(`roles.${initialSettings.role}`)}
          </Badge>
        </div>
      </div>

      {/* Full Name */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="account-full-name">
            {t("accountSettings.fullNameLabel")}
          </Label>
          <span className="text-xs text-muted-foreground">
            {fullName.length} / 120
          </span>
        </div>
        <Input
          id="account-full-name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={120}
          aria-invalid={!isFullNameValid}
          aria-describedby="account-full-name-help"
          placeholder={t("accountSettings.fullNamePlaceholder")}
          required
          disabled={isPending}
        />
        {!isFullNameValid && fullName.length > 0 && (
          <p id="account-full-name-help" className="text-xs text-destructive">
            {t("accountSettings.validationError")}
          </p>
        )}
      </div>

      {/* Preferred Locale */}
      <div className="space-y-2">
        <Label htmlFor="account-preferred-locale">
          {t("accountSettings.localeLabel")}
        </Label>
        <Select
          value={preferredLocale}
          onValueChange={(val) => setPreferredLocale(val as PreferredLocale)}
          disabled={isPending}
        >
          <SelectTrigger id="account-preferred-locale" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="es-MX">Español (México)</SelectItem>
            <SelectItem value="en-US">English (United States)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Timezone Text Input with Datalist */}
      <div className="space-y-2">
        <Label htmlFor="account-timezone">
          {t("accountSettings.timezoneLabel")}
        </Label>
        <Input
          id="account-timezone"
          type="text"
          list="iana-timezones"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          maxLength={100}
          aria-invalid={!isTimezoneValid}
          aria-describedby="account-timezone-help"
          placeholder={t("accountSettings.timezonePlaceholder")}
          required
          disabled={isPending}
        />
        <datalist id="iana-timezones">
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz} />
          ))}
        </datalist>
        <p id="account-timezone-help" className="text-xs text-muted-foreground">
          {t("accountSettings.timezoneHelp")}
        </p>
      </div>

      {/* Email Notifications Switch */}
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label
            htmlFor="account-email-notifications"
            className="text-base cursor-pointer"
          >
            {t("accountSettings.emailNotifLabel")}
          </Label>
          <p
            id="account-email-notif-desc"
            className="text-sm text-muted-foreground"
          >
            {t("accountSettings.emailNotifDescription")}
          </p>
        </div>
        <Switch
          id="account-email-notifications"
          checked={emailNotificationsEnabled}
          onCheckedChange={setEmailNotificationsEnabled}
          disabled={isPending}
          aria-describedby="account-email-notif-desc"
        />
      </div>

      {/* Status Region */}
      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md bg-muted p-3 text-sm text-foreground"
        >
          {statusMessage}
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      )}

      {/* Submit Button */}
      <div>
        <Button
          type="submit"
          disabled={!isFormValid || isPending}
          className="min-h-[44px] w-full sm:w-auto"
        >
          {isPending
            ? t("accountSettings.savingButton")
            : t("accountSettings.saveButton")}
        </Button>
      </div>
    </form>
  );
}
