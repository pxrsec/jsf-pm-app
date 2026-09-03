export type { AvailableResult } from "@/lib/clients/types";

export type InvitationLinkLocale = "es-MX" | "en-US";

export type OrdinaryInvitationRole = "client" | "operator";

export type OrdinaryInvitationStatus =
  "pending" | "accepted" | "expired" | "revoked";

export type OrdinaryInvitationCursor = {
  beforeCreatedAt: string;
  beforeInvitationId: string;
};

export type OrdinaryInvitationListItemDto = {
  invitationId: string;
  role: OrdinaryInvitationRole;
  status: OrdinaryInvitationStatus;
  recipientLabel: string;
  contactId: string | null;
  projectId: string | null;
  projectName: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

export type OrdinaryInvitationPageDto = {
  items: OrdinaryInvitationListItemDto[];
  nextCursor: OrdinaryInvitationCursor | null;
};

export type CreateInvitationResultDto = {
  invitationId: string;
  role: OrdinaryInvitationRole;
  expiresAt: string;
  invitationUrl: string;
};

export type RevokeInvitationResultDto = {
  changed: boolean;
  invitationId: string;
  invitationStatus: OrdinaryInvitationStatus;
};

export type InvitationActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: "UNAUTHORIZED" | "VALIDATION_FAILED" | "UNAVAILABLE" };
