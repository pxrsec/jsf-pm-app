"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { captureException } from "@/lib/sentry";

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
    <main>
      <h1>{t("title")}</h1>
      <p>{t("message")}</p>
      <button type="button" onClick={reset}>
        {t("retry")}
      </button>
    </main>
  );
}
