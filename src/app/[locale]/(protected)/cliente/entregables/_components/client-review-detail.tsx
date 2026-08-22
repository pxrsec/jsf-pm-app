import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { ClientProductionReviewDetail } from "@/lib/client/types";
import { DELIVERABLE_STATUS_MAP } from "@/lib/status-maps";
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  FileCheck2,
  FolderKanban,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { ClientReviewActions } from "./client-review-actions";

interface ClientReviewDetailViewProps {
  deliverable: ClientProductionReviewDetail;
}

export async function ClientReviewDetailView({
  deliverable,
}: ClientReviewDetailViewProps) {
  const t = await getTranslations("projects.clientReviews.detail");
  const revT = await getTranslations("projects.clientReviews");
  const shellT = await getTranslations("shell");

  const statusConfig =
    DELIVERABLE_STATUS_MAP[deliverable.status] ??
    DELIVERABLE_STATUS_MAP.awaiting_client_review;

  const hasValidVersion =
    typeof deliverable.current_version_number === "number" &&
    deliverable.current_version_number > 0;

  const hasValidFeedback = deliverable.feedbackResult.ok === true;

  const isActionEligible =
    deliverable.status === "awaiting_client_review" &&
    hasValidVersion &&
    hasValidFeedback;

  const hasOutboundUrl =
    typeof deliverable.current_submission_url === "string" &&
    deliverable.current_submission_url.trim().length > 0;

  return (
    <div className="space-y-8">
      {/* Return Navigation */}
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/cliente/entregables"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>{t("backToReviews")}</span>
        </Link>
        {deliverable.project_id && (
          <Link
            href={`/cliente/proyectos/${deliverable.project_id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <FolderKanban className="h-4 w-4" aria-hidden="true" />
            <span>
              {t("backToProject", {
                projectName: deliverable.project_name ?? "Proyecto",
              })}
            </span>
          </Link>
        )}
      </div>

      {/* Main Review Card */}
      <article
        aria-labelledby="deliverable-title-heading"
        className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <FolderKanban className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{deliverable.project_name ?? "Proyecto"}</span>
            </div>
            <h1
              id="deliverable-title-heading"
              className="text-xl sm:text-2xl font-bold tracking-tight text-foreground"
            >
              {deliverable.title}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasValidVersion ? (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                v{deliverable.current_version_number}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                {t("versionUnavailable")}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig.badgeBg} ${statusConfig.badgeFg}`}
            >
              <statusConfig.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {shellT(
                `deliverableStatus.${statusConfig.labelKey}` as
                  | "deliverableStatus.pending"
                  | "deliverableStatus.awaitingInternalReview"
                  | "deliverableStatus.awaitingClientReview"
                  | "deliverableStatus.approved"
                  | "deliverableStatus.changesRequested"
                  | "deliverableStatus.delivered",
              )}
            </span>
          </div>
        </div>

        {/* Specifications */}
        {deliverable.specifications && (
          <div className="pt-4 border-t border-border/60">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("specificationsTitle")}
            </h2>
            <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
              {deliverable.specifications}
            </p>
          </div>
        )}

        {/* Submission Note */}
        {deliverable.current_submission_note && (
          <div className="pt-4 border-t border-border/60">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("submissionNoteTitle")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground italic whitespace-pre-wrap">
              &quot;{deliverable.current_submission_note}&quot;
            </p>
          </div>
        )}

        {/* Timeline Dates */}
        <div className="pt-4 border-t border-border/60 flex flex-wrap gap-6 text-xs text-muted-foreground">
          {deliverable.client_delivery_deadline_at && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {t("deliveryDeadline")}:{" "}
                {new Date(
                  deliverable.client_delivery_deadline_at,
                ).toLocaleDateString()}
              </span>
            </div>
          )}
          {deliverable.current_submitted_at && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {t("submittedAt")}:{" "}
                {new Date(
                  deliverable.current_submitted_at,
                ).toLocaleDateString()}
              </span>
            </div>
          )}
          {deliverable.approved_at && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {t("approvedAt")}:{" "}
                {new Date(deliverable.approved_at).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Deliberate External Drive Link */}
        {hasOutboundUrl ? (
          <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-muted/30">
            <div>
              <p className="text-xs font-medium text-foreground">
                {t("driveLinkLabel")}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t("driveLinkNotice")}
              </p>
            </div>
            <a
              href={deliverable.current_submission_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shrink-0"
              aria-label={t("driveLinkAria", { title: deliverable.title })}
            >
              <span>{t("openDriveLink")}</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        ) : (
          <div className="pt-4 border-t border-border/60 p-3 rounded-lg bg-muted/20 text-xs text-muted-foreground">
            {t("noDriveLink")}
          </div>
        )}

        {/* Action Controls or State Notices */}
        <div className="pt-4 border-t border-border/60">
          {isActionEligible ? (
            <ClientReviewActions deliverableId={deliverable.id} />
          ) : deliverable.status === "awaiting_client_review" ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-300"
            >
              <AlertTriangle
                className="h-4 w-4 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold">{t("inconsistentReviewTitle")}</p>
                <p className="mt-0.5">{t("inconsistentReviewMessage")}</p>
              </div>
            </div>
          ) : deliverable.status === "approved" ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2
                className="h-4 w-4 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold">{t("approvedNoticeTitle")}</p>
                <p className="mt-0.5">{t("approvedNoticeDesc")}</p>
              </div>
            </div>
          ) : deliverable.status === "changes_requested" ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle
                className="h-4 w-4 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold">
                  {t("changesRequestedNoticeTitle")}
                </p>
                <p className="mt-0.5">{t("changesRequestedNoticeDesc")}</p>
              </div>
            </div>
          ) : deliverable.status === "delivered" ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-xs text-blue-800 dark:text-blue-300">
              <CheckCircle2
                className="h-4 w-4 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold">{t("deliveredNoticeTitle")}</p>
                <p className="mt-0.5">{t("deliveredNoticeDesc")}</p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-muted/20 text-xs text-muted-foreground italic">
              {t("readOnlyStateNotice")}
            </div>
          )}
        </div>
      </article>

      {/* Client Feedback History */}
      <section
        aria-labelledby="client-feedback-history-heading"
        className="space-y-4"
      >
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2
            id="client-feedback-history-heading"
            className="text-lg font-semibold text-foreground"
          >
            {revT("feedbackHistory.title")}
          </h2>
        </div>

        {!deliverable.feedbackResult.ok ? (
          <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-6 text-center">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {revT("feedbackHistory.malformedNotice")}
            </p>
          </div>
        ) : deliverable.feedbackResult.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center bg-card/50">
            <p className="text-sm text-muted-foreground">
              {revT("feedbackHistory.empty")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {deliverable.feedbackResult.items.map((fb, idx) => (
              <div
                key={`${fb.reviewedAt}-${idx}`}
                className="rounded-xl border border-border bg-card p-4 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      fb.decision === "approved"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {fb.decision === "approved"
                      ? revT("feedbackHistory.decisionApproved")
                      : revT("feedbackHistory.decisionChangesRequested")}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(fb.reviewedAt).toLocaleString()}
                  </span>
                </div>
                {fb.comments && (
                  <p className="text-foreground whitespace-pre-wrap">
                    {fb.comments}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
