"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { CompleteInviteSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  User,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Info,
} from "lucide-react";

interface InvitationFormProps {
  token: string;
}

export function InvitationForm({ token }: InvitationFormProps) {
  const t = useTranslations("auth.invitation");
  const brandT = useTranslations("shell.brand");
  const sessionExpiredT = useTranslations("auth.sessionExpired");
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const payload = {
      token,
      full_name: fullName,
      phone_e164: phone.trim() ? phone.trim() : null,
      password,
      whatsapp_opt_in: whatsappOptIn,
    };

    const validation = CompleteInviteSchema.safeParse(payload);
    if (!validation.success) {
      const issue = validation.error.issues[0];
      setErrorMessage(issue?.message ?? t("errorPolicy"));
      setPassword("");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/v1/auth/invites/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validation.data),
      });

      if (response.status === 201) {
        const result = await response.json();
        const redirectPath = result.data?.redirect_path ?? "/";
        router.push(redirectPath);
        return;
      }

      if (response.status === 410) {
        router.push("/sesion-expirada?reason=expired");
        return;
      }

      const errorData = await response.json().catch(() => null);
      const errorCode = errorData?.error?.code;

      if (errorCode === "conflict") {
        setErrorMessage(t("errors.conflict"));
      } else if (errorCode === "validation_error") {
        setErrorMessage(
          errorData?.error?.message ?? t("errors.validation_error"),
        );
      } else if (errorCode === "invite_terminal") {
        setErrorMessage(t("errors.invite_terminal"));
      } else if (errorCode === "authentication_failed") {
        setErrorMessage(t("errors.authentication_failed"));
      } else if (errorCode === "unavailable") {
        setErrorMessage(t("errors.unavailable"));
      } else if (errorData?.error?.message) {
        setErrorMessage(errorData.error.message);
      } else {
        setErrorMessage(t("errorGeneric"));
      }
      setPassword("");
      setIsLoading(false);
    } catch {
      setErrorMessage(t("errorGeneric"));
      setPassword("");
      setIsLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      suppressHydrationWarning
      className="w-full space-y-6 rounded-2xl border border-border/80 bg-card/95 p-6 sm:p-9 shadow-2xl shadow-accent/5 backdrop-blur-xl text-card-foreground transition-all duration-300 hover:border-border"
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

      {/* Fixed Email Bound Notice */}
      <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
        <span>{t("fixedEmailNotice")}</span>
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
        {/* Full Name Field */}
        <div className="space-y-1.5">
          <Label
            htmlFor="fullName"
            className="text-xs font-medium text-foreground"
          >
            {t("fullNameLabel")}
          </Label>
          <div className="relative flex items-center">
            <User
              className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground/70"
              aria-hidden="true"
            />
            <Input
              id="fullName"
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isLoading}
              className="h-10 pl-9 pr-3 text-sm bg-background/50 border-input focus-visible:ring-accent"
              placeholder="Juan Pérez"
            />
          </div>
        </div>

        {/* Phone Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="phone"
              className="text-xs font-medium text-foreground"
            >
              {t("phoneLabel")}
            </Label>
            <span className="text-[11px] text-muted-foreground">
              {t("phoneHelp")}
            </span>
          </div>
          <div className="relative flex items-center">
            <Phone
              className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground/70"
              aria-hidden="true"
            />
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+525512345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isLoading}
              className="h-10 pl-9 pr-3 text-sm bg-background/50 border-input focus-visible:ring-accent"
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="password"
              className="text-xs font-medium text-foreground"
            >
              {t("passwordLabel")}
            </Label>
          </div>
          <div className="relative flex items-center">
            <Lock
              className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground/70"
              aria-hidden="true"
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="h-10 pl-9 pr-10 text-sm bg-background/50 border-input focus-visible:ring-accent"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              className="absolute right-2.5 p-1 rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors cursor-pointer"
              disabled={isLoading}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed pt-0.5">
            {t("passwordPolicyHelp")}
          </p>
        </div>

        {/* WhatsApp Notification Opt-in */}
        <div className="flex items-start space-x-2.5 rounded-lg border border-border/50 bg-background/40 p-3 transition-colors hover:border-border">
          <Checkbox
            id="whatsappOptIn"
            checked={whatsappOptIn}
            onCheckedChange={(checked) => setWhatsappOptIn(checked === true)}
            disabled={isLoading}
            className="mt-0.5 cursor-pointer"
          />
          <Label
            htmlFor="whatsappOptIn"
            className="text-xs leading-relaxed font-normal text-muted-foreground cursor-pointer select-none"
          >
            {t("whatsappOptInLabel")}
          </Label>
        </div>
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full h-10 text-sm font-semibold shadow-md shadow-accent/10 transition-all duration-200 hover:shadow-lg hover:shadow-accent/20 cursor-pointer"
        size="lg"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>...</span>
          </span>
        ) : (
          t("submitLabel")
        )}
      </Button>

      {/* Return / Sign in link */}
      <div className="flex items-center justify-center pt-1">
        <Link
          href="/iniciar-sesion"
          className="text-xs font-medium text-muted-foreground hover:text-accent transition-colors hover:underline"
        >
          {sessionExpiredT("signInLink")} →
        </Link>
      </div>
    </form>
  );
}
