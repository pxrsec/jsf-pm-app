"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/browser";
import { ROLE_DEFAULT_PATHS, type AppRole } from "@/lib/auth/routes";
import { SignInSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

export function SignInForm() {
  const t = useTranslations("auth.signIn");
  const brandT = useTranslations("shell.brand");
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const validation = SignInSchema.safeParse({ email, password });
    if (!validation.success) {
      setErrorMessage(t("errorGeneric"));
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validation.data.email,
        password: validation.data.password,
      });

      if (error || !data.user) {
        if (
          error?.status === 429 ||
          error?.message.toLowerCase().includes("rate limit")
        ) {
          setErrorMessage(t("errorRateLimit"));
        } else {
          setErrorMessage(t("errorGeneric"));
        }
        setIsLoading(false);
        return;
      }

      // Read user profile to determine role-safe destination
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_active, deleted_at")
        .eq("id", data.user.id)
        .maybeSingle();

      if (
        !profile ||
        profile.is_active === false ||
        profile.deleted_at !== null
      ) {
        await supabase.auth.signOut();
        setErrorMessage(t("errorGeneric"));
        setIsLoading(false);
        return;
      }

      const role = profile.role as AppRole;
      const targetPath = ROLE_DEFAULT_PATHS[role] ?? "/iniciar-sesion";

      router.push(targetPath);
    } catch {
      setErrorMessage(t("errorGeneric"));
      setIsLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      suppressHydrationWarning
      className="w-full space-y-6 rounded-2xl border border-border/80 bg-card/95 p-7 sm:p-9 shadow-2xl shadow-accent/5 backdrop-blur-xl text-card-foreground transition-all duration-300 hover:border-border"
    >
      {/* Brand & Logo Header */}
      <div className="flex flex-col items-center justify-center text-center">
        <div className="mb-4 flex items-center justify-center">
          <Image
            src="/joyalogo-purple.svg"
            alt={brandT("name")}
            width={140}
            height={119}
            priority
            className="h-auto w-24 sm:w-28 drop-shadow-sm transition-transform duration-300 hover:scale-105"
          />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="text-xs text-muted-foreground mt-1 font-medium">
          {brandT("name")}
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg bg-destructive/10 p-3.5 text-xs text-destructive border border-destructive/20 animate-in fade-in duration-200"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Email Field */}
        <div className="space-y-1.5">
          <Label
            htmlFor="email"
            className="text-xs font-medium text-foreground"
          >
            {t("emailLabel")}
          </Label>
          <div className="relative flex items-center">
            <Mail
              className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground/70"
              aria-hidden="true"
            />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="h-10 pl-9 pr-3 text-sm bg-background/50 border-input focus-visible:ring-accent"
              placeholder="nombre@joyastarfilms.com"
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <Label
            htmlFor="password"
            className="text-xs font-medium text-foreground"
          >
            {t("passwordLabel")}
          </Label>
          <div className="relative flex items-center">
            <Lock
              className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground/70"
              aria-hidden="true"
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="h-10 pl-9 pr-10 text-sm bg-background/50 border-input focus-visible:ring-accent"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={
                showPassword ? "Ocultar contraseña" : "Ver contraseña"
              }
              className="absolute right-2.5 p-1 rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
              disabled={isLoading}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Link
          href="/restablecer-contrasena"
          className="text-xs font-medium text-muted-foreground hover:text-accent transition-colors hover:underline"
        >
          {t("forgotPasswordLink")}
        </Link>
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full h-10 text-sm font-semibold shadow-md shadow-accent/10 transition-all duration-200 hover:shadow-lg hover:shadow-accent/20 cursor-pointer"
        size="lg"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>...</span>
          </span>
        ) : (
          t("submitLabel")
        )}
      </Button>
    </form>
  );
}
