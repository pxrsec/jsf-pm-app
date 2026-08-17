import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { appConfig } from "@/config/app.config";

export interface CookieStore {
  getAll: () =>
    | { name: string; value: string }[]
    | Promise<{ name: string; value: string }[]>;
  setAll?: (
    cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
  ) => void | Promise<void>;
}

export function createClient(cookieStore: CookieStore) {
  return createServerClient(
    appConfig.supabaseUrl,
    appConfig.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          if (cookieStore.setAll) {
            cookieStore.setAll(cookiesToSet);
          }
        },
      },
    },
  );
}
