import type { Database } from "@/lib/database.types";
import type { AppRole } from "@/lib/auth/routes";

export type EntityType = Database["public"]["Enums"]["entity_type"];
export type InviteStatus = Database["public"]["Enums"]["invite_status"];

export type AdminAuditItemDto = Readonly<{
  createdAt: string;
  action: string;
  entityType: EntityType;
  projectName: string | null;
  actorRole: AppRole | null;
  oldStatus: string | null;
  newStatus: string | null;
  changedFieldSummary: string | null;
}>;

export type AdminAuditCursor = Readonly<{
  beforeCreatedAt: string;
  beforeAuditId: number;
}>;

export type AdminAuditPage = Readonly<{
  items: readonly AdminAuditItemDto[];
  nextCursor: AdminAuditCursor | null;
  hasMore: boolean;
}>;

export type AdminProfileStateItem = Readonly<{
  kind: "profile";
  createdAt: string;
  fullName: string;
  applicationRole: AppRole;
  isActive: boolean;
  preferredLocale: "es-MX" | "en-US" | null;
  emailNotificationsEnabled: boolean;
  whatsappOptIn: boolean;
  lastSeenAt: string | null;
}>;

export type AdminInvitationStateItem = Readonly<{
  kind: "invitation";
  createdAt: string;
  applicationRole: AppRole;
  invitationStatus: InviteStatus;
  projectName: string | null;
  invitationExpiresAt: string | null;
  invitationAcceptedAt: string | null;
  invitationRevokedAt: string | null;
}>;

export type AdminUserInvitationStateItem =
  AdminProfileStateItem | AdminInvitationStateItem;

export type AdminUserInvitationCursor = Readonly<{
  beforeCreatedAt: string;
  beforeProfileId: string;
}>;

export type AdminUserInvitationPage = Readonly<{
  items: readonly AdminUserInvitationStateItem[];
  nextCursor: AdminUserInvitationCursor | null;
  hasMore: boolean;
}>;

export type AdminSectionResult<T> =
  | { status: "available"; data: T }
  | { status: "unavailable"; code: "UNAVAILABLE" };

export type AdminDiagnosticItem = Readonly<{
  capability: "localDemoPosture" | "externalDelivery";
  state:
    | "local_demo"
    | "inactive"
    | "activation_prerequisites_incomplete"
    | "configuration_requires_review";
}>;

export type AdminDiagnostics = readonly [
  AdminDiagnosticItem,
  AdminDiagnosticItem,
];

export type AdminAuditQuery = Readonly<{
  from: string;
  to: string;
}>;
