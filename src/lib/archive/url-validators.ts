import { isValidGoogleDriveUrl } from "@/lib/deliverables/validators";

/**
 * Validates and sanitizes a production deliverable Google Drive submission URL.
 * Fails closed: returns null if missing, malformed, or not a valid Google Drive HTTPS share link.
 * NEVER fetches, probes, previews, downloads, or proxies the URL.
 */
export function sanitizeSubmissionUrl(
  url: string | null | undefined,
): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!isValidGoogleDriveUrl(trimmed)) return null;
  return trimmed;
}

/**
 * Validates and sanitizes a Google Drive or project external folder HTTPS URL.
 * Rejects non-HTTPS schemes, credentials (user:pass), explicit ports, whitespace, or invalid syntax.
 * Fails closed: returns null on any invalid URL.
 */
export function sanitizeDriveFolderUrl(
  url: string | null | undefined,
): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();

  // 1. Max byte length 2048
  const byteLength = new TextEncoder().encode(trimmed).length;
  if (byteLength > 2048) return null;

  // 2. Reject whitespace, control characters, backslashes
  if (/[\s\x00-\x1F\x7F]/.test(trimmed) || trimmed.includes("\\")) return null;

  // 3. Reject explicit port in authority
  if (/^https:\/\/[^/]+:[0-9]+/i.test(trimmed)) return null;

  // 4. Must start with https://
  if (!trimmed.startsWith("https://")) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username !== "" || parsed.password !== "") return null;
    if (parsed.port !== "") return null;
    if (!parsed.hostname || parsed.hostname.includes(" ")) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
