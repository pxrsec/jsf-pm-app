import { createClient } from "@supabase/supabase-js";
import { appConfig } from "@/config/app.config";
import { serverConfig } from "@/config/server.config";

// Privileged Supabase client factory using SUPABASE_SECRET_KEY for server-only operations
export function createAdminClient() {
  return createClient(appConfig.supabaseUrl, serverConfig.supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
