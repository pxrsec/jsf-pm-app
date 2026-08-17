import { z } from "zod";

const serverConfigSchema = z.object({
  SUPABASE_SECRET_KEY: z
    .string({
      required_error: "SUPABASE_SECRET_KEY is required",
    })
    .min(1, "SUPABASE_SECRET_KEY must not be empty"),
});

function parseServerConfig() {
  const result = serverConfigSchema.safeParse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => err.message)
      .join(", ");
    throw new Error(`Server configuration error: ${errorDetails}`);
  }

  const secret = result.data.SUPABASE_SECRET_KEY;

  return {
    get supabaseSecretKey(): string {
      return secret;
    },
    toJSON() {
      return { supabaseSecretKey: "[REDACTED]" };
    },
    toString() {
      return "[serverConfig]";
    },
  };
}

export const serverConfig = parseServerConfig();

export function toString() {
  return "[serverConfig module]";
}
