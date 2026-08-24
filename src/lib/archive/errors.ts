export type ArchiveErrorCode =
  "VALIDATION_FAILED" | "UNAUTHENTICATED" | "UNAVAILABLE";

export class ArchiveError extends Error {
  readonly code: ArchiveErrorCode;

  constructor(code: ArchiveErrorCode, message: string) {
    super(message);
    this.name = "ArchiveError";
    this.code = code;
  }
}
