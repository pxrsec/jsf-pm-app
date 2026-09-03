import { createHash } from "node:crypto";

/**
 * Computes the canonical SHA-256 bytea hash string for an invitation token.
 * Output format is `\x<64-char-hex>`.
 */
export function hashInvitationToken(token: string): string {
  const hex = createHash("sha256").update(token).digest("hex");
  return `\\x${hex}`;
}
