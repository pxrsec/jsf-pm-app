"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { submitClientSubmissionAction } from "@/lib/client/actions";
import {
  validateClientSubmissionUrl,
  type SubmissionProvider,
} from "@/lib/client/submission-url";
import { CLIENT_ERROR_KEY_BY_CODE } from "@/lib/client/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Info, Loader2, Send } from "lucide-react";

const PROVIDER_KEY_MAP: Record<
  SubmissionProvider,
  | "googleDrive"
  | "dropbox"
  | "oneDrive"
  | "weTransfer"
  | "frameIo"
  | "otherHttps"
> = {
  google_drive: "googleDrive",
  dropbox: "dropbox",
  onedrive: "oneDrive",
  wetransfer: "weTransfer",
  frame_io: "frameIo",
  other_https: "otherHttps",
};

interface ClientSubmissionActionsProps {
  deliverableId: string;
  deliverableTitle: string | null;
  isReplacement?: boolean;
}

export function ClientSubmissionActions({
  deliverableId,
  deliverableTitle,
  isReplacement = false,
}: ClientSubmissionActionsProps) {
  const t = useTranslations("projects.clientSubmissions.actions");
  const provT = useTranslations("projects.clientSubmissions.providers");
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [urlTouched, setUrlTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successAnnouncement, setSuccessAnnouncement] = useState<string | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const normalizedNote = note.trim();
  const noteCharCount = normalizedNote.length;
  const isNoteTooLong = noteCharCount > 1000;

  const urlValidation = validateClientSubmissionUrl(url);
  const isUrlValid = urlValidation.ok;
  const detectedProvider: SubmissionProvider | null = urlValidation.ok
    ? urlValidation.provider
    : null;

  const handleOpenChange = (open: boolean) => {
    if (!open && isPending) return;
    setIsOpen(open);
    if (!open) {
      setStep("form");
      setUrl("");
      setNote("");
      setUrlTouched(false);
      setServerError(null);
    }
  };

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlTouched(true);

    if (!isUrlValid || isNoteTooLong) {
      return;
    }

    setServerError(null);
    setStep("confirm");
  };

  const handleConfirmSubmit = () => {
    if (isPending) return;

    setServerError(null);
    startTransition(async () => {
      const result = await submitClientSubmissionAction({
        deliverable_id: deliverableId,
        submission_url: url,
        submission_note: note,
      });

      if (!result.ok) {
        const errorKey =
          CLIENT_ERROR_KEY_BY_CODE[result.error.code] ?? "generic";
        setServerError(t(`errors.${errorKey}` as Parameters<typeof t>[0]));
        setStep("form");
        return;
      }

      setSuccessAnnouncement(t("successMessage"));
      setIsOpen(false);
      setUrl("");
      setNote("");
      setStep("form");
      setUrlTouched(false);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Live announcement region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {successAnnouncement}
      </div>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger
          render={
            <Button
              size="sm"
              variant={isReplacement ? "secondary" : "default"}
              className="inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px]"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>
                {isReplacement ? t("submitCtaReplacement") : t("submitCta")}
              </span>
            </Button>
          }
        />

        <DialogContent className="sm:max-w-md">
          {step === "form" ? (
            <form onSubmit={handleProceedToConfirm}>
              <DialogHeader>
                <DialogTitle>
                  {isReplacement
                    ? t("dialogTitleReplacement")
                    : t("dialogTitle")}
                </DialogTitle>
                <DialogDescription>{t("dialogDescription")}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {serverError && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                  >
                    <AlertCircle
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{serverError}</span>
                  </div>
                )}

                {/* URL Input */}
                <div className="space-y-1.5">
                  <Label htmlFor={`submission-url-${deliverableId}`}>
                    {t("urlLabel")}{" "}
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                  </Label>
                  <Input
                    id={`submission-url-${deliverableId}`}
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onBlur={() => setUrlTouched(true)}
                    placeholder={t("urlPlaceholder")}
                    aria-invalid={urlTouched && !isUrlValid}
                    aria-describedby={`url-help-${deliverableId}${
                      urlTouched && !isUrlValid
                        ? ` url-error-${deliverableId}`
                        : ""
                    }`}
                    className={
                      urlTouched && !isUrlValid ? "border-destructive" : ""
                    }
                  />
                  <p
                    id={`url-help-${deliverableId}`}
                    className="text-[11px] text-muted-foreground"
                  >
                    {t("urlHelp")}
                  </p>
                  {urlTouched && !isUrlValid && (
                    <p
                      id={`url-error-${deliverableId}`}
                      role="alert"
                      className="text-xs font-medium text-destructive"
                    >
                      {urlValidation.reason === "TOO_LONG"
                        ? t("errors.linkTooLong")
                        : t("errors.invalidLink")}
                    </p>
                  )}
                </div>

                {/* Lexical Provider Classification Preview */}
                {isUrlValid && detectedProvider && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs">
                    <Info
                      className="h-4 w-4 text-primary shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <span className="font-medium text-muted-foreground">
                        {t("providerPreviewLabel")}:
                      </span>{" "}
                      <span className="font-semibold text-foreground">
                        {provT(PROVIDER_KEY_MAP[detectedProvider])}
                      </span>
                    </div>
                  </div>
                )}

                {/* Optional Note Textarea with Live Counter */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`submission-note-${deliverableId}`}>
                      {t("noteLabel")}
                    </Label>
                    <span
                      className={`text-[11px] font-mono ${
                        isNoteTooLong
                          ? "text-destructive font-semibold"
                          : "text-muted-foreground"
                      }`}
                      aria-live="polite"
                    >
                      {noteCharCount} / 1000
                    </span>
                  </div>
                  <Textarea
                    id={`submission-note-${deliverableId}`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t("notePlaceholder")}
                    rows={3}
                    aria-invalid={isNoteTooLong}
                    aria-describedby={`note-help-${deliverableId}${
                      isNoteTooLong ? ` note-error-${deliverableId}` : ""
                    }`}
                    className={isNoteTooLong ? "border-destructive" : ""}
                  />
                  <p
                    id={`note-help-${deliverableId}`}
                    className="text-[11px] text-muted-foreground"
                  >
                    {t("noteHelp")}
                  </p>
                  {isNoteTooLong && (
                    <p
                      id={`note-error-${deliverableId}`}
                      role="alert"
                      className="text-xs font-medium text-destructive"
                    >
                      {t("errors.noteTooLong")}
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !url || (urlTouched && !isUrlValid) || isNoteTooLong
                  }
                >
                  {t("confirmSubmit")}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4 py-2">
              <DialogHeader>
                <DialogTitle>{t("confirmDialogTitle")}</DialogTitle>
                <DialogDescription>
                  {t("confirmDialogDescription")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-xs">
                <div>
                  <span className="text-muted-foreground">
                    {t("deliverableLabel")}:
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {deliverableTitle ?? t("deliverableLabel")}
                  </p>
                </div>

                <div>
                  <span className="text-muted-foreground">
                    {t("urlLabel")}:
                  </span>
                  <p className="font-mono text-foreground break-all mt-0.5">
                    {url}
                  </p>
                </div>

                {detectedProvider && (
                  <div>
                    <span className="text-muted-foreground">
                      {t("providerPreviewLabel")}:
                    </span>
                    <p className="font-medium text-foreground mt-0.5">
                      {provT(PROVIDER_KEY_MAP[detectedProvider])}
                    </p>
                  </div>
                )}

                {normalizedNote && (
                  <div>
                    <span className="text-muted-foreground">
                      {t("noteLabel")}:
                    </span>
                    <p className="text-foreground whitespace-pre-wrap mt-0.5">
                      {normalizedNote}
                    </p>
                  </div>
                )}
              </div>

              {/* Truthfulness Notice */}
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{t("confirmNotice")}</span>
              </div>

              {serverError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                >
                  <AlertCircle
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{serverError}</span>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("form")}
                  disabled={isPending}
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={isPending}
                  className="min-h-[44px]"
                >
                  {isPending ? (
                    <>
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      <span>{t("submitting")}</span>
                    </>
                  ) : (
                    <span>{t("confirmSubmit")}</span>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
