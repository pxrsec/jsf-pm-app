"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users } from "lucide-react";

interface MetricsTabNavigationProps {
  activeTab: "projects" | "users";
}

export function MetricsTabNavigation({
  activeTab,
}: MetricsTabNavigationProps) {
  const t = useTranslations("metrics.tabs");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const handleTabChange = (val: string | number | null) => {
    const nextTab = val === "users" ? "users" : "projects";
    if (nextTab === activeTab) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList aria-label={t("ariaLabel")}>
        <TabsTrigger value="projects">
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          <span>{t("projects")}</span>
        </TabsTrigger>
        <TabsTrigger value="users">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>{t("users")}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
