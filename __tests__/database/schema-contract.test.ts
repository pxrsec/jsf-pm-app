import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { Constants } from "@/lib/database.types";

describe("S02-E02-03: Static Schema Contract Verification", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const migrationPath = path.resolve(
    repoRoot,
    "supabase/migrations/20260818143500_s02_e02_authoritative_data_platform.sql",
  );
  const typesPath = path.resolve(repoRoot, "src/lib/database.types.ts");
  const packageJsonPath = path.resolve(repoRoot, "package.json");

  it("migration and database.types.ts files exist", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(fs.existsSync(typesPath)).toBe(true);
  });

  describe("Public Tables Verification (18 tables)", () => {
    const expectedTables = [
      "profiles",
      "clients",
      "client_contacts",
      "projects",
      "project_members",
      "tasks",
      "task_resources",
      "deliverables",
      "deliverable_versions",
      "deliverable_feedback",
      "collaboration_comments",
      "calendar_events",
      "deliverable_link_reports",
      "invite_tokens",
      "notification_events",
      "notification_recipients",
      "whatsapp_templates",
      "audit_logs",
    ];

    it("migration SQL creates all 18 public tables", () => {
      const migrationContent = fs.readFileSync(migrationPath, "utf-8");
      for (const table of expectedTables) {
        const createTableRegex = new RegExp(
          `CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+(?:public\\.)?${table}\\b`,
          "i",
        );
        expect(
          createTableRegex.test(migrationContent),
          `Missing CREATE TABLE for ${table} in migration`,
        ).toBe(true);
      }
    });

    it("database.types.ts defines Row, Insert, and Update for all 18 tables", () => {
      const typesContent = fs.readFileSync(typesPath, "utf-8");
      for (const table of expectedTables) {
        expect(
          typesContent.includes(`${table}: {`),
          `Missing table entry for ${table} in database.types.ts`,
        ).toBe(true);
      }
    });
  });

  describe("Schema Enums Verification (22 enums)", () => {
    const expectedEnums: Record<string, readonly string[]> = {
      app_role: ["admin", "pm", "operator", "client"],
      calendar_event_type: [
        "project_deadline",
        "task_deadline",
        "internal_review_deadline",
        "client_delivery_deadline",
        "milestone",
      ],
      collaboration_author_capacity: [
        "admin",
        "pm_lead",
        "pm_watcher",
        "operator",
      ],
      collaboration_target_type: ["project", "task", "deliverable"],
      deliverable_status: [
        "pending",
        "awaiting_internal_review",
        "awaiting_client_review",
        "approved",
        "changes_requested",
        "delivered",
        "submitted",
      ],
      deliverable_workflow_type: ["production", "client_submission"],
      entity_type: [
        "profile",
        "client",
        "project",
        "project_member",
        "task",
        "deliverable",
        "deliverable_version",
        "feedback",
        "calendar_event",
        "notification",
        "invite_token",
        "collaboration_comment",
        "link_report",
      ],
      invite_status: ["pending", "accepted", "expired", "revoked"],
      link_report_status: ["open", "resolved", "dismissed"],
      notification_channel: ["in_app", "whatsapp", "email"],
      notification_delivery_status: [
        "pending",
        "processing",
        "sent",
        "delivered",
        "read",
        "failed",
        "cancelled",
      ],
      notification_trigger: [
        "user_invited",
        "project_assigned",
        "task_assigned",
        "task_status_changed",
        "client_task_blocking",
        "client_submission_received",
        "client_submission_reopened",
        "deliverable_submitted",
        "internal_changes_requested",
        "internal_review_approved",
        "client_changes_requested",
        "client_review_approved",
        "deliverable_delivered",
        "deadline_24h",
        "deadline_12h",
        "deadline_6h",
        "deadline_overdue",
        "review_inactivity_reminder",
        "link_reported_broken",
        "invite_expiring",
        "system",
      ],
      project_member_type: ["pm_lead", "pm_watcher", "operator", "client"],
      project_status: [
        "planning",
        "in_progress",
        "paused",
        "completed",
        "cancelled",
      ],
      project_type: ["client", "internal"],
      review_decision: ["approved", "changes_requested"],
      review_stage: ["internal", "client"],
      submission_provider: [
        "google_drive",
        "dropbox",
        "onedrive",
        "wetransfer",
        "frame_io",
        "other_https",
      ],
      task_priority: ["low", "medium", "high", "blocking"],
      task_status: [
        "pending",
        "in_progress",
        "in_review",
        "completed",
        "blocked",
      ],
      task_type: ["internal_work", "client_request"],
      whatsapp_template_status: [
        "draft",
        "pending_approval",
        "approved",
        "paused",
        "rejected",
        "disabled",
      ],
    };

    it("migration SQL creates all 22 enums with exact scoped values in declaration blocks", () => {
      const migrationContent = fs.readFileSync(migrationPath, "utf-8");
      for (const [enumName, values] of Object.entries(expectedEnums)) {
        const createEnumRegex = new RegExp(
          `CREATE\\s+TYPE\\s+(?:public\\.)?${enumName}\\s+AS\\s+ENUM\\s*\\(([^)]+)\\)`,
          "i",
        );
        const match = migrationContent.match(createEnumRegex);
        expect(
          match,
          `Missing CREATE TYPE ${enumName} AS ENUM declaration block in migration`,
        ).not.toBeNull();

        const enumBlock = match![1];
        for (const val of values) {
          expect(
            enumBlock.includes(`'${val}'`),
            `Missing value '${val}' inside enum declaration block for ${enumName}`,
          ).toBe(true);
        }
      }
    });

    it("Constants.public.Enums in database.types.ts matches all 22 enums and values", () => {
      const actualEnums = Constants.public.Enums;
      expect(Object.keys(actualEnums).sort()).toEqual(
        Object.keys(expectedEnums).sort(),
      );

      for (const [enumName, values] of Object.entries(expectedEnums)) {
        const actualValues = actualEnums[enumName as keyof typeof actualEnums];
        expect(actualValues).toBeDefined();
        expect([...actualValues].sort()).toEqual([...values].sort());
      }
    });
  });

  describe("Security-Invoker Views Verification (9 views)", () => {
    const expectedViews = [
      "operator_agenda_view",
      "client_project_view",
      "client_task_view",
      "client_submission_view",
      "client_deliverable_view",
      "calendar_feed_view",
      "deliverable_cycle_metrics_view",
      "notification_unread_counts_view",
      "project_completion_cycles_view",
    ];

    it("migration SQL creates all 9 views explicitly declaring WITH (security_invoker = true)", () => {
      const migrationContent = fs.readFileSync(migrationPath, "utf-8");
      for (const view of expectedViews) {
        const createViewRegex = new RegExp(
          `CREATE\\s+(?:OR\\s+REPLACE\\s+)?VIEW\\s+(?:public\\.)?${view}\\s+WITH\\s*\\(\\s*security_invoker\\s*=\\s*true\\s*\\)`,
          "i",
        );
        expect(
          createViewRegex.test(migrationContent),
          `Missing CREATE VIEW for ${view} explicitly declared WITH (security_invoker = true) in migration`,
        ).toBe(true);
      }
    });

    it("database.types.ts exposes all 9 views", () => {
      const typesContent = fs.readFileSync(typesPath, "utf-8");
      for (const view of expectedViews) {
        expect(
          typesContent.includes(`${view}: {`),
          `Missing view entry for ${view} in database.types.ts`,
        ).toBe(true);
      }
    });
  });

  describe("Public RPC Functions Verification (16 functions)", () => {
    const expectedPublicFunctions = [
      "accept_invite",
      "get_project_completion_readiness",
      "transition_project_status",
      "recover_project_status",
      "transition_task_status",
      "submit_deliverable_version",
      "review_deliverable",
      "mark_deliverable_delivered",
      "submit_client_deliverable",
      "reopen_client_deliverable",
      "create_collaboration_comment",
      "report_broken_link",
      "mark_notification_read",
      "mark_all_notifications_read",
      "soft_delete_entity",
      "restore_entity",
    ];

    it("migration SQL creates all 16 public RPC functions", () => {
      const migrationContent = fs.readFileSync(migrationPath, "utf-8");
      for (const fn of expectedPublicFunctions) {
        const createFnRegex = new RegExp(
          `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(?:public\\.)?${fn}\\b`,
          "i",
        );
        expect(
          createFnRegex.test(migrationContent),
          `Missing CREATE FUNCTION for public RPC ${fn} in migration`,
        ).toBe(true);
      }
    });

    it("database.types.ts exposes all 16 public RPC functions", () => {
      const typesContent = fs.readFileSync(typesPath, "utf-8");
      for (const fn of expectedPublicFunctions) {
        expect(
          typesContent.includes(`${fn}: {`),
          `Missing public RPC function ${fn} in database.types.ts`,
        ).toBe(true);
      }
    });
  });

  describe("Prisma Total Absence Verification", () => {
    it("package.json contains zero prisma or @prisma/* dependencies", () => {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
        ...pkg.optionalDependencies,
      };
      for (const dep of Object.keys(allDeps)) {
        expect(dep.toLowerCase()).not.toContain("prisma");
      }
    });

    it("no prisma directory or *.prisma schema files exist across the workspace", () => {
      const prismaDirPath = path.resolve(repoRoot, "prisma");
      expect(fs.existsSync(prismaDirPath)).toBe(false);

      function findPrismaFiles(dir: string): string[] {
        const results: string[] = [];
        const ignored = new Set([
          "node_modules",
          ".next",
          ".git",
          "dist",
          "build",
          ".agents",
          ".codegraph",
        ]);
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            if (!ignored.has(entry.name)) {
              results.push(...findPrismaFiles(path.join(dir, entry.name)));
            }
          } else if (entry.name.endsWith(".prisma")) {
            results.push(path.join(dir, entry.name));
          }
        }
        return results;
      }

      const prismaFiles = findPrismaFiles(repoRoot);
      expect(prismaFiles).toEqual([]);
    });

    it("no runtime Prisma imports or instantiations exist in application or script code", () => {
      const scanDirs = ["src", "scripts", "supabase"];
      const codeExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".sql"];
      const forbiddenPatterns = [
        /@prisma\/client/i,
        /from\s+["']prisma["']/i,
        /require\(["']@?prisma["']\)/i,
        /new\s+PrismaClient/i,
      ];

      const violations: string[] = [];

      for (const dirName of scanDirs) {
        const fullDirPath = path.resolve(repoRoot, dirName);
        if (!fs.existsSync(fullDirPath)) continue;

        function scan(dir: string) {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const p = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              scan(p);
            } else if (codeExtensions.some((ext) => entry.name.endsWith(ext))) {
              const content = fs.readFileSync(p, "utf-8");
              for (const pattern of forbiddenPatterns) {
                if (pattern.test(content)) {
                  violations.push(`${p} matched pattern ${pattern}`);
                }
              }
            }
          }
        }

        scan(fullDirPath);
      }

      expect(violations).toEqual([]);
    });
  });
});
