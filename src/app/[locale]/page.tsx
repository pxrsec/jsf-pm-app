import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getOptionalSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { Link } from "@/i18n/routing";
import { LanguageSwitcher } from "@/components/shared/language-switcher/language-switcher";
import { ThemeToggle } from "@/components/shared/theme/theme-toggle";
import { LegalFooter } from "@/components/shared/public-shell/legal-footer";

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = await getOptionalSession(cookieStore);
  const headersList = await headers().catch(() => null);
  const rawPathname = headersList?.get
    ? headersList.get("x-pathname") ||
      headersList.get("x-invoke-path") ||
      headersList.get("x-url") ||
      ""
    : "";
  const isEnglish = rawPathname.startsWith("/en/") || rawPathname === "/en";
  const prefix = isEnglish ? "/en" : "";

  if (session) {
    const rolePath = ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion";
    redirect(`${prefix}${rolePath}`);
  }

  const tBrand = await getTranslations("shell.brand");
  const tLanding = await getTranslations("landing");

  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      {/* Ambient background glow accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[550px] h-[550px] rounded-full bg-accent/15 blur-[120px] dark:bg-accent/20"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 left-1/2 -translate-x-1/2 w-[450px] h-[450px] rounded-full bg-purple-500/10 blur-[100px] dark:bg-purple-600/15"
      />

      {/* Header controls: Language & Theme */}
      <header className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 z-20">
        <LanguageSwitcher />
        <ThemeToggle />
      </header>

      {/* Main landing content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 text-center max-w-3xl mx-auto space-y-6 min-w-0">
        <div className="space-y-3">
          <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50">
            {tBrand("name")}
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            {tLanding("title")}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {tLanding("description")}
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/iniciar-sesion"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-colors"
          >
            {tLanding("signInAction")}
          </Link>
        </div>
      </main>

      {/* Shared legal footer */}
      <LegalFooter />
    </div>
  );
}
