import type { ClientSubmissionRequirementSummary } from "@/lib/client/types";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  History,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";

export interface ClientSubmissionTranslations {
  statusSubmitted?: string;
  statusPending?: string;
  versionLabel?: string;
  deadline?: string;
  noDeadline?: string;
  readOnlyNotice?: string;
  reopenedNoticeTitle?: string;
  reopenedNoticeDesc?: string;
  reopenReasonHeading?: string;
  replacementExplanation?: string;
  historyTitle?: string;
  historyVersionEntry?: string;
  historyReopenedEntry?: string;
  historySubmittedAt?: string;
  historyReopenedAt?: string;
  historyReasonLabel?: string;
  historyNoteLabel?: string;
  historyEmpty?: string;
  historyUnavailable?: string;
  openLink?: string;
  openLinkAria?: string;
  currentUrlLabel?: string;
  providerGoogleDrive?: string;
  providerDropbox?: string;
  providerOneDrive?: string;
  providerWeTransfer?: string;
  providerFrameIo?: string;
  providerOtherHttps?: string;
}

interface ClientSubmissionCardProps {
  submission: ClientSubmissionRequirementSummary;
  mode?: "summary" | "detailed";
  actionSlot?: React.ReactNode;
  translations?: ClientSubmissionTranslations;
}

