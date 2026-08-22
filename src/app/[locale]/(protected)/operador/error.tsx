"use client";

import { useTranslations } from "next-intl";
import { ProjectRecoveryState } from "@/components/shared/projects/project-workspace/project-recovery-state";

interface OperatorErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function OperatorError({ error, reset }: OperatorErrorProps) {
  const t = useTranslations("projects.operatorAgenda.recovery");

  return (
    <ProjectRecoveryState
      error={error}
      reset={reset}
      title={t("title")}
      description={t("description")}
      retryLabel={t("retryAction")}
      returnLink={{
        href: "/operador",
        label: t("returnAction"),
      }}
    />
  );
}
