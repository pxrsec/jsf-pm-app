"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function toggleLanguage() {
    const nextLocale = locale === "es-MX" ? "en-US" : "es-MX";
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-white transition-colors"
      aria-label={
        locale === "es-MX"
          ? "Cambiar idioma a Inglés"
          : "Switch language to Spanish"
      }
      title={locale === "es-MX" ? "Switch to English" : "Cambiar a Español"}
    >
      <span
        className={
          locale === "es-MX"
            ? "font-bold text-amber-600 dark:text-amber-400"
            : "text-neutral-400 dark:text-neutral-500"
        }
      >
        ES
      </span>
      <span className="text-neutral-300 dark:text-neutral-600">/</span>
      <span
        className={
          locale === "en-US"
            ? "font-bold text-amber-600 dark:text-amber-400"
            : "text-neutral-400 dark:text-neutral-500"
        }
      >
        EN
      </span>
    </button>
  );
}
