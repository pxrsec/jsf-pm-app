import { useTranslations } from "next-intl";

export default function PrivacyPage() {
  const t = useTranslations("privacy");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>
      <p className="mb-2">{t("placeholderNotice")}</p>
      <p className="text-sm text-gray-500">{t("notLegalAdvice")}</p>
    </div>
  );
}
