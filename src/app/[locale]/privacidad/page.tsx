import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/shared/language-switcher/language-switcher";

export default function PrivacyPage() {
  const t = useTranslations("privacy");

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-8">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>
      <p className="mb-2">{t("placeholderNotice")}</p>
      <p className="text-sm text-gray-500">{t("notLegalAdvice")}</p>
    </div>
  );
}
