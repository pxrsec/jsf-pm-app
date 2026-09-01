import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/shared/language-switcher/language-switcher";
import { ThemeToggle } from "@/components/shared/theme/theme-toggle";
import { InvitationForm } from "./_components/invitation-form";

export default async function InvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token || token.trim().length < 43) {
    redirect("/sesion-expirada?reason=invalid");
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden bg-background">
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
      <div className="relative z-10 w-full max-w-md">
        <InvitationForm token={token} />
      </div>
    </main>
  );
}
