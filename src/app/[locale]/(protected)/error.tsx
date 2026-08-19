"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function ProtectedError() {
  const t = useTranslations("shell.error");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto max-w-md space-y-4 rounded-xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          {t("title")}
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {t("message")}
        </p>
        <div className="pt-2">
          <Link
            href="/iniciar-sesion"
            className="inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors"
          >
            {t("signInAgain")}
          </Link>
        </div>
      </div>
    </div>
  );
}
