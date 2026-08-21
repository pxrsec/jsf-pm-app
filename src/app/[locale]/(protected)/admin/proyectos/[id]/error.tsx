"use client";

import { useTranslations } from "next-intl";
import { ProjectRecoveryState } from "@/components/shared/projects/project-workspace/project-recovery-state";

export default function AdminProjectDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("projects.workspace.recovery");

  return (
    <ProjectRecoveryState
      error={error}
      reset={reset}
      title={t("workspace.title")}
      description={t("workspace.description")}
      retryLabel={t("retryAction")}
      returnLink={{
        href: "/admin/proyectos",
        label: t("returnToProjectsAction"),
      }}
    />
  );
}
