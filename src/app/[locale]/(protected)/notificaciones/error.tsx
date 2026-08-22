"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { captureException } from "@/lib/sentry";

interface NotificationsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function NotificationsError({
  error,
  reset,
}: NotificationsErrorProps) {
  const t = useTranslations("notifications");

  useEffect(() => {
    captureException(error, { boundary: "localized-route" });
  }, [error]);

  return (
    <div className="container max-w-4xl mx-auto px-4 py-12 flex flex-col items-center justify-center text-center space-y-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">
        {t("error.title")}
      </h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {t("error.description")}
      </p>
      <div className="pt-2">
        <Button
          type="button"
          onClick={reset}
          size="sm"
          className="min-h-[44px] min-w-[44px]"
        >
          {t("error.retry")}
        </Button>
      </div>
    </div>
  );
}
