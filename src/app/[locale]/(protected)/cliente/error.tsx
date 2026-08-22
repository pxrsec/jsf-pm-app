"use client";

import { useTranslations } from "next-intl";
import { ProjectRecoveryState } from "@/components/shared/projects/project-workspace/project-recovery-state";

interface ClientErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ClientError({ error, reset }: ClientErrorProps) {
  const t = useTranslations("projects.clientPortal.recovery");

  return (
    <ProjectRecoveryState
      error={error}
      reset={reset}
      title={t("title")}
      description={t("description")}
      retryLabel={t("retryAction")}
      returnLink={{
        href: "/cliente",
        label: t("returnAction"),
      }}
    />
  );
}
