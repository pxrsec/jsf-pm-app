import { z } from "zod";

const publicConfigSchema = z.object({
  NEXT_PUBLIC_APP_URL: z
    .string({
      required_error: "NEXT_PUBLIC_APP_URL is required",
    })
    .min(1, "NEXT_PUBLIC_APP_URL must not be empty"),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({
      required_error: "NEXT_PUBLIC_SUPABASE_URL is required",
    })
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return parsed.protocol === "https:";
        } catch {
          return false;
        }
      },
      {
        message: "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL",
      },
    ),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string({
      required_error: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required",
    })
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must not be empty"),
});

function parsePublicConfig() {
  const result = publicConfigSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => err.message)
      .join(", ");
    throw new Error(`Public configuration error: ${errorDetails}`);
  }

  return {
    appUrl: result.data.NEXT_PUBLIC_APP_URL,
    supabaseUrl: result.data.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: result.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export const appConfig = parsePublicConfig();

export function toString() {
  return "[appConfig module]";
}
