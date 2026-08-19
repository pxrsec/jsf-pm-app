import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { appConfig } from "@/config/app.config";
import { MagicLinkSchema } from "@/lib/validation/auth";

function isValidOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const expectedUrl = new URL(appConfig.appUrl);
    if (originUrl.origin === expectedUrl.origin) return true;
    if (
      process.env.NODE_ENV !== "production" &&
      (originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  // 1. Validate Idempotency-Key header
  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (
    !idempotencyKey ||
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 128
  ) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "A valid Idempotency-Key header (16-128 chars) is required",
        },
        request_id: requestId,
      },
      { status: 400 },
    );
  }

  // 2. Validate Origin header
  const origin = request.headers.get("Origin");
  if (origin && !isValidOrigin(origin)) {
    return NextResponse.json(
      {
        error: {
          code: "forbidden",
          message: "Cross-origin requests are not allowed",
        },
        request_id: requestId,
      },
      { status: 403 },
    );
  }

  // 3. Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Malformed JSON payload",
        },
        request_id: requestId,
      },
      { status: 400 },
    );
  }

  const parseResult = MagicLinkSchema.safeParse(body);
  if (!parseResult.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parseResult.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = [];
      fieldErrors[path].push(issue.message);
    }
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Request validation failed",
          field_errors: fieldErrors,
        },
        request_id: requestId,
      },
      { status: 400 },
    );
  }

  const { email, redirect_path } = parseResult.data;

  // 4. Invoke Supabase signInWithOtp (existing accounts only: shouldCreateUser: false)
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const emailRedirectTo = redirect_path
    ? `${appConfig.appUrl}/api/auth/callback?next=${encodeURIComponent(redirect_path)}`
    : `${appConfig.appUrl}/api/auth/callback`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo,
    },
  });

  if (error) {
    // Check for rate limiting
    if (
      error.status === 429 ||
      error.message.toLowerCase().includes("rate limit") ||
      error.message.toLowerCase().includes("too many requests")
    ) {
      return NextResponse.json(
        {
          error: {
            code: "rate_limited",
            message: "Too many requests. Please wait before retrying.",
          },
          request_id: requestId,
        },
        { status: 429 },
      );
    }
    // For all other errors (e.g. user not found), return 202 to avoid account enumeration
  }

  // Account-enumeration safe generic 202 response
  return NextResponse.json(
    {
      data: {
        message: "If an account exists, a magic link has been sent.",
      },
    },
    { status: 202 },
  );
}
