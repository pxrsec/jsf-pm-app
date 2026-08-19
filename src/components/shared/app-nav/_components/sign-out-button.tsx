"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/browser";

export function SignOutButton({ className }: { className?: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const t = useTranslations("shell.nav");

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Gracefully handle sign-out errors
    } finally {
      router.push("/iniciar-sesion");
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isLoading}
      aria-busy={isLoading}
      aria-label={t("signOut")}
      className={
        className ??
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800 px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-200"
      }
    >
      {isLoading ? "..." : t("signOut")}
    </button>
  );
}
