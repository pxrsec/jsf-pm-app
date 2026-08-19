"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

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
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleSignOut}
      disabled={isLoading}
      aria-busy={isLoading}
      aria-label={t("signOut")}
      className={className}
    >
      {isLoading ? "..." : t("signOut")}
    </Button>
  );
}
