import type { OperatorTaskDeliverableDetail } from "@/lib/operator/types";
import {
  DELIVERABLE_STATUS_MAP,
  type DeliverableStatus,
} from "@/lib/status-maps";
import { OperatorSubmissionDialog } from "./operator-submission-dialog";
import { cn } from "@/lib/utils";
import {
  Package,
  Calendar,
  Clock,
  Send,
  Eye,
  CheckCircle2,
  Truck,
  RotateCcw,
  CircleDot,
  FileText,
} from "lucide-react";

interface OperatorDeliverableCardProps {
  deliverable: OperatorTaskDeliverableDetail;
  locale: string;
  translations: {
    statusLabel: string;
    specificationsTitle: string;
    noSpecifications: string;
    submissionDeadline: (date: string) => string;
    internalReviewDeadline: (date: string) => string;
    clientDeliveryDeadline: (date: string) => string;
    awaitingInternalReviewNotice: string;
    awaitingClientReviewNotice: string;
    approvedNotice: string;
    deliveredNotice: string;
    changesRequestedNotice: string;
    submission: {
      dialogTitle: string;
      dialogTitleRevision: string;
      dialogDescription: string;
      truthfulnessNotice: string;
      revisionNotice: (nextVersion: string) => string;
      urlLabel: string;
      urlPlaceholder: string;
      urlHelp: string;
      urlError: string;
      noteLabel: string;
      notePlaceholder: string;
      noteHelp: string;
      charCount: (count: string) => string;
      cancelAction: string;
      submitAction: string;
      submitting: string;
      successToast: (version: string) => string;
      submitCta: string;
      resubmitCta: string;
      errors: {
        validationFailed: string;
        unauthorized: string;
        notFound: string;
        invalidTransition: string;
        conflict: string;
        invariantViolation: string;
        generic: string;
      };
    };
  };
}

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(
      locale === "es" || locale === "es-MX" ? "es-MX" : "en-US",
      {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    );
  } catch {
    return dateStr;
  }
}

export function OperatorDeliverableCard({
  deliverable,
  locale,
  translations,
}: OperatorDeliverableCardProps) {
  const statusKey = deliverable.deliverableStatus as DeliverableStatus | null;
  const statusConfig = statusKey ? DELIVERABLE_STATUS_MAP[statusKey] : null;
  const StatusIcon = statusConfig?.icon ?? CircleDot;

  const isProduction = deliverable.deliverableWorkflowType === "production";
  const isPending = deliverable.deliverableStatus === "pending";
  const isChangesRequested =
    deliverable.deliverableStatus === "changes_requested";
  const isEligibleForSubmission =
    isProduction && (isPending || isChangesRequested);

  const formattedSubmissionDeadline = deliverable.submissionDeadlineAt
    ? formatDate(deliverable.submissionDeadlineAt, locale)
    : null;
  const formattedInternalReviewDeadline = deliverable.internalReviewDeadlineAt
    ? formatDate(deliverable.internalReviewDeadlineAt, locale)
    : null;
  const formattedClientDeliveryDeadline = deliverable.clientDeliveryDeadlineAt
    ? formatDate(deliverable.clientDeliveryDeadlineAt, locale)
    : null;

  return (
    <article
      data-testid="operator-deliverable-card"
      data-deliverable-id={deliverable.deliverableId}
      className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4"
    >
      {/* Header: Title, Status Badge, Version */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Package
            className="size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <h3 className="text-base font-semibold text-foreground tracking-tight">
            {deliverable.deliverableTitle}
          </h3>
          {deliverable.currentVersionNumber !== null &&
            deliverable.currentVersionNumber > 0 && (
              <span
                data-testid="deliverable-version-badge"
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"
              >
                v{deliverable.currentVersionNumber}
              </span>
            )}
        </div>

        {statusConfig && (
          <span
            data-testid="deliverable-status-badge"
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 self-start sm:self-auto",
              statusConfig.badgeBg,
              statusConfig.badgeFg,
            )}
            role="status"
          >
            <StatusIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{translations.statusLabel}</span>
          </span>
        )}
      </div>

      {/* Specifications */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <FileText className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{translations.specificationsTitle}</span>
        </div>
        <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed pl-5">
          {deliverable.deliverableSpecifications || (
            <span className="italic text-muted-foreground">
              {translations.noSpecifications}
            </span>
          )}
        </p>
      </div>

      {/* Deadlines */}
      {(formattedSubmissionDeadline ||
        formattedInternalReviewDeadline ||
        formattedClientDeliveryDeadline) && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
          {formattedSubmissionDeadline && (
            <div className="flex items-center gap-1.5">
              <Clock
                className="size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <span>
                {translations.submissionDeadline(formattedSubmissionDeadline)}
              </span>
            </div>
          )}
          {formattedInternalReviewDeadline && (
            <div className="flex items-center gap-1.5">
              <Eye
                className="size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <span>
                {translations.internalReviewDeadline(
                  formattedInternalReviewDeadline,
                )}
              </span>
            </div>
          )}
          {formattedClientDeliveryDeadline && (
            <div className="flex items-center gap-1.5">
              <Calendar
                className="size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <span>
                {translations.clientDeliveryDeadline(
                  formattedClientDeliveryDeadline,
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/* State notices & Submission Action */}
      <div className="pt-2 border-t border-border/60">
        {isChangesRequested && (
          <div
            role="note"
            className="mb-3 flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 dark:border-orange-950/60 dark:bg-orange-950/30 p-3 text-xs text-orange-800 dark:text-orange-200"
          >
            <RotateCcw className="size-4 shrink-0 text-orange-600 dark:text-orange-400 mt-0.5" />
            <span>{translations.changesRequestedNotice}</span>
          </div>
        )}

        {deliverable.deliverableStatus === "awaiting_internal_review" && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 dark:border-indigo-950/60 dark:bg-indigo-950/30 p-3 text-xs font-medium text-indigo-800 dark:text-indigo-200"
          >
            <Eye className="size-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span>{translations.awaitingInternalReviewNotice}</span>
          </div>
        )}

        {deliverable.deliverableStatus === "awaiting_client_review" && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-purple-200 bg-purple-50 dark:border-purple-950/60 dark:bg-purple-950/30 p-3 text-xs font-medium text-purple-800 dark:text-purple-200"
          >
            <Send className="size-4 shrink-0 text-purple-600 dark:text-purple-400" />
            <span>{translations.awaitingClientReviewNotice}</span>
          </div>
        )}

        {deliverable.deliverableStatus === "approved" && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 dark:border-green-950/60 dark:bg-green-950/30 p-3 text-xs font-medium text-green-800 dark:text-green-200"
          >
            <CheckCircle2 className="size-4 shrink-0 text-green-600 dark:text-green-400" />
            <span>{translations.approvedNotice}</span>
          </div>
        )}

        {deliverable.deliverableStatus === "delivered" && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50 dark:border-teal-950/60 dark:bg-teal-950/30 p-3 text-xs font-medium text-teal-800 dark:text-teal-200"
          >
            <Truck className="size-4 shrink-0 text-teal-600 dark:text-teal-400" />
            <span>{translations.deliveredNotice}</span>
          </div>
        )}

        {isEligibleForSubmission && (
          <div className="pt-1">
            <OperatorSubmissionDialog
              deliverableId={deliverable.deliverableId}
              deliverableTitle={deliverable.deliverableTitle}
              currentVersionNumber={deliverable.currentVersionNumber}
              status={
                deliverable.deliverableStatus as "pending" | "changes_requested"
              }
              translations={translations.submission}
            />
          </div>
        )}
      </div>
    </article>
  );
}
