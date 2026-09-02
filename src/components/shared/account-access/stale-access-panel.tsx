"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { AlertCircle, RefreshCw, Info, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { recordStaleAccessReminderAction } from "@/lib/account-access/actions";
import type {
  AvailableResult,
  StaleAccessCandidateDto,
  DateTimePresentationContext,
} from "@/lib/account-access/types";

export interface StaleAccessPanelProps {
  initialResult: AvailableResult<readonly StaleAccessCandidateDto[]>;
  presentation: DateTimePresentationContext;
}

function formatDate(
  isoString: string,
  presentation: DateTimePresentationContext,
): string {
  try {
    return new Intl.DateTimeFormat(presentation.locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: presentation.timeZone || "UTC",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export function StaleAccessPanel({
  initialResult,
  presentation,
}: StaleAccessPanelProps) {
  const t = useTranslations("accountAccess");
  const router = useRouter();

  const [candidates, setCandidates] = useState<
    readonly StaleAccessCandidateDto[]
  >(initialResult.status === "available" ? initialResult.data : []);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (initialResult.status === "unavailable") {
    return (
      <div
        className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 max-w-xl space-y-4"
        role="alert"
        data-testid="stale-access-unavailable"
      >
        <div className="flex items-center gap-2 text-destructive font-medium">
          <AlertCircle className="size-5" />
          <span>{t("staleAccess.unavailableTitle")}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("staleAccess.unavailableDescription")}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.refresh()}
          className="min-h-[44px] gap-2"
        >
          <RefreshCw className="size-4" />
          <span>{t("staleAccess.retryButton")}</span>
        </Button>
      </div>
    );
  }

  const handleRecordReminder = (userId: string) => {
    if (pendingUserId !== null) return;
    setPendingUserId(userId);

    startTransition(async () => {
      try {
        const result = await recordStaleAccessReminderAction({
          targetUserId: userId,
        });

        if (result.ok) {
          setCandidates((curr) => curr.filter((c) => c.userId !== userId));
          toast.success(t("staleAccess.successToast"));
          router.refresh();
        } else if (result.error.code === "not_eligible_or_already_recorded") {
          setCandidates((curr) => curr.filter((c) => c.userId !== userId));
          toast.info(t("staleAccess.notEligibleToast"));
          router.refresh();
        } else {
          toast.error(t("commonErrors.unavailable"));
        }
      } finally {
        setPendingUserId(null);
      }
    });
  };

  return (
    <div className="space-y-6" data-testid="stale-access-panel">
      {/* Internal-only notice banner */}
      <div
        role="note"
        className="flex gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-4 text-blue-900 dark:text-blue-200 text-sm"
      >
        <Info className="size-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
        <p>{t("staleAccess.internalNotice")}</p>
      </div>

      {candidates.length === 0 ? (
        <div
          className="rounded-lg border border-dashed p-8 text-center space-y-2"
          data-testid="stale-access-empty"
        >
          <p className="font-medium text-foreground">
            {t("staleAccess.emptyTitle")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("staleAccess.emptyDescription")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.map((candidate) => {
            const isRowPending = pendingUserId === candidate.userId;
            const formattedStartedAt = formatDate(
              candidate.inactivityPeriodStartedAt,
              presentation,
            );

            return (
              <div
                key={candidate.userId}
                className="rounded-lg border p-4 space-y-4 bg-card text-card-foreground shadow-xs flex flex-col justify-between"
                data-testid={`stale-candidate-${candidate.userId}`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-base leading-tight">
                      {candidate.fullName}
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {t(`roles.${candidate.applicationRole}`)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {t("staleAccess.periodStartedAtLabel")}:
                    </span>{" "}
                    {formattedStartedAt}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/50">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRowPending}
                    onClick={() => handleRecordReminder(candidate.userId)}
                    className="min-h-[44px] w-full gap-2"
                    aria-label={`${t("staleAccess.recordReminderButton")}: ${candidate.fullName}`}
                  >
                    {isRowPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>{t("staleAccess.recordingButton")}</span>
                      </>
                    ) : (
                      <>
                        <BellRing className="size-4" />
                        <span>{t("staleAccess.recordReminderButton")}</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
