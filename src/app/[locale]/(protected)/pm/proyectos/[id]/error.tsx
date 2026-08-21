"use client";

import { useTranslations } from "next-intl";
import { ProjectRecoveryState } from "@/components/shared/projects/project-workspace/project-recovery-state";

export default function PmProjectDetailError({
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
      description={t("pmWorkspace.description")}
      retryLabel={t("retryAction")}
      returnLink={{
        href: "/pm/proyectos",
        label: t("returnToAssignedProjectsAction"),
      }}
    />
  );
}
