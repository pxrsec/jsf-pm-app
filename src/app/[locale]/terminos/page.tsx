import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LanguageSwitcher } from "@/components/shared/language-switcher/language-switcher";
import { ThemeToggle } from "@/components/shared/theme/theme-toggle";
import { LegalFooter } from "@/components/shared/public-shell/legal-footer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "terms" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "terms" });
  const tLegal = await getTranslations({ locale, namespace: "legal" });

  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      {/* Header with Navigation & Controls */}
      <header className="border-b border-border/40 px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link
          href="/iniciar-sesion"
          className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
        >
          ← {tLegal("backToSignIn")}
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {/* Content Region */}
      <main className="flex-1 container max-w-3xl mx-auto px-4 py-8 sm:py-12 space-y-6 min-w-0">
        <div className="space-y-3">
          <div
            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-muted text-muted-foreground border border-border"
            role="status"
          >
            {tLegal("draftBadge")}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {t("description")}
          </p>
        </div>

        {/* Draft Notice Callout */}
        <div
          className="rounded-lg border border-border/80 bg-muted/30 p-4 text-xs sm:text-sm text-muted-foreground leading-relaxed"
          role="note"
        >
          {tLegal("draftNotice")}
        </div>

        {/* Structured Placeholder Sections */}
        <div className="space-y-6">
          <section className="space-y-2 rounded-lg border border-border/60 bg-card/40 p-5">
            <h2 className="text-base font-semibold text-foreground">
              {t("sections.placeholderTitle")}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("sections.placeholderBody")}
            </p>
          </section>
        </div>
      </main>

      {/* Shared legal footer */}
      <LegalFooter />
    </div>
  );
}
