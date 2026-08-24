"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CalendarErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CalendarError({ reset }: CalendarErrorProps) {
  const t = useTranslations("calendar");

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-foreground">
        {t("states.error")}
      </h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {t("states.unauthorized")}
      </p>
      <Button onClick={reset} className="mt-6" variant="outline">
        {t("actions.retry")}
      </Button>
    </div>
  );
}
