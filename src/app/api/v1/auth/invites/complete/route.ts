import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { appConfig } from "@/config/app.config";
import { CompleteInviteSchema } from "@/lib/validation/auth";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { hashInvitationToken } from "@/lib/invitations/crypto";
import { logger } from "@/lib/logger";

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

const AcceptInviteRpcResultSchema = z.object({
  success: z.literal(true),
  role: z.enum(["client", "operator"]),
  project_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  // 1. Validate Origin header
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

  // 2. Parse and validate request body
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

  const { token, full_name, password, phone_e164, whatsapp_opt_in } =
    parseResult.data;

  // 3. Hash token server-side via canonical helper
  const byteaHash = hashInvitationToken(token);

  // 4. Query invite_tokens row using server admin client
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

  // 5. Create Supabase Auth user via admin client
  const { data: userData, error: createUserError } =
    await adminClient.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

  if (createUserError || !userData?.user?.id) {
    const errorMsg = createUserError?.message?.toLowerCase() ?? "";
    const isConflict =
      errorMsg.includes("already registered") ||
      errorMsg.includes("already been registered") ||
      errorMsg.includes("already exists") ||
      (createUserError as { status?: number })?.status === 422;

    if (isConflict) {
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

    return NextResponse.json(
      {
        error: {
          code: "unavailable",
          message: "Unable to create authentication account.",
        },
        request_id: requestId,
      },
      { status: 503 },
    );
  }

  const createdUserId = userData.user.id;

  // 6. Establish authenticated server session
  const cookieStore = await cookies();
  const userClient = createClient(cookieStore);

  const { error: signInError } = await userClient.auth.signInWithPassword({
    email: invite.email,
    password,
  });

  if (signInError) {
    // Bounded compensation: delete newly created auth user only
    try {
      await adminClient.auth.admin.deleteUser(createdUserId);
    } catch (cleanupErr) {
      logger.error("Failed to clean up created auth user after sign-in error", {
        requestId,
        error: cleanupErr instanceof Error ? cleanupErr.message : "Unknown",
      });
    }
    if (typeof userClient?.auth?.signOut === "function") {
      await userClient.auth.signOut().catch(() => {});
    }

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

  // 7. Invoke four-argument accept_invite RPC
  const { data: rpcData, error: rpcError } = await userClient.rpc(
    "accept_invite",
    {
      p_token_hash: byteaHash,
      p_full_name: full_name,
      p_phone_e164: phone_e164 ?? null,
      p_whatsapp_opt_in: whatsapp_opt_in,
    },
  );

  if (rpcError) {
    // Bounded compensation: delete newly created auth user only
    try {
      await adminClient.auth.admin.deleteUser(createdUserId);
    } catch (cleanupErr) {
      logger.error("Failed to clean up created auth user after RPC failure", {
        requestId,
        error: cleanupErr instanceof Error ? cleanupErr.message : "Unknown",
      });
    }
    if (typeof userClient?.auth?.signOut === "function") {
      await userClient.auth.signOut().catch(() => {});
    }

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

  // 8. Validate return payload shape and role
  const validationResult = AcceptInviteRpcResultSchema.safeParse(rpcData);
  if (!validationResult.success) {
    // Bounded compensation
    try {
      await adminClient.auth.admin.deleteUser(createdUserId);
    } catch (cleanupErr) {
      logger.error(
        "Failed to clean up created auth user after invalid RPC response",
        {
          requestId,
          error: cleanupErr instanceof Error ? cleanupErr.message : "Unknown",
        },
      );
    }
    await userClient.auth.signOut().catch(() => {});

    return NextResponse.json(
      {
        error: {
          code: "unavailable",
          message: "Invalid response from acceptance command.",
        },
        request_id: requestId,
      },
      { status: 503 },
    );
  }

  const validatedRole = validationResult.data.role;
  const redirectPath = ROLE_DEFAULT_PATHS[validatedRole] ?? "/iniciar-sesion";

  return NextResponse.json(
    {
      data: {
        redirect_path: redirectPath,
      },
    },
    { status: 201 },
  );
}
