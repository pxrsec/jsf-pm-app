"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { captureException } from "@/lib/sentry";
import { ThemeToggle } from "@/components/shared/theme/theme-toggle";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RouteError({ error, reset }: RouteErrorProps) {
  const t = useTranslations("errors");

  useEffect(() => {
    captureException(error, { boundary: "localized-route" });
  }, [error]);

  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      {/* Header controls: Theme */}
      <header className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 z-20">
        <ThemeToggle />
      </header>

      {/* Main error content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 text-center min-w-0">
        <h1 className="text-2xl font-bold mb-2">{t("title")}</h1>
        <p className="text-muted-foreground mb-4">{t("message")}</p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
        >
          {t("retry")}
        </button>
      </main>
    </div>
  );
}
