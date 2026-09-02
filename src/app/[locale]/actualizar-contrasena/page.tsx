import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LanguageSwitcher } from "@/components/shared/language-switcher/language-switcher";
import { ThemeToggle } from "@/components/shared/theme/theme-toggle";
import { LegalFooter } from "@/components/shared/public-shell/legal-footer";
import { UpdatePasswordForm } from "./_components/update-password-form";

export default async function UpdatePasswordPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sesion-expirada?reason=invalid");
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
        <UpdatePasswordForm />
      </main>

      {/* Shared legal footer */}
      <LegalFooter />
    </div>
  );
}
