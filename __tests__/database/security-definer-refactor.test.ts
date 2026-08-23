import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("S07-M0-SD: Candidate Migration Static Source Contract Verification", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const candidateMigrationPath = path.resolve(
    repoRoot,
    "supabase/migrations/20260823130000_s07_m0_security_definer_command_hardening.sql",
  );

  it("1. Candidate migration file exists and is non-empty", () => {
    expect(fs.existsSync(candidateMigrationPath)).toBe(true);
    const content = fs.readFileSync(candidateMigrationPath, "utf-8");
    expect(content.trim().length).toBeGreaterThan(0);
  });

  it("2. Migration is transactionally wrapped with begin and commit", () => {
    const content = fs.readFileSync(candidateMigrationPath, "utf-8");
    expect(content).toMatch(/^\s*begin\s*;/im);
    expect(content).toMatch(/commit\s*;\s*$/im);
  });

  const targetFunctions = [
    {
      name: "accept_invite",
      signature: "public.accept_invite(p_token_hash bytea)",
      grantSig: "public.accept_invite(bytea)",
    },
    {
      name: "mark_notification_read",
      signature:
        "public.mark_notification_read(p_notification_recipient_id uuid)",
      grantSig: "public.mark_notification_read(uuid)",
    },
    {
      name: "mark_all_notifications_read",
      signature: "public.mark_all_notifications_read()",
      grantSig: "public.mark_all_notifications_read()",
    },
    {
      name: "soft_delete_entity",
      signature:
        "public.soft_delete_entity(p_entity_type public.entity_type, p_entity_id uuid, p_reason text default null)",
      grantSig: "public.soft_delete_entity(public.entity_type, uuid, text)",
    },
    {
      name: "restore_entity",
      signature:
        "public.restore_entity(p_entity_type public.entity_type, p_entity_id uuid, p_reason text default null)",
      grantSig: "public.restore_entity(public.entity_type, uuid, text)",
    },
    {
      name: "reopen_client_deliverable",
      signature:
        "public.reopen_client_deliverable(p_deliverable_id uuid, p_reason text)",
      grantSig: "public.reopen_client_deliverable(uuid, text)",
    },
    {
      name: "recover_project_status",
      signature:
        "public.recover_project_status(p_project_id uuid, p_target_status public.project_status, p_reason text)",
      grantSig:
        "public.recover_project_status(uuid, public.project_status, text)",
    },
  ];

  it("3. Defines exactly the 7 target routines with SECURITY DEFINER and hardened search_path", () => {
    const content = fs.readFileSync(candidateMigrationPath, "utf-8");

    for (const fn of targetFunctions) {
      // Check function creation
      const createRegex = new RegExp(
        `create\\s+or\\s+replace\\s+function\\s+public\\.${fn.name}\\b`,
        "i",
      );
      expect(
        createRegex.test(content),
        `Missing CREATE OR REPLACE for ${fn.name}`,
      ).toBe(true);

      // Check grants and revokes
      const revokePublicRegex = new RegExp(
        `revoke\\s+all\\s+on\\s+function\\s+public\\.${fn.name}\\([^)]*\\)\\s+from\\s+public\\s*;`,
        "i",
      );
      const revokeAnonRegex = new RegExp(
        `revoke\\s+all\\s+on\\s+function\\s+public\\.${fn.name}\\([^)]*\\)\\s+from\\s+anon\\s*;`,
        "i",
      );
      const grantAuthRegex = new RegExp(
        `grant\\s+execute\\s+on\\s+function\\s+public\\.${fn.name}\\([^)]*\\)\\s+to\\s+authenticated\\s*;`,
        "i",
      );
      const grantServiceRegex = new RegExp(
        `grant\\s+execute\\s+on\\s+function\\s+public\\.${fn.name}\\([^)]*\\)\\s+to\\s+service_role\\s*;`,
        "i",
      );

      expect(
        revokePublicRegex.test(content),
        `Missing revoke from public for ${fn.name}`,
      ).toBe(true);
      expect(
        revokeAnonRegex.test(content),
        `Missing revoke from anon for ${fn.name}`,
      ).toBe(true);
      expect(
        grantAuthRegex.test(content),
        `Missing grant to authenticated for ${fn.name}`,
      ).toBe(true);
      expect(
        grantServiceRegex.test(content),
        `Missing grant to service_role for ${fn.name}`,
      ).toBe(true);
    }
  });

  describe("R1 — accept_invite Error Non-Enumeration Contract", () => {
    it("uses non-enumerating error message without interpolating email variables", () => {
      const content = fs.readFileSync(candidateMigrationPath, "utf-8");
      // Extract accept_invite function body
      const fnMatch = content.match(
        /create\s+or\s+replace\s+function\s+public\.accept_invite[\s\S]*?\$function\$;/i,
      );
      expect(fnMatch).not.toBeNull();
      const fnBody = fnMatch![0];

      // Must NOT interpolate email in exception
      expect(fnBody).not.toMatch(/raise\s+exception\s+'[^']*%.*v_user_email/i);
      expect(fnBody).not.toMatch(
        /raise\s+exception\s+'[^']*%.*v_invite\.email/i,
      );

      // Must use static stable non-enumerating message
      expect(fnBody).toContain(
        "raise exception 'Invitation does not belong to the authenticated user'",
      );

      // Must qualify citext as extensions.citext
      expect(fnBody).toContain("v_user_email extensions.citext;");
    });
  });

  describe("R2 — Notification Read Explicit Actor Null Guard Contract", () => {
    it("mark_notification_read explicitly binds auth.uid() and guards against null session", () => {
      const content = fs.readFileSync(candidateMigrationPath, "utf-8");
      const fnMatch = content.match(
        /create\s+or\s+replace\s+function\s+public\.mark_notification_read[\s\S]*?\$function\$;/i,
      );
      expect(fnMatch).not.toBeNull();
      const fnBody = fnMatch![0];

      expect(fnBody).toContain("v_user_id uuid := auth.uid();");
      expect(fnBody).toMatch(
        /if\s+v_user_id\s+is\s+null\s+then\s+raise\s+exception\s+'Authentication required'\s*;/i,
      );
      expect(fnBody).toContain("and user_id = v_user_id");
      expect(fnBody).toContain("get diagnostics v_count = row_count;");
      expect(fnBody).toContain("return v_count > 0;");
    });

    it("mark_all_notifications_read explicitly binds auth.uid() and guards against null session", () => {
      const content = fs.readFileSync(candidateMigrationPath, "utf-8");
      const fnMatch = content.match(
        /create\s+or\s+replace\s+function\s+public\.mark_all_notifications_read[\s\S]*?\$function\$;/i,
      );
      expect(fnMatch).not.toBeNull();
      const fnBody = fnMatch![0];

      expect(fnBody).toContain("v_user_id uuid := auth.uid();");
      expect(fnBody).toMatch(
        /if\s+v_user_id\s+is\s+null\s+then\s+raise\s+exception\s+'Authentication required'\s*;/i,
      );
      expect(fnBody).toContain("where user_id = v_user_id");
      expect(fnBody).toContain("get diagnostics v_count = row_count;");
      expect(fnBody).toContain("return v_count;");
    });
  });

  describe("R3 — Administrative Entity Commands Closed Allowlist & ROW_COUNT Contract", () => {
    const expectedAllowlist = [
      "profile",
      "client",
      "project",
      "project_member",
      "task",
      "deliverable",
      "calendar_event",
      "collaboration_comment",
    ];

    it("soft_delete_entity maps all 8 allowlisted entities, fails closed, and checks ROW_COUNT", () => {
      const content = fs.readFileSync(candidateMigrationPath, "utf-8");
      const fnMatch = content.match(
        /create\s+or\s+replace\s+function\s+public\.soft_delete_entity[\s\S]*?\$function\$;/i,
      );
      expect(fnMatch).not.toBeNull();
      const fnBody = fnMatch![0];

      // Admin check
      expect(fnBody).toContain("private.is_admin()");

      // Immutable check
      expect(fnBody).toContain(
        "'audit_log', 'notification', 'deliverable_version', 'feedback', 'invite_token', 'link_report'",
      );

      // All 8 entities present
      for (const ent of expectedAllowlist) {
        expect(fnBody).toContain(`when '${ent}' then`);
      }

      // Fail-closed ELSE branch
      expect(fnBody).toMatch(
        /else\s+raise\s+exception\s+'Entity type % is not supported for soft delete'/i,
      );

      // Parameterized update with %I and USING
      expect(fnBody).toContain("%I set deleted_at = now(), updated_at = now()");
      expect(fnBody).toContain("using p_entity_id;");

      // Row count inspection and no-op return false
      expect(fnBody).toContain("get diagnostics v_row_count = row_count;");
      expect(fnBody).toMatch(
        /if\s+v_row_count\s*=\s*0\s+then\s+return\s+false\s*;/i,
      );
      expect(fnBody).toContain("return true;");
    });

    it("restore_entity maps all 8 allowlisted entities, fails closed, and checks ROW_COUNT", () => {
      const content = fs.readFileSync(candidateMigrationPath, "utf-8");
      const fnMatch = content.match(
        /create\s+or\s+replace\s+function\s+public\.restore_entity[\s\S]*?\$function\$;/i,
      );
      expect(fnMatch).not.toBeNull();
      const fnBody = fnMatch![0];

      // Admin check
      expect(fnBody).toContain("private.is_admin()");

      // Immutable check
      expect(fnBody).toContain(
        "'audit_log', 'notification', 'deliverable_version', 'feedback', 'invite_token', 'link_report'",
      );

      // All 8 entities present
      for (const ent of expectedAllowlist) {
        expect(fnBody).toContain(`when '${ent}' then`);
      }

      // Fail-closed ELSE branch
      expect(fnBody).toMatch(
        /else\s+raise\s+exception\s+'Entity type % is not supported for restore'/i,
      );

      // Parameterized update with %I and USING
      expect(fnBody).toContain("%I set deleted_at = null, updated_at = now()");
      expect(fnBody).toContain("using p_entity_id;");

      // Row count inspection and no-op return false
      expect(fnBody).toContain("get diagnostics v_row_count = row_count;");
      expect(fnBody).toMatch(
        /if\s+v_row_count\s*=\s*0\s+then\s+return\s+false\s*;/i,
      );
      expect(fnBody).toContain("return true;");
    });
  });

  describe("R4 — reopen_client_deliverable Redundant Check Removal Contract", () => {
    it("reopen_client_deliverable does not call is_project_lead with deliverable ID before loading row", () => {
      const content = fs.readFileSync(candidateMigrationPath, "utf-8");
      const fnMatch = content.match(
        /create\s+or\s+replace\s+function\s+public\.reopen_client_deliverable[\s\S]*?\$function\$;/i,
      );
      expect(fnMatch).not.toBeNull();
      const fnBody = fnMatch![0];

      // Dead pre-load check must be absent
      expect(fnBody).not.toContain("is_project_lead(p_deliverable_id)");

      // Post-load check with loaded project_id must be present
      expect(fnBody).toContain("private.is_project_lead(v_deliv.project_id)");
      expect(fnBody).toContain("v_deliv.workflow_type <> 'client_submission'");
      expect(fnBody).toContain("v_deliv.status <> 'submitted'");
    });
  });

  describe("R5 — recover_project_status Target-State Policy Contract", () => {
    it("enforces allowed recovery targets ('planning', 'in_progress', 'paused') and rejects terminal targets", () => {
      const content = fs.readFileSync(candidateMigrationPath, "utf-8");
      const fnMatch = content.match(
        /create\s+or\s+replace\s+function\s+public\.recover_project_status[\s\S]*?\$function\$;/i,
      );
      expect(fnMatch).not.toBeNull();
      const fnBody = fnMatch![0];

      // Admin check
      expect(fnBody).toContain("private.is_admin()");

      // Target status allowlist validation
      expect(fnBody).toMatch(
        /if\s+p_target_status\s+not\s+in\s*\(\s*'planning'\s*,\s*'in_progress'\s*,\s*'paused'\s*\)\s+then/i,
      );

      // Must set completed_at to null on recovery
      expect(fnBody).toContain("completed_at = null");
    });
  });
});
