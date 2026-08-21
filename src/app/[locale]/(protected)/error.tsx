"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function ProtectedError() {
  const t = useTranslations("shell.error");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto max-w-md space-y-4 rounded-xl border border-border bg-card p-8 shadow-sm text-card-foreground">
        <h2 className="text-xl font-bold text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("message")}</p>
        <div className="pt-2">
          <Link
            href="/iniciar-sesion"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
          >
            {t("signInAgain")}
          </Link>
        </div>
      </div>
    </div>
  );
}
