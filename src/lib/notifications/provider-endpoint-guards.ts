import "server-only";

import { NextResponse } from "next/server";

/**
 * Normative future activation order (non-operational in S06-06):
 * 1. A separately accepted activation ADR/runbook explicitly permits one named endpoint.
 * 2. A server-only activation gate permits only the approved target environment.
 * 3. Read raw request bytes exactly once, with a bounded body-size policy.
 * 4. Verify provider-specific signature/authentication and replay policy against server-only secrets.
 * 5. Parse and validate the authenticated payload using the then-current contract.
 * 6. Invoke one idempotent authoritative database command or receipt boundary.
 * 7. Return the provider-approved acknowledgement without leaking internal state.
 */

/**
 * Non-operational future activation seam ensuring authenticated request validation
 * precedes side-effect command execution.
 * Module-private; not exported to browser, shared, or route modules in S06-06.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type VerifiedProviderRequest<TPayload> = Readonly<{
  payload: TPayload;
}>;

/**
 * Rejects requests to inactive external provider endpoints with a uniform,
 * non-enumerating 404 response in accordance with ADR-024 and S06-06.
 */
export function rejectInactiveProviderEndpoint(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "not_found",
        message: "Not found",
      },
      request_id: globalThis.crypto.randomUUID(),
    },
    { status: 404 },
  );
}
