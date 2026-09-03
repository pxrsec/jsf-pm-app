import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export function LegalFooter() {
  const t = useTranslations("legal");

  return (
    <footer className="w-full border-t border-border/40 bg-background/50 backdrop-blur-sm py-2 px-4 sm:px-6">
      <nav
        aria-label={t("footerNavLabel")}
        className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-muted-foreground"
      >
        <Link
          href="/privacidad"
          className="inline-flex min-h-[44px] items-center px-2 py-3 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
        >
          {t("links.privacy")}
        </Link>
        <Link
          href="/terminos"
          className="inline-flex min-h-[44px] items-center px-2 py-3 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
        >
          {t("links.terms")}
        </Link>
      </nav>
    </footer>
  );
}
