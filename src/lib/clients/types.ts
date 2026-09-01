export type ClientContactAdministrationDto = {
  id: string;
  clientId: string | null;
  profileId: string | null;
  fullName: string;
  email: string;
  phoneE164: string | null;
  jobTitle: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClientOrganizationAdministrationDto = {
  id: string;
  displayName: string;
  slug: string;
};

export type ClientManagementProjectDto = {
  id: string;
  name: string;
};

export type AvailableResult<T> =
  { status: "available"; data: T } | { status: "unavailable" };

export type ClientAdministrationActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: "UNAUTHORIZED" | "VALIDATION_FAILED" | "UNAVAILABLE" };
