import { useTranslations } from "next-intl";

export default function HomePage() {
  const t = useTranslations("shell.brand");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <h1>{t("name")}</h1>
    </div>
  );
}
