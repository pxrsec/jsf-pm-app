"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { CompleteInviteSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface InvitationFormProps {
  token: string;
}

export function InvitationForm({ token }: InvitationFormProps) {
  const t = useTranslations("auth.invitation");
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
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
      return;
    }

    setIsLoading(true);

    try {
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch("/api/v1/auth/invites/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
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
      if (errorData?.error?.message) {
        setErrorMessage(errorData.error.message);
      } else {
        setErrorMessage(t("errorGeneric"));
      }
      setIsLoading(false);
    } catch {
      setErrorMessage(t("errorGeneric"));
      setIsLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8 shadow-sm text-card-foreground"
    >
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

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">{t("fullNameLabel")}</Label>
          <Input
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">{t("phoneLabel")}</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+525512345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isLoading}
          />
        </div>

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

        <div className="flex items-center space-x-2 pt-1">
          <Checkbox
            id="whatsappOptIn"
            checked={whatsappOptIn}
            onCheckedChange={(checked) => setWhatsappOptIn(checked === true)}
            disabled={isLoading}
          />
          <Label
            htmlFor="whatsappOptIn"
            className="text-sm font-normal text-muted-foreground cursor-pointer"
          >
            {t("whatsappOptInLabel")}
          </Label>
        </div>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full" size="lg">
        {isLoading ? "..." : t("submitLabel")}
      </Button>
    </form>
  );
}
