"use client";

import { useTranslations } from "next-intl";
import { ProjectRecoveryState } from "@/components/shared/projects/project-workspace/project-recovery-state";

export default function AdminProjectsError({
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
      title={t("directory.title")}
      description={t("directory.description")}
      retryLabel={t("retryAction")}
    />
  );
}