export function ClientSubmissionCard({
  submission,
  mode = "summary",
  actionSlot,
  translations,
}: ClientSubmissionCardProps) {
  const isSubmitted = submission.status === "submitted";
  const isCorrectionPending =
    submission.status === "pending" &&
    submission.current_version_number !== null &&
    submission.current_version_number > 0;

  const statusSubmittedLabel = translations?.statusSubmitted ?? "Enviado";
  const statusPendingLabel = translations?.statusPending ?? "Pendiente";
  const versionLabel = translations?.versionLabel ?? "Versión actual";
  const deadlineLabel = translations?.deadline ?? "Fecha límite";
  const noDeadlineLabel = translations?.noDeadline ?? "Sin fecha límite";
  const readOnlyLabel = translations?.readOnlyNotice ?? "Solo lectura";

  // Provider label resolver
  const getProviderLabel = (provider: string | null) => {
    if (!provider) return null;
    switch (provider) {
      case "google_drive":
        return translations?.providerGoogleDrive ?? "Google Drive";
      case "dropbox":
        return translations?.providerDropbox ?? "Dropbox";
      case "onedrive":
        return translations?.providerOneDrive ?? "OneDrive";
      case "wetransfer":
        return translations?.providerWeTransfer ?? "WeTransfer";
      case "frame_io":
        return translations?.providerFrameIo ?? "Frame.io";
      default:
        return translations?.providerOtherHttps ?? "Enlace HTTPS (Otro)";
    }
  };

  // Find latest reopen reason if in correction state
  const latestReopenedEntry = isCorrectionPending
    ? [...(submission.correctionHistory ?? [])]
        .reverse()
        .find((e) => e.kind === "reopened")
    : null;

  return (
    <article
      aria-labelledby={`submission-title-${submission.id}`}
      className="rounded-xl border border-border bg-card p-5 shadow-sm text-card-foreground flex flex-col justify-between space-y-4"
    >
      <div className="space-y-3">
        {/* Header: Title & Status Badge */}
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

          <div className="flex items-center gap-1.5 shrink-0">
            {isCorrectionPending && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300">
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>
                  {translations?.reopenedNoticeTitle ?? "Reemplazo solicitado"}
                </span>
              </span>
            )}
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
              <span>
                {isSubmitted ? statusSubmittedLabel : statusPendingLabel}
              </span>
            </span>
          </div>
        </div>

        {/* Specifications */}
        {submission.specifications && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
            {submission.specifications}
          </p>
        )}

        {/* Version Number */}
        {submission.current_version_number !== null && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">{versionLabel}:</span> v
            {submission.current_version_number}
          </div>
        )}

        {/* Detailed Mode: Terminal Submitted Info / External Link */}
        {mode === "detailed" &&
          isSubmitted &&
          submission.current_submission_url && (
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-muted-foreground">
                  {translations?.currentUrlLabel ?? "Enlace registrado"}:
                </span>
                {submission.current_submission_provider && (
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {getProviderLabel(submission.current_submission_provider)}
                  </span>
                )}
              </div>

              <a
                href={submission.current_submission_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline break-all min-h-[44px]"
                aria-label={
                  translations?.openLinkAria
                    ? translations.openLinkAria.replace(
                        "{title}",
                        submission.title,
                      )
                    : `Abrir enlace externo para ${submission.title} (abre en nueva pestaña)`
                }
              >
                <span className="line-clamp-1">
                  {submission.current_submission_url}
                </span>
                <ExternalLink
                  className="h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
              </a>

              {submission.current_submission_note && (
                <div className="pt-2 border-t border-border/60 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {translations?.historyNoteLabel ?? "Nota"}:
                  </span>{" "}
                  <span className="whitespace-pre-wrap">
                    {submission.current_submission_note}
                  </span>
                </div>
              )}
            </div>
          )}

        {/* Detailed Mode: Correction State (Reopen Reason & Replacement Note) */}
        {mode === "detailed" && isCorrectionPending && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5 text-xs text-amber-800 dark:text-amber-200">
            {latestReopenedEntry && latestReopenedEntry.kind === "reopened" && (
              <div>
                <span className="font-semibold">
                  {translations?.reopenReasonHeading ??
                    "Motivo de la solicitud de reemplazo"}
                  :
                </span>{" "}
                <span>{latestReopenedEntry.reason}</span>
              </div>
            )}
            <p className="text-[11px] text-amber-700/90 dark:text-amber-300/90">
              {translations?.replacementExplanation ??
                "El nuevo envío creará una nueva versión inmutable. El enlace anterior se conservará en el historial."}
            </p>
          </div>
        )}

        {/* Detailed Mode: Malformed Correction History Warning */}
        {mode === "detailed" && submission.correctionHistoryError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {translations?.historyUnavailable ??
                "El historial no está disponible temporalmente."}
            </span>
          </div>
        )}

        {/* Detailed Mode: Immutable History List */}
        {mode === "detailed" &&
          submission.correctionHistory &&
          submission.correctionHistory.length > 0 && (
            <div className="pt-3 border-t border-border/60 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <History className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {translations?.historyTitle ??
                    "Historial de versiones y solicitudes"}
                </span>
              </div>

              <ul className="space-y-2 text-xs">
                {submission.correctionHistory.map((entry, idx) => (
                  <li
                    key={`${entry.kind}-${idx}`}
                    className="rounded border border-border/60 bg-muted/20 p-2.5 space-y-1"
                  >
                    {entry.kind === "version" ? (
                      <div>
                        <div className="flex items-center justify-between font-medium text-foreground">
                          <span>
                            {translations?.historyVersionEntry
                              ? translations.historyVersionEntry.replace(
                                  "{versionNumber}",
                                  String(entry.versionNumber),
                                )
                              : `Versión ${entry.versionNumber}`}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(entry.submittedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <a
                          href={entry.submissionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline break-all mt-0.5"
                        >
                          <span className="line-clamp-1">
                            {entry.submissionUrl}
                          </span>
                          <ExternalLink
                            className="h-3 w-3 shrink-0"
                            aria-hidden="true"
                          />
                        </a>
                        {entry.note && (
                          <p className="text-[11px] text-muted-foreground whitespace-pre-wrap mt-1">
                            <span className="font-medium text-foreground">
                              {translations?.historyNoteLabel ?? "Nota"}:
                            </span>{" "}
                            {entry.note}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between font-medium text-amber-700 dark:text-amber-300">
                          <span>
                            {translations?.historyReopenedEntry ??
                              "Reabierto para corrección"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(entry.reopenedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          <span className="font-medium text-foreground">
                            {translations?.historyReasonLabel ?? "Motivo"}:
                          </span>{" "}
                          {entry.reason}
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
      </div>

      {/* Footer / Action Slot */}
      <div className="mt-4 pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
        <div>
          {submission.submission_deadline_at ? (
            <span>
              {deadlineLabel}:{" "}
              {new Date(submission.submission_deadline_at).toLocaleDateString()}
            </span>
          ) : (
            <span>{noDeadlineLabel}</span>
          )}
        </div>

        {mode === "detailed" && actionSlot ? (
          <div>{actionSlot}</div>
        ) : (
          <span className="text-[11px] italic text-muted-foreground">
            {readOnlyLabel}
          </span>
        )}
      </div>
    </article>
  );
}
