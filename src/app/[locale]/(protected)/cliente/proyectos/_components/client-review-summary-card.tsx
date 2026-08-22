import { Link } from "@/i18n/routing";
import type { ClientProductionReviewQueueItem } from "@/lib/client/types";
import { DELIVERABLE_STATUS_MAP } from "@/lib/status-maps";
import { FileCheck2, ArrowRight } from "lucide-react";

interface ClientReviewSummaryCardProps {
  review: ClientProductionReviewQueueItem;
  translations?: {
    versionLabel?: string;
    deadline?: string;
    noDeadline?: string;
    openReview?: string;
    openReviewAria?: string;
    statusLabel?: string;
    untitledDeliverable?: string;
  };
}

export function ClientReviewSummaryCard({
  review,
  translations,
}: ClientReviewSummaryCardProps) {
  const statusConfig =
    DELIVERABLE_STATUS_MAP[review.status] ??
    DELIVERABLE_STATUS_MAP.awaiting_client_review;

  const versionText =
    typeof review.current_version_number === "number" &&
    review.current_version_number > 0
      ? `v${review.current_version_number}`
      : null;

  const versionLabel = translations?.versionLabel ?? "Versión";
  const deadlineLabel = translations?.deadline ?? "Fecha límite";
  const noDeadlineLabel = translations?.noDeadline ?? "Sin fecha límite";
  const openReviewLabel = translations?.openReview ?? "Revisar entregable";
  const untitledDeliverable = translations?.untitledDeliverable ?? "";
  const openReviewAriaLabel =
    translations?.openReviewAria ??
    (review.title ? `Revisar entregable ${review.title}` : openReviewLabel);
  const statusLabel = translations?.statusLabel ?? statusConfig.labelKey;

  return (
    <article
      aria-labelledby={`review-summary-title-${review.id}`}
      className="rounded-xl border border-border bg-card p-5 shadow-sm text-card-foreground flex flex-col justify-between"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileCheck2
              className="h-4 w-4 text-primary shrink-0"
              aria-hidden="true"
            />
            <h4
              id={`review-summary-title-${review.id}`}
              className="font-semibold text-foreground text-sm line-clamp-1"
            >
              {review.title ?? untitledDeliverable}
            </h4>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${statusConfig.badgeBg} ${statusConfig.badgeFg}`}
          >
            <statusConfig.icon className="h-3 w-3" aria-hidden="true" />
            {statusLabel}
          </span>
        </div>

        {versionText && (
          <div className="text-xs font-medium text-foreground">
            <span className="text-muted-foreground">{versionLabel}:</span>{" "}
            {versionText}
          </div>
        )}

        {review.specifications && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-2">
            {review.specifications}
          </p>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
        {review.client_delivery_deadline_at ? (
          <span className="text-xs text-muted-foreground">
            {deadlineLabel}:{" "}
            {new Date(review.client_delivery_deadline_at).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {noDeadlineLabel}
          </span>
        )}

        <Link
          href={`/cliente/entregables/${review.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
          aria-label={openReviewAriaLabel}
        >
          <span>{openReviewLabel}</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
