export type FinalizedArchiveStatus = "approved" | "delivered";

export type LinkIncidentStatus = "open" | "resolved" | "dismissed";

export type ArchiveProjectFilterOption = Readonly<{
  id: string;
  name: string;
}>;

export type FinalizedArchiveItem = Readonly<{
  deliverableId: string;
  projectId: string | null;
  projectHref: string | null;
  deliverableTitle: string;
  finalStatus: FinalizedArchiveStatus;
  currentVersionNumber: number;
  finalizedAt: string;
  projectName: string;
  projectDriveFolderUrl: string | null;
  currentSubmissionUrl: string | null;
}>;

export type FinalizedArchiveCursor = Readonly<{
  beforeFinalizedAt: string;
  beforeDeliverableId: string;
}>;

export type FinalizedArchivePage = Readonly<{
  items: readonly FinalizedArchiveItem[];
  nextCursor: FinalizedArchiveCursor | null;
  hasMore: boolean;
}>;

export type FinalizedArchiveQuery = Readonly<{
  from: string;
  to: string;
  status?: FinalizedArchiveStatus;
  projectId?: string;
}>;

export type LinkIncidentItem = Readonly<{
  incidentId: string;
  deliverableId: string;
  projectId: string;
  projectHref: string | null;
  deliverableTitle: string;
  projectName: string;
  incidentStatus: LinkIncidentStatus;
  reportedAt: string;
  resolvedAt: string | null;
  reason: string | null;
  resolutionNote: string | null;
}>;

export type LinkIncidentCursor = Readonly<{
  beforeReportedAt: string;
  beforeIncidentId: string;
}>;

export type LinkIncidentPage = Readonly<{
  items: readonly LinkIncidentItem[];
  nextCursor: LinkIncidentCursor | null;
  hasMore: boolean;
}>;

export type LinkIncidentQuery = Readonly<{
  from: string;
  to: string;
  status?: LinkIncidentStatus;
  projectId?: string;
}>;
