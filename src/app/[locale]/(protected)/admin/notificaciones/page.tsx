import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { listSuppressedNotificationOperationsPage } from "@/lib/notifications/operations-queries";
import {
  isLocalNotificationDemoPosture,
  isNotificationDemoAlertEvaluationEnabled,
} from "@/lib/notifications/alert-evaluator";
import type { ManualAlertEvaluationControl } from "@/lib/notifications/alert-evaluator-schemas";
import { NotificationOperationsScreen } from "@/app/[locale]/(protected)/pm/notificaciones/_components/notification-operations-screen";

export default async function AdminNotificationOperationsPage() {
  const cookieStore = await cookies();
  const locale = await getLocale();
  const localePrefix = locale === "en-US" ? "/en" : "";

  const session = await requireSession(cookieStore);

  if (session.role !== "admin") {
    redirect(
      `${localePrefix}${ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion"}`,
    );
  }

  const supabase = createClient(cookieStore);

  let manualAlertEvaluation: ManualAlertEvaluationControl | undefined;
  if (
    isNotificationDemoAlertEvaluationEnabled() &&
    isLocalNotificationDemoPosture()
  ) {
    manualAlertEvaluation = { kind: "admin-global" };
  }

  const initialPage = await listSuppressedNotificationOperationsPage(supabase);

  return (
    <NotificationOperationsScreen
      initialPage={initialPage}
      manualAlertEvaluation={manualAlertEvaluation}
    />
  );
}
