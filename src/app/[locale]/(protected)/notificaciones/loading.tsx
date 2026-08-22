import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

export default async function NotificationsLoading() {
  const t = await getTranslations("notifications");

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="container max-w-4xl mx-auto px-4 py-8 space-y-6"
    >
      <span className="sr-only">{t("loading")}</span>

      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 rounded-md" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>

      {/* Action bar skeleton */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <Skeleton className="h-4 w-36 rounded-md" />
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>

      {/* List items skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm"
          >
            <div className="flex items-start gap-3 flex-1">
              <Skeleton className="h-5 w-16 rounded-full" />
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-3 w-20 rounded-md" />
                </div>
                <Skeleton className="h-4 w-full max-w-md rounded-md" />
              </div>
            </div>
            <Skeleton className="h-9 w-28 rounded-md shrink-0 self-end sm:self-center" />
          </div>
        ))}
      </div>
    </div>
  );
}
