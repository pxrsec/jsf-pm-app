import type { Database } from "@/lib/database.types";

export type SubmissionProvider =
  Database["public"]["Enums"]["submission_provider"];

export type ClientUrlValidationResult =
  | { ok: true; provider: SubmissionProvider }
  | { ok: false; reason: ClientUrlValidationReason };

export type ClientUrlValidationReason =
  | "TOO_LONG"
  | "INVALID_CHARACTERS"
  | "CONTAINS_BACKSLASH"
  | "INVALID_URL_SYNTAX";

const MAX_OCTET_LENGTH = 2048;

/**
 * Exact PostgreSQL regex equivalent:
 * ^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?([/?#][^[:space:][:cntrl:]]*)?$
 */
const CLIENT_SUBMISSION_URL_REGEX =
  /^https:\/\/([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?([/?#][^\s\x00-\x1F\x7F]*)?$/i;

/**
 * Pure lexical validation of a Client-submitted external URL.
 * Strictly mirrors PostgreSQL `private.is_valid_client_submission_url` and
 * `private.classify_client_submission_provider` without performing any network dereference.
 */
export function validateClientSubmissionUrl(
  raw: string,
): ClientUrlValidationResult {
  if (typeof raw !== "string") {
    return { ok: false, reason: "INVALID_URL_SYNTAX" };
  }

  // 1. Byte length check (<= 2048 bytes in UTF-8)
  const byteLength = new TextEncoder().encode(raw).length;
  if (byteLength > MAX_OCTET_LENGTH) {
    return { ok: false, reason: "TOO_LONG" };
  }

  // 2. Reject whitespace and control characters anywhere in the raw value
  if (/[\s\x00-\x1F\x7F]/.test(raw)) {
    return { ok: false, reason: "INVALID_CHARACTERS" };
  }

  // 3. Reject backslash character
  if (raw.includes("\\")) {
    return { ok: false, reason: "CONTAINS_BACKSLASH" };
  }

  // 4. Match authoritative URL syntax
  if (!CLIENT_SUBMISSION_URL_REGEX.test(raw)) {
    return { ok: false, reason: "INVALID_URL_SYNTAX" };
  }

  const provider = classifyClientSubmissionProvider(raw);
  return { ok: true, provider };
}

/**
 * Classifies the provider based purely on the host component of the lexically valid URL.
 * Mirrors PostgreSQL `private.classify_client_submission_provider`.
 */
export function classifyClientSubmissionProvider(
  validUrl: string,
): SubmissionProvider {
  const match = validUrl.match(/^https:\/\/([^/?#]+)/i);
  if (!match) {
    return "other_https";
  }

  const host = match[1].toLowerCase();

  if (host === "drive.google.com" || host === "docs.google.com") {
    return "google_drive";
  }

  if (host === "dropbox.com" || host.endsWith(".dropbox.com")) {
    return "dropbox";
  }

  if (
    host === "onedrive.live.com" ||
    host.endsWith(".onedrive.live.com") ||
    host === "1drv.ms" ||
    host.endsWith(".1drv.ms")
  ) {
    return "onedrive";
  }

  if (
    host === "wetransfer.com" ||
    host.endsWith(".wetransfer.com") ||
    host === "we.tl" ||
    host.endsWith(".we.tl")
  ) {
    return "wetransfer";
  }

  if (
    host === "frame.io" ||
    host.endsWith(".frame.io") ||
    host === "f.io" ||
    host.endsWith(".f.io")
  ) {
    return "frame_io";
  }

  return "other_https";
}
