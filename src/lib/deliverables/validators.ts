/**
 * Google Drive URL validator.
 *
 * Mirrors the server-side SQL check in private.is_valid_production_google_drive_submission_url():
 *   - Byte length <= 2048 bytes
 *   - No whitespace or ASCII control characters
 *   - No backslashes
 *   - No explicit port (e.g. :443 or :8080)
 *   - Starts with https://(drive.google.com|docs.google.com)/
 *
 * Used in client-side Zod schema validation and server-side validation.
 * The database trigger is the authoritative boundary; this provides matching lexical feedback.
 *
 * NEVER: fetch, resolve, preview, download, proxy, or request the URL. Validation is lexical only.
 */
export const GOOGLE_DRIVE_URL_REGEX =
  /^https:\/\/(drive\.google\.com|docs\.google\.com)\//i;

export function isValidGoogleDriveUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;

  // 1. Raw byte length <= 2048 bytes
  const byteLength = new TextEncoder().encode(url).length;
  if (byteLength > 2048) return false;

  // 2. Reject raw whitespace (spaces, tabs, newlines) or ASCII control characters
  if (/[\s\x00-\x1F\x7F]/.test(url)) return false;

  // 3. Reject backslashes
  if (url.includes("\\")) return false;

  // 4. Reject explicit port in authority (e.g. :443 or :8080) before URL normalization
  if (/^https:\/\/[^/]+:[0-9]+/i.test(url)) return false;

  // 5. Must strictly match the accepted domain prefix
  if (!GOOGLE_DRIVE_URL_REGEX.test(url)) return false;

  // 6. Parse with URL to ensure valid absolute URL and check components
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname !== "drive.google.com" && hostname !== "docs.google.com")
      return false;
    if (parsed.username !== "" || parsed.password !== "") return false;
    if (parsed.port !== "") return false;
    if (
      !parsed.pathname ||
      !parsed.pathname.startsWith("/") ||
      parsed.pathname.length < 1
    )
      return false;
  } catch {
    return false;
  }

  return true;
}
