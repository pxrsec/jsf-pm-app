import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

export default async function PmProjectsLoading() {
  const t = await getTranslations("projects.workspace.recovery");

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6"
    >
      <span className="sr-only">{t("loading")}</span>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-96 w-full rounded-md" />
    </div>
  );
}
