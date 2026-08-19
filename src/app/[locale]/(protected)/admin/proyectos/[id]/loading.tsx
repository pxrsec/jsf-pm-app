import { Skeleton } from "@/components/ui/skeleton";

export default function AdminProjectDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="border-b border-border bg-card/60 pb-6 pt-4">
        <div className="container max-w-7xl mx-auto px-4 space-y-4">
          <Skeleton className="h-4 w-48" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-64" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-36" />
          </div>
        </div>
      </div>
      <div className="container max-w-7xl mx-auto px-4">
        <Skeleton className="h-10 w-80 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    </div>
  );
}
