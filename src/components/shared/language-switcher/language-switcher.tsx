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
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition-colors"
      aria-label={
        locale === "es-MX"
          ? "Cambiar idioma a Inglés"
          : "Switch language to Spanish"
      }
      title={locale === "es-MX" ? "Switch to English" : "Cambiar a Español"}
    >
      <span
        className={
          locale === "es-MX" ? "font-bold text-accent" : "text-muted-foreground"
        }
      >
        ES
      </span>
      <span className="text-muted-foreground/50">/</span>
      <span
        className={
          locale === "en-US" ? "font-bold text-accent" : "text-muted-foreground"
        }
      >
        EN
      </span>
    </button>
  );
}
