import { type NextRequest, NextResponse } from "next/server";
import { rejectInactiveProviderEndpoint } from "@/lib/notifications/provider-endpoint-guards";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function GET(_request: NextRequest): NextResponse {
  return rejectInactiveProviderEndpoint();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function POST(_request: NextRequest): NextResponse {
  return rejectInactiveProviderEndpoint();
}
