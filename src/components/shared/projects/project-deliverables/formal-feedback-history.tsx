"use client";

import { useTranslations, useFormatter } from "next-intl";
import { ShieldCheck, RotateCcw, MessageSquareQuote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DeliverableFeedbackView } from "@/lib/deliverables/queries";

interface FormalFeedbackHistoryProps {
  feedback: DeliverableFeedbackView[];
}

export function FormalFeedbackHistory({ feedback }: FormalFeedbackHistoryProps) {
  const t = useTranslations("projects.workspace.deliverables");
  const format = useFormatter();

  if (!feedback || feedback.length === 0) return null;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
        <MessageSquareQuote className="size-3.5 text-primary" />
        <span>{t("detailSheet.reviewHistoryRecord")}</span>
      </div>

      <div className="space-y-2.5">
        {feedback.map((item) => {
          const isApproved = item.decision === "approved";
          const formattedDate = format.dateTime(new Date(item.reviewed_at), {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          const reviewerName = item.reviewer?.full_name || "PM Lead";
          const reviewerInitials = reviewerName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          return (
            <div
              key={item.id}
              className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[9px] shrink-0">
                    {reviewerInitials}
                  </div>
                  <span className="font-medium text-foreground">
                    {reviewerName}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formattedDate}
                  </span>
                </div>

                <Badge
                  variant="outline"
                  className={
                    isApproved
                      ? "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20 text-[10px] gap-1 font-medium"
                      : "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20 text-[10px] gap-1 font-medium"
                  }
                >
                  {isApproved ? (
                    <ShieldCheck className="size-3" />
                  ) : (
                    <RotateCcw className="size-3" />
                  )}
                  <span>
                    {isApproved
                      ? t("status.approved")
                      : t("status.changesRequested")}
                  </span>
                </Badge>
              </div>

              {item.comments && (
                <p className="text-muted-foreground text-xs whitespace-pre-wrap pl-7">
                  {item.comments}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
