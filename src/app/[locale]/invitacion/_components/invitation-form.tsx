"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { CompleteInviteSchema } from "@/lib/validation/auth";

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
        router.refresh();
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
      className="w-full max-w-md space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {t("title")}
      </h1>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
        >
          {errorMessage}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label
            htmlFor="fullName"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t("fullNameLabel")}
          </label>
          <input
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isLoading}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
          />
        </div>

        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t("phoneLabel")}
          </label>
          <input
            id="phone"
            type="tel"
            placeholder="+525512345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isLoading}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t("passwordLabel")}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
          />
        </div>

        <div className="flex items-start">
          <div className="flex h-5 items-center">
            <input
              id="whatsappOptIn"
              type="checkbox"
              checked={whatsappOptIn}
              onChange={(e) => setWhatsappOptIn(e.target.checked)}
              disabled={isLoading}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:ring-zinc-100"
            />
          </div>
          <div className="ml-3 text-sm">
            <label
              htmlFor="whatsappOptIn"
              className="text-zinc-600 dark:text-zinc-400"
            >
              {t("whatsappOptInLabel")}
            </label>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="flex w-full justify-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isLoading ? "..." : t("submitLabel")}
      </button>
    </form>
  );
}
