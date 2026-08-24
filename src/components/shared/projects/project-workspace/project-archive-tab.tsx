"use client";

import type {
  FinalizedArchivePage,
  FinalizedArchiveQuery,
} from "@/lib/archive/types";
import { ArchiveFilterBar } from "@/components/shared/archive/archive-filter-bar";
import { ArchiveListView } from "@/components/shared/archive/archive-list-view";

interface ProjectArchiveTabProps {
  projectId: string;
  initialArchivePage: FinalizedArchivePage;
  currentQuery: FinalizedArchiveQuery;
}

export function ProjectArchiveTab({
  projectId,
  initialArchivePage,
  currentQuery,
}: ProjectArchiveTabProps) {
  const isFiltered = Boolean(currentQuery.status);

  return (
    <div className="space-y-4">
      <ArchiveFilterBar
        currentStatus={currentQuery.status}
        currentFrom={currentQuery.from}
        currentTo={currentQuery.to}
        currentProjectId={projectId}
        paramPrefix="archive"
      />

      <ArchiveListView
        initialPage={initialArchivePage}
        currentQuery={currentQuery}
        isFiltered={isFiltered}
      />
    </div>
  );
}
