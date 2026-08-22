import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listRecipientInboxPage } from "@/lib/notifications/queries";
import { NotificationInbox } from "./_components/notification-inbox";

export default async function NotificationsPage() {
  const cookieStore = await cookies();
  await requireSession(cookieStore);

  const t = await getTranslations("notifications");
  const supabase = createClient(cookieStore);
  const initialPage = await listRecipientInboxPage(supabase);

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>

      <NotificationInbox initialPage={initialPage} />
    </div>
  );
}
