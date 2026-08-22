import type { ClientSubmissionRequirementSummary } from "@/lib/client/types";
import { CheckCircle2, Clock, FileText } from "lucide-react";

interface ClientSubmissionCardProps {
  submission: ClientSubmissionRequirementSummary;
  translations?: {
    statusSubmitted?: string;
    statusPending?: string;
    versionLabel?: string;
    deadline?: string;
    noDeadline?: string;
    readOnlyNotice?: string;
  };
}

export function ClientSubmissionCard({
  submission,
  translations,
}: ClientSubmissionCardProps) {
  const isSubmitted = submission.status === "submitted";

  const statusSubmittedLabel = translations?.statusSubmitted ?? "Enviado";
  const statusPendingLabel = translations?.statusPending ?? "Pendiente";
  const versionLabel = translations?.versionLabel ?? "Versión actual";
  const deadlineLabel = translations?.deadline ?? "Fecha límite";
  const noDeadlineLabel = translations?.noDeadline ?? "Sin fecha límite";
  const readOnlyLabel = translations?.readOnlyNotice ?? "Solo lectura";

  return (
    <article
      aria-labelledby={`submission-title-${submission.id}`}
      className="rounded-xl border border-border bg-card p-5 shadow-sm text-card-foreground flex flex-col justify-between"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText
              className="h-4 w-4 text-muted-foreground shrink-0"
              aria-hidden="true"
            />
            <h4
              id={`submission-title-${submission.id}`}
              className="font-medium text-foreground text-sm line-clamp-1"
            >
              {submission.title}
            </h4>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${
              isSubmitted
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }`}
          >
            {isSubmitted ? (
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Clock className="h-3 w-3" aria-hidden="true" />
            )}
            {isSubmitted ? statusSubmittedLabel : statusPendingLabel}
          </span>
        </div>

        {submission.specifications && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
            {submission.specifications}
          </p>
        )}

        {submission.current_version_number !== null && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">{versionLabel}:</span> v
            {submission.current_version_number}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
        {submission.submission_deadline_at ? (
          <span>
            {deadlineLabel}:{" "}
            {new Date(submission.submission_deadline_at).toLocaleDateString()}
          </span>
        ) : (
          <span>{noDeadlineLabel}</span>
        )}

        <span className="text-[11px] italic text-muted-foreground">
          {readOnlyLabel}
        </span>
      </div>
    </article>
  );
}
