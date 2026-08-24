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
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <ExternalLink
          className="h-4 w-4 text-muted-foreground"
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
        className="h-11 w-11 p-0 min-h-[44px] min-w-[44px]"
      >
        {copied ? (
          <Check className="h-4 w-4 text-primary" aria-hidden="true" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </Button>

      {/* Screen Reader Live Region */}
      <span className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </span>
    </div>
  );
}
