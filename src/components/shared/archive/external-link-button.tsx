"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Check } from "lucide-react";

interface ExternalLinkButtonProps {
  url: string | null | undefined;
  variant?: "submission" | "drive";
  className?: string;
}

export function ExternalLinkButton({
  url,
  variant = "submission",
  className = "",
}: ExternalLinkButtonProps) {
  const t = useTranslations("archive.actions");
  const [copied, setCopied] = useState(false);
  const [liveMessage, setLiveMessage] = useState<string | null>(null);

  const handleCopy = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setLiveMessage(t("copySuccess"));
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setLiveMessage(t("copyError"));
    }
  }, [url, t]);

  if (!url) return null;

  const openLabel =
    variant === "drive" ? t("openDriveFolder") : t("openSubmission");
  const copyLabel =
    variant === "drive" ? t("copyDriveFolder") : t("copySubmission");

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {/* External Link Outbound Anchor */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={t("externalNotice")}
        aria-label={`${openLabel} (${t("opensInNewTab")})`}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground transition-colors min-h-[36px] sm:min-h-[32px]"
      >
        <ExternalLink
          className="h-3.5 w-3.5 text-muted-foreground"
          aria-hidden="true"
        />
        <span>{openLabel}</span>
      </a>

      {/* Copy Link Button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        title={copyLabel}
        aria-label={copyLabel}
        className="h-8 w-8 p-0 min-h-[36px] min-w-[36px] sm:min-h-[32px] sm:min-w-[32px]"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        ) : (
          <Copy
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </Button>

      {/* Screen Reader Live Region */}
      <span className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </span>
    </div>
  );
}
