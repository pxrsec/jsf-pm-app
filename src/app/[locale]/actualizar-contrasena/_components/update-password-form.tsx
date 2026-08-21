"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/browser";
import { PasswordUpdateSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UpdatePasswordForm() {
  const t = useTranslations("auth.updatePassword");
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const validation = PasswordUpdateSchema.safeParse({
      password,
      confirm_password: confirmPassword,
    });

    if (!validation.success) {
      const issue = validation.error.issues[0];
      setErrorMessage(issue?.message ?? t("errorPolicy"));
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: validation.data.password,
      });

      if (error) {
        setErrorMessage(t("errorPolicy"));
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push("/iniciar-sesion");
      }, 2000);
    } catch {
      setErrorMessage(t("errorPolicy"));
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

      {isSuccess ? (
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
            Ir a Iniciar Sesión →
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t("passwordLabel")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("confirmLabel")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
        </form>
      )}
    </div>
  );
}
