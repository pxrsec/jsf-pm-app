"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm() {
  const t = useTranslations("auth.resetPassword");
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const redirectTo = `${window.location.origin}/api/auth/callback?type=recovery`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (
        error &&
        (error.status === 429 ||
          error.message.toLowerCase().includes("rate limit"))
      ) {
        setErrorMessage(
          "Demasiadas solicitudes. Por favor, espera antes de intentar de nuevo.",
        );
        setIsLoading(false);
        return;
      }

      // Always show success message for account-enumeration safety
      setIsSubmitted(true);
    } catch {
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8 shadow-sm text-card-foreground">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {t("title")}
      </h1>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20"
        >
          {errorMessage}
        </div>
      )}

      {isSubmitted ? (
        <div className="space-y-4">
          <div
            role="status"
            className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-700 dark:text-emerald-300"
          >
            {t("successMessage")}
          </div>
          <Link
            href="/iniciar-sesion"
            className="inline-block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Volver a Iniciar Sesión
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? "..." : t("submitLabel")}
          </Button>

          <div className="pt-2 text-center">
            <Link
              href="/iniciar-sesion"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Volver a Iniciar Sesión
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
