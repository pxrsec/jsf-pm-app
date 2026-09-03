"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AccountSettingsForm } from "./account-settings-form";
import { BugReportForm } from "./bug-report-form";
import type {
  AvailableResult,
  OwnAccountSettingsDto,
  DateTimePresentationContext,
} from "@/lib/account-access/types";

export interface AccountViewProps {
  initialSettings: AvailableResult<OwnAccountSettingsDto>;
  presentation: DateTimePresentationContext;
}

export function AccountView({ initialSettings }: AccountViewProps) {
  const t = useTranslations("accountAccess");
  const router = useRouter();

  return (
    <div className="space-y-10 max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("accountSettings.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("accountSettings.description")}
        </p>
      </div>

      <Separator />

      {/* Account Settings Section */}
      <section aria-labelledby="account-settings-heading" className="space-y-6">
        <h2 id="account-settings-heading" className="sr-only">
          {t("accountSettings.title")}
        </h2>

        {initialSettings.status === "available" ? (
          <AccountSettingsForm initialSettings={initialSettings.data} />
        ) : (
          <div
            className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 max-w-xl space-y-4"
            role="alert"
            data-testid="account-settings-unavailable"
          >
            <div className="flex items-center gap-2 text-destructive font-medium">
              <AlertCircle className="size-5" />
              <span>{t("accountSettings.unavailableTitle")}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("accountSettings.unavailableDescription")}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.refresh()}
              className="min-h-[44px] gap-2"
            >
              <RefreshCw className="size-4" />
              <span>{t("accountSettings.retryButton")}</span>
            </Button>
          </div>
        )}
      </section>

      <Separator />

      {/* Bug Report Section (Always available) */}
      <section aria-labelledby="bug-report-heading" className="space-y-6">
        <div className="space-y-1">
          <h2
            id="bug-report-heading"
            className="text-xl font-semibold tracking-tight"
          >
            {t("bugReportForm.formTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("bugReportForm.formDescription")}
          </p>
        </div>

        <BugReportForm />
      </section>
    </div>
  );
}
