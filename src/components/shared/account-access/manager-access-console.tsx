"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { UserAccessDirectoryPanel } from "./user-access-directory-panel";
import { StaleAccessPanel } from "./stale-access-panel";
import { BugReportsPanel } from "./bug-reports-panel";
import type {
  AvailableResult,
  UserAccessDirectoryPageDto,
  StaleAccessCandidateDto,
  BugReportPageDto,
  DateTimePresentationContext,
} from "@/lib/account-access/types";

export interface ManagerAccessConsoleProps {
  initialDirectory: AvailableResult<UserAccessDirectoryPageDto>;
  initialStale: AvailableResult<readonly StaleAccessCandidateDto[]>;
  initialBugReports: AvailableResult<BugReportPageDto>;
  presentation: DateTimePresentationContext;
}

export function ManagerAccessConsole({
  initialDirectory,
  initialStale,
  initialBugReports,
  presentation,
}: ManagerAccessConsoleProps) {
  const t = useTranslations("accountAccess");

  return (
    <div
      className="space-y-8 max-w-6xl px-4 py-6 sm:px-6 lg:px-8"
      data-testid="manager-access-console"
    >
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("managerConsole.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("managerConsole.description")}
        </p>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList
          aria-label={t("managerConsole.tabsAriaLabel")}
          className="grid w-full sm:w-auto grid-cols-3 h-auto p-1"
        >
          <TabsTrigger
            value="users"
            className="min-h-[44px] text-xs sm:text-sm"
          >
            {t("managerConsole.tabs.users")}
          </TabsTrigger>
          <TabsTrigger
            value="stale"
            className="min-h-[44px] text-xs sm:text-sm"
          >
            {t("managerConsole.tabs.stale")}
          </TabsTrigger>
          <TabsTrigger value="bugs" className="min-h-[44px] text-xs sm:text-sm">
            {t("managerConsole.tabs.bugs")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="focus-visible:outline-none">
          <UserAccessDirectoryPanel
            initialResult={initialDirectory}
            presentation={presentation}
          />
        </TabsContent>

        <TabsContent value="stale" className="focus-visible:outline-none">
          <StaleAccessPanel
            initialResult={initialStale}
            presentation={presentation}
          />
        </TabsContent>

        <TabsContent value="bugs" className="focus-visible:outline-none">
          <BugReportsPanel
            initialResult={initialBugReports}
            presentation={presentation}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
