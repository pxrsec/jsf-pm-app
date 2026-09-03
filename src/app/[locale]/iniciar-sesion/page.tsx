import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getOptionalSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { LanguageSwitcher } from "@/components/shared/language-switcher/language-switcher";
import { ThemeToggle } from "@/components/shared/theme/theme-toggle";
import { LegalFooter } from "@/components/shared/public-shell/legal-footer";
import { SignInForm } from "./_components/sign-in-form";

export default async function SignInPage() {
  const cookieStore = await cookies();
  const session = await getOptionalSession(cookieStore);

  if (session) {
    redirect(ROLE_DEFAULT_PATHS[session.role] ?? "/");
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-background overflow-x-hidden">
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

      {/* Main card container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 min-w-0">
        <div className="w-full max-w-md">
          <SignInForm />
        </div>
      </main>

      {/* Shared legal footer */}
      <LegalFooter />
    </div>
  );
}
