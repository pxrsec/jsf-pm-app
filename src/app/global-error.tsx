"use client";

import { useEffect, useState } from "react";
import {
  errorLocaleFromPathname,
  getErrorCopy,
  type ErrorLocale,
} from "@/lib/error-copy";
import { captureException } from "@/lib/sentry";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const [locale] = useState<ErrorLocale>(() =>
    typeof window !== "undefined"
      ? errorLocaleFromPathname(window.location.pathname)
      : "es-MX",
  );

  useEffect(() => {
    captureException(error, { boundary: "global" });
  }, [error]);

  const copy = getErrorCopy(locale);

  return (
    <html lang={locale}>
      <body>
        <main>
          <h1>{copy.title}</h1>
          <p>{copy.message}</p>
          <button type="button" onClick={reset}>
            {copy.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
