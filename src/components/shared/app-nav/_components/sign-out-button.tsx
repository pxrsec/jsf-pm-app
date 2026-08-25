"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

export interface SignOutButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  iconOnly?: boolean;
}

export const SignOutButton = React.forwardRef<
  HTMLButtonElement,
  SignOutButtonProps
>(({ className, iconOnly, ...props }, ref) => {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const t = useTranslations("shell.nav");

  const handleSignOut = async (e: React.MouseEvent<HTMLButtonElement>) => {
    props.onClick?.(e);
    if (e.defaultPrevented) return;
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
      ref={ref}
      type="button"
      variant="outline"
      size="sm"
      onClick={handleSignOut}
      disabled={isLoading}
      aria-busy={isLoading}
      aria-label={t("signOut")}
      className={className}
      {...props}
    >
      {iconOnly ? (
        <LogOut className="h-5 w-5" aria-hidden="true" />
      ) : isLoading ? (
        "..."
      ) : (
        t("signOut")
      )}
    </Button>
  );
});

SignOutButton.displayName = "SignOutButton";
