import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");
const readMigration = (name: string) =>
  fs.readFileSync(path.join(repoRoot, "supabase/migrations", name), "utf-8");

describe("S07 E09 candidate migration source contracts", () => {
  const m1 = readMigration(
    "20260823140000_s07_e09_calendar-role-safe-feed-and-milestones.sql",
  );
  const m2 = readMigration(
    "20260823141000_s07_e09_finalized-production-archive-and-link-incidents.sql",
  );
  const m3 = readMigration(
    "20260823142000_s07_e09_scoped-operations-metrics-and-admin-projections.sql",
  );
  const m1r = readMigration(
    "20260823144000_s07_e09_calendar-task-scoped-milestones-and-pm-authority.sql",
  );
  const m4 = readMigration(
    "20260824080000_s07_e09_notification_history_window_and_filters.sql",
  );
  const m5 = readMigration(
    "20260824110000_s07_e09_scoped-operations-metrics-trend-projection.sql",
  );

  it("uses append-only transactional sources", () => {
    for (const source of [m1, m2, m3, m1r, m4, m5]) {
      expect(source).toMatch(/^\s*begin\s*;/im);
      expect(source).toMatch(/commit\s*;\s*$/im);
      expect(source).not.toMatch(/drop\s+table|truncate\s+table/i);
    }
  });

  it("M1 establishes authenticated role-safe calendar and command boundaries", () => {
    for (const fn of [
      "list_role_safe_calendar_events",
      "create_calendar_milestone",
      "update_calendar_milestone",
      "soft_delete_calendar_milestone",
    ]) {
      expect(m1).toMatch(
        new RegExp(`create\\s+function\\s+public\\.${fn}`, "i"),
      );
      expect(m1).toMatch(
        new RegExp(
          `revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*?from\\s+public`,
          "i",
        ),
      );
      expect(m1).toMatch(
        new RegExp(
          `grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*?to\\s+authenticated`,
          "i",
        ),
      );
    }
    expect(m1).toContain("set search_path = pg_catalog, public");
    expect(m1).toContain("Calendar range must not exceed 93 days");
    expect(m1).toContain(
      "revoke insert, update, delete on table public.calendar_events from authenticated",
    );
    for (const token of [
      "chart-1",
      "chart-2",
      "chart-3",
      "chart-4",
      "chart-5",
    ]) {
      expect(m1).toContain(`'${token}'`);
    }
  });

  it("M1-R reconciles task-scoped milestones and all-PM calendar authority", () => {
    expect(m1r).toContain(
      "add column task_id uuid references public.tasks(id)",
    );
    expect(m1r).toContain("calendar_events_task_scope_trg");
    expect(m1r).toContain(
      "Calendar milestone task must belong to the milestone project",
    );
    expect(m1r).toContain(
      "revoke select on table public.calendar_events from authenticated",
    );
    expect(m1r).toContain(
      "drop policy if exists calendar_events_select_policy",
    );
    expect(m1r).toContain("v_is_manager := v_role in ('admin', 'pm')");
    expect(m1r).toContain("and ce.task_id is not null");
    expect(m1r).toContain("and t.assignee_id = v_user_id");

    for (const fn of [
      "list_role_safe_calendar_events",
      "list_calendar_milestone_targets",
      "get_calendar_milestone_for_edit",
      "create_calendar_milestone",
      "update_calendar_milestone",
      "soft_delete_calendar_milestone",
    ]) {
      expect(m1r).toMatch(
        new RegExp(`create\\s+function\\s+public\\.${fn}`, "i"),
      );
      expect(m1r).toMatch(
        new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}`, "i"),
      );
    }

    expect(m1r).toContain("project_name text");
    expect(m1r).toContain("Descriptions are deliberately absent from all feed");
    expect(m1r).not.toMatch(/create\s+index/i);
  });

  it("M2 confines archive and link incidents to purpose-limited read functions", () => {
    for (const fn of [
      "list_finalized_production_archive",
      "list_role_safe_link_incidents",
    ]) {
      expect(m2).toMatch(
        new RegExp(`create\\s+function\\s+public\\.${fn}`, "i"),
      );
      expect(m2).toMatch(new RegExp(`security\\s+definer`, "i"));
      expect(m2).toMatch(
        new RegExp(
          `revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*?from\\s+anon`,
          "i",
        ),
      );
    }
    expect(m2).toContain("d.workflow_type = 'production'");
    expect(m2).toContain("d.status in ('approved', 'delivered')");
    expect(m2).toContain("v_is_operator and d.assignee_id = v_user_id");
    expect(m2).toContain("Link incident date range cannot exceed 93 days");
    expect(m2).not.toMatch(/update\s+public\.deliverable_link_reports/i);
  });

  it("M3 is read-only and excludes environment/configuration mutation", () => {
    for (const fn of [
      "get_scoped_operations_metrics",
      "list_admin_audit_history",
      "list_admin_user_invitation_state",
    ]) {
      expect(m3).toMatch(
        new RegExp(`create\\s+function\\s+public\\.${fn}`, "i"),
      );
      expect(m3).toMatch(
        new RegExp(
          `grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*?to\\s+authenticated`,
          "i",
        ),
      );
    }
    expect(m3).toContain("Admin access required");
    expect(m3).toContain("Audit range must not exceed 93 days");
    expect(m3).not.toMatch(/\b(insert|update|delete)\s+(into\s+)?public\./i);
    expect(m3).not.toMatch(/current_setting|pg_read_file|alter\s+system/i);
  });

  it("M4 replaces recipient inbox with purpose-limited 90-day history window and filters", () => {
    expect(m4).toMatch(
      /drop\s+function\s+public\.list_my_in_app_notifications/i,
    );
    expect(m4).toMatch(
      /create\s+function\s+public\.list_my_in_app_notifications\s*\(\s*p_limit\s+integer\s+default\s+25,\s*p_from\s+timestamptz\s+default\s+null,\s*p_to\s+timestamptz\s+default\s+null,\s*p_read_state\s+boolean\s+default\s+null,\s*p_before_created_at\s+timestamptz\s+default\s+null,\s*p_before_recipient_id\s+uuid\s+default\s+null\s*\)/i,
    );
    expect(m4).toContain("Authentication with an active profile is required");
    expect(m4).toContain("Notification history range cannot exceed 93 days");
    expect(m4).toContain(
      "Notification history range start must precede its end",
    );
    expect(m4).toContain("Notification history cursor is incomplete");
    expect(m4).toContain("set search_path = pg_catalog, public");
    expect(m4).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.list_my_in_app_notifications[\s\S]*?from\s+public/i,
    );
    expect(m4).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.list_my_in_app_notifications[\s\S]*?from\s+anon/i,
    );
    expect(m4).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.list_my_in_app_notifications[\s\S]*?to\s+authenticated/i,
    );
    expect(m4).toContain(
      "create index if not exists notification_recipients_in_app_history_keyset_idx",
    );
  });

  it("M5 provides bounded role-safe operational metric trend projection", () => {
    expect(m5).toMatch(
      /create\s+function\s+public\.list_scoped_operations_metric_trend/i,
    );
    expect(m5).toContain("Authentication required");
    expect(m5).toContain("Active profile required");
    expect(m5).toContain("Metrics range requires both p_from and p_to");
    expect(m5).toContain("Metrics range start must precede its end");
    expect(m5).toContain("Metrics range must not exceed 93 days");
    expect(m5).toContain("A permitted project is required for PM metrics");
    expect(m5).toContain("Project metrics are not permitted for this caller");
    expect(m5).toContain("private.is_project_pm(p_project_id)");
    expect(m5).toContain("generate_series(");
    expect(m5).toContain("interval '7 days'");
    expect(m5).toContain("set search_path = pg_catalog, public");
    expect(m5).toContain(
      "alter function public.list_scoped_operations_metric_trend",
    );
    expect(m5).toContain("owner to postgres");
    expect(m5).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.list_scoped_operations_metric_trend[\s\S]*?from\s+public/i,
    );
    expect(m5).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.list_scoped_operations_metric_trend[\s\S]*?from\s+anon/i,
    );
    expect(m5).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.list_scoped_operations_metric_trend[\s\S]*?to\s+authenticated/i,
    );
    expect(m5).not.toMatch(/\b(insert|update|delete)\s+(into\s+)?public\./i);
    expect(m5).not.toMatch(
      /^\s*create\s+(table|view|index|unique\s+index)\b/im,
    );
    expect(m5).not.toMatch(/current_setting|pg_read_file|alter\s+system/i);
  });
});
