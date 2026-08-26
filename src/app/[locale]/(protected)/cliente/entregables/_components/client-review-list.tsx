import { getTranslations } from "next-intl/server";
import type { ClientProductionReviewQueueItem } from "@/lib/client/types";
import { DELIVERABLE_STATUS_TRANSLATION_KEYS } from "@/lib/status-maps";
import { FileCheck2, Clock, CheckCircle2 } from "lucide-react";
import { ClientReviewSummaryCard } from "../../proyectos/_components/client-review-summary-card";

interface ClientReviewListProps {
  reviews: ClientProductionReviewQueueItem[];
}

export async function ClientReviewList({ reviews }: ClientReviewListProps) {
  const t = await getTranslations("projects.clientReviews");

  const awaitingReviews = reviews.filter(
    (r) => r.status === "awaiting_client_review",
  );
  const recentOutcomes = reviews.filter(
    (r) => r.status !== "awaiting_client_review",
  );

  const reviewTranslations = {
    versionLabel: t("versionLabel"),
    deadline: t("deadline"),
    noDeadline: t("noDeadline"),
    openReview: t("openReview"),
    untitledDeliverable: t("untitledDeliverable"),
  };

  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center bg-card/50">
        <FileCheck2 className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
        <h2 className="text-base font-semibold text-foreground">
          {t("empty.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
          {t("empty.description")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* 1. Awaiting Your Review Section */}
      <section aria-labelledby="awaiting-review-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2
            id="awaiting-review-heading"
            className="text-lg font-semibold text-foreground"
          >
            {t("awaitingSection.title")}
          </h2>
          <span className="text-xs text-muted-foreground">
            ({awaitingReviews.length})
          </span>
        </div>

        {awaitingReviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center bg-card/50">
            <p className="text-sm text-muted-foreground">
              {t("awaitingSection.empty")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {awaitingReviews.map((rev) => {
              const statusKey =
                DELIVERABLE_STATUS_TRANSLATION_KEYS[rev.status] ??
                "awaitingClientReview";
              return (
                <ClientReviewSummaryCard
                  key={rev.id}
                  review={rev}
                  translations={{
                    ...reviewTranslations,
                    statusLabel: t(`status.${statusKey}`),
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Recent Review Outcomes Section */}
      {recentOutcomes.length > 0 && (
        <section
          aria-labelledby="recent-outcomes-heading"
          className="space-y-4"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2
              className="h-5 w-5 text-muted-foreground"
              aria-hidden="true"
            />
            <h2
              id="recent-outcomes-heading"
              className="text-lg font-semibold text-foreground"
            >
              {t("recentOutcomesSection.title")}
            </h2>
            <span className="text-xs text-muted-foreground">
              ({recentOutcomes.length})
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentOutcomes.map((rev) => {
              const statusKey =
                DELIVERABLE_STATUS_TRANSLATION_KEYS[rev.status] ??
                "awaitingClientReview";
              return (
                <ClientReviewSummaryCard
                  key={rev.id}
                  review={rev}
                  translations={{
                    ...reviewTranslations,
                    statusLabel: t(`status.${statusKey}`),
                  }}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
