"use client";

import { useTranslations, useFormatter } from "next-intl";
import { ExternalLink, Flag, HardDrive, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormalFeedbackHistory } from "./formal-feedback-history";
import type {
  DeliverableVersionView,
  DeliverableFeedbackView,
} from "@/lib/deliverables/queries";

interface DeliverableHistoryProps {
  versions: DeliverableVersionView[];
  feedback: DeliverableFeedbackView[];
  onReportLink: (version: DeliverableVersionView) => void;
}

export function DeliverableHistory({
  versions,
  feedback,
  onReportLink,
}: DeliverableHistoryProps) {
  const t = useTranslations("projects.workspace.deliverables");
  const format = useFormatter();

  if (versions.length === 0) {
    return (
      <div className="text-center py-8 px-4 rounded-lg border border-dashed border-border/80 bg-muted/20 text-muted-foreground text-xs space-y-1">
        <History className="size-5 mx-auto text-muted-foreground/60 mb-2" />
        <p className="font-medium text-foreground/80">
          {t("detailSheet.noHistory")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <History className="size-4 text-primary" />
        <span>{t("detailSheet.historyTitle")}</span>
      </div>

      <div className="space-y-4">
        {versions.map((version) => {
          const matchingFeedback = feedback.filter(
            (f) => f.version_id === version.id,
          );

          const formattedDate = format.dateTime(new Date(version.submitted_at), {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          const submitterName =
            version.submitter?.full_name || "Miembro del equipo";
          const submitterInitials = submitterName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          return (
            <div
              key={version.id}
              className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs"
            >
              {/* Version Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="font-mono text-xs px-2 py-0.5 font-bold bg-primary/10 text-primary border-primary/20"
                  >
                    v{version.version_number}
                  </Badge>

                  <div className="flex items-center gap-1.5">
                    <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[9px] shrink-0">
                      {submitterInitials}
                    </div>
                    <span className="text-xs font-medium text-foreground">
                      {submitterName}
                    </span>
                  </div>

                  <span className="text-[11px] text-muted-foreground">
                    {formattedDate}
                  </span>
                </div>

                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 text-muted-foreground w-fit"
                >
                  <HardDrive className="size-3" />
                  <span>Google Drive</span>
                </Badge>
              </div>

              {/* Submission Note */}
              {version.submission_note && (
                <p className="text-xs text-foreground/90 whitespace-pre-wrap bg-muted/30 p-2.5 rounded-md border border-border/40">
                  {version.submission_note}
                </p>
              )}

              {/* Action Link & Report Trigger */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <a
                  href={version.submission_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline group"
                >
                  <span>{t("detailSheet.openExternalLink")}</span>
                  <ExternalLink className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onReportLink(version)}
                  className="h-7 text-[11px] text-muted-foreground hover:text-destructive gap-1 px-2"
                >
                  <Flag className="size-3" />
                  <span>{t("detailSheet.reportLinkAction")}</span>
                </Button>
              </div>

              {/* Version-Scoped Formal Feedback */}
              {matchingFeedback.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/60">
                  <FormalFeedbackHistory feedback={matchingFeedback} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
