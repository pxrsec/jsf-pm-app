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

  it("uses append-only transactional sources", () => {
    for (const source of [m1, m2, m3]) {
      expect(source).toMatch(/^\s*begin\s*;/im);
      expect(source).toMatch(/commit\s*;\s*$/im);
      expect(source).not.toMatch(/drop\s+table|truncate\s+table/i);
      expect(source).not.toMatch(/create\s+index/i);
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
});
