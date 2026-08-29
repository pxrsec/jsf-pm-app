import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { normalizeCalendarRange } from "@/lib/calendar/date-utils";
import {
  fetchCalendarFeed,
  fetchMilestoneManagementTargets,
} from "@/lib/calendar/queries";
import type { MilestoneManagementTargetDto } from "@/lib/calendar/types";
import { CalendarCoordinator } from "./_components/calendar-coordinator";

interface CalendarPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    view?: string;
    from?: string;
    to?: string;
    projectId?: string;
  }>;
}

export default async function CalendarPage({
  params,
  searchParams,
}: CalendarPageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const t = await getTranslations({ locale, namespace: "calendar" });

  const range = normalizeCalendarRange(resolvedSearchParams);
  const canManageMilestones = session.role === "admin" || session.role === "pm";

  const [events, milestoneTargets] = await Promise.all([
    fetchCalendarFeed(supabase, {
      from: range.from,
      to: range.to,
      projectId: range.projectId,
    }),
    canManageMilestones
      ? fetchMilestoneManagementTargets(supabase)
      : Promise.resolve<MilestoneManagementTargetDto[]>([]),
  ]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {/* Calendar Interactive Coordinator */}
      <CalendarCoordinator
        initialEvents={events}
        initialRange={range}
        milestoneTargets={milestoneTargets}
        canManageMilestones={canManageMilestones}
        userRole={session.role}
      />
    </div>
  );
}
