/**
 * Google Drive URL validator.
 *
 * Mirrors the server-side SQL check in submit_deliverable_version:
 *   p_submission_url ~* '^https://(drive\.google\.com|docs\.google\.com)/'
 *
 * Used in both client-side Zod schema validation and server-side Zod validation.
 * The server RPC is the authoritative boundary; this is a complement.
 *
 * NEVER: fetch, resolve, or request the URL. Validation is lexical only.
 */
export const GOOGLE_DRIVE_URL_REGEX =
  /^https:\/\/(drive\.google\.com|docs\.google\.com)\//i;

export function isValidGoogleDriveUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  return GOOGLE_DRIVE_URL_REGEX.test(url.trim());
}
