import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { AlertTriangle } from "lucide-react";
import { LanguageSwitcher } from "@/components/shared/language-switcher/language-switcher";
import { ThemeToggle } from "@/components/shared/theme/theme-toggle";
import { LegalFooter } from "@/components/shared/public-shell/legal-footer";

export default async function SessionExpiredPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const t = await getTranslations("auth.sessionExpired");

  let message = t("messageInvalid");
  if (reason === "expired") {
    message = t("messageExpired");
  } else if (reason === "already_used") {
    message = t("messageAlreadyUsed");
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-background overflow-x-hidden">
      {/* Header controls: Language & Theme */}
      <header className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 z-20">
        <LanguageSwitcher />
        <ThemeToggle />
      </header>

      {/* Main card container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 min-w-0">
        <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8 text-center shadow-sm text-card-foreground">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle
              className="h-6 w-6 text-destructive"
              aria-hidden="true"
            />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>

          <p className="text-sm text-muted-foreground">{message}</p>

          <div className="pt-2">
            <Link
              href="/iniciar-sesion"
              className="inline-flex w-full justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-colors"
            >
              {t("signInLink")}
            </Link>
          </div>
        </div>
      </main>

      {/* Shared legal footer */}
      <LegalFooter />
    </div>
  );
}
