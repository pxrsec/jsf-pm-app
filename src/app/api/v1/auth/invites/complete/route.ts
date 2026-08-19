import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { appConfig } from "@/config/app.config";
import { CompleteInviteSchema } from "@/lib/validation/auth";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";

function isValidOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const expectedUrl = new URL(appConfig.appUrl);
    // Exact origin match
    if (originUrl.origin === expectedUrl.origin) return true;
    // Allow localhost in development
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

  const parseResult = CompleteInviteSchema.safeParse(body);
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

  const { token, full_name, password, phone_e164 } = parseResult.data;

  // 4. Hash token server-side (SHA-256 -> bytea format)
  const tokenHashHex = crypto.createHash("sha256").update(token).digest("hex");
  const byteaHash = `\\x${tokenHashHex}`;

  // 5. Query invite_tokens row using server admin client
  const adminClient = createAdminClient();
  const { data: invite, error: inviteError } = await adminClient
    .from("invite_tokens")
    .select("*")
    .eq("token_hash", byteaHash)
    .maybeSingle();

  if (inviteError || !invite) {
    return NextResponse.json(
      {
        error: {
          code: "invite_terminal",
          message: "Invitation is expired, revoked, or already consumed.",
        },
        request_id: requestId,
      },
      { status: 410 },
    );
  }

  // Check status, expiry, revocation
  if (
    invite.status !== "pending" ||
    invite.revoked_at !== null ||
    new Date(invite.expires_at) <= new Date()
  ) {
    return NextResponse.json(
      {
        error: {
          code: "invite_terminal",
          message: "Invitation is expired, revoked, or already consumed.",
        },
        request_id: requestId,
      },
      { status: 410 },
    );
  }

  // 6. Create Supabase Auth user via admin client
  const { data: userData, error: createUserError } =
    await adminClient.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

  if (createUserError || !userData.user) {
    // If user already exists in auth.users
    return NextResponse.json(
      {
        error: {
          code: "conflict",
          message: "An account with this email address already exists.",
        },
        request_id: requestId,
      },
      { status: 409 },
    );
  }

  const userId = userData.user.id;

  // 7. Establish authenticated server session and call accept_invite RPC
  const cookieStore = await cookies();
  const userClient = createClient(cookieStore);

  const { error: signInError } = await userClient.auth.signInWithPassword({
    email: invite.email,
    password,
  });

  if (signInError) {
    return NextResponse.json(
      {
        error: {
          code: "authentication_failed",
          message: "Failed to establish session for new user",
        },
        request_id: requestId,
      },
      { status: 500 },
    );
  }

  // Call accept_invite RPC
  const { error: rpcError } = await userClient.rpc("accept_invite", {
    p_token_hash: byteaHash,
  });

  if (rpcError) {
    return NextResponse.json(
      {
        error: {
          code: "invite_terminal",
          message: "Invitation could not be accepted.",
        },
        request_id: requestId,
      },
      { status: 410 },
    );
  }

  // Update profile details (phone_e164, full_name)
  if (phone_e164) {
    await userClient
      .from("profiles")
      .update({ phone_e164, full_name })
      .eq("id", userId);
  }

  const role = invite.role as keyof typeof ROLE_DEFAULT_PATHS;
  const redirectPath = ROLE_DEFAULT_PATHS[role] ?? "/iniciar-sesion";

  return NextResponse.json(
    {
      data: {
        user_id: userId,
        redirect_path: redirectPath,
      },
    },
    { status: 201 },
  );
}
