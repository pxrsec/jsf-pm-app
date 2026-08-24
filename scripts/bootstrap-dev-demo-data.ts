/**
 * Joya Star Films PM App — Development Demo Data Bootstrap
 *
 * Reconciles persistent, idempotent synthetic development and localhost
 * demonstration data in `jsf-pm-dev` for UI/UX development, client walkthroughs,
 * and data plane verification.
 *
 * Exemption Note: This bootstrap script is an authorized tracked exception to
 * the 400-line limit to maintain a single, self-contained executable runnable via:
 *   npm run db:bootstrap
 */

import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const demoPassword = process.env.DEV_DEMO_PASSWORD;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error("❌ Missing required Supabase credentials in environment.");
  process.exit(1);
}

if (!demoPassword || demoPassword.trim() === "") {
  console.error(
    "❌ Missing required DEV_DEMO_PASSWORD environment variable.\n" +
      "Set DEV_DEMO_PASSWORD in your untracked .env.local file to bootstrap demo accounts.",
  );
  process.exit(1);
}

const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseSecretKey,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// =============================================================================
// Helper: Fail-Loud Assertion
// =============================================================================

function assertDbSuccess<T>(
  result: {
    data: T | null;
    error: { message: string; details?: string } | null;
  },
  context: string,
): T {
  if (result.error) {
    const errorDetails = result.error.details
      ? ` (${result.error.details})`
      : "";
    throw new Error(
      `[DB Failure] ${context}: ${result.error.message}${errorDetails}`,
    );
  }
  return result.data as T;
}

// =============================================================================
// Persona Definitions
// =============================================================================

type DemoPersona = {
  email: string;
  fullName: string;
  role: "admin" | "pm" | "operator" | "client";
  phone: string;
};

const DEMO_PERSONAS: DemoPersona[] = [
  {
    email: "demo-admin@demo.jsf.internal",
    fullName: "Demo Admin",
    role: "admin",
    phone: "+525500000001",
  },
  {
    email: "demo-pm-lead-a@demo.jsf.internal",
    fullName: "Demo PM Lead A",
    role: "pm",
    phone: "+525500000002",
  },
  {
    email: "demo-pm-lead-b@demo.jsf.internal",
    fullName: "Demo PM Lead B",
    role: "pm",
    phone: "+525500000003",
  },
  {
    email: "demo-watcher-a@demo.jsf.internal",
    fullName: "Demo Watcher A",
    role: "pm",
    phone: "+525500000004",
  },
  {
    email: "demo-operator-a@demo.jsf.internal",
    fullName: "Demo Operator A",
    role: "operator",
    phone: "+525500000005",
  },
  {
    email: "demo-operator-b@demo.jsf.internal",
    fullName: "Demo Operator B",
    role: "operator",
    phone: "+525500000006",
  },
  {
    email: "demo-client-a1@demo.jsf.internal",
    fullName: "Demo Client A1",
    role: "client",
    phone: "+525511223344",
  },
  {
    email: "demo-client-a2@demo.jsf.internal",
    fullName: "Demo Client A2",
    role: "client",
    phone: "+525522334455",
  },
  {
    email: "demo-client-b1@demo.jsf.internal",
    fullName: "Demo Client B1",
    role: "client",
    phone: "+525533445566",
  },
];

// =============================================================================
// Reconcilers
// =============================================================================

async function reconcileAuthUsers(): Promise<Record<string, string>> {
  console.log("👤 Reconciling synthetic demo Auth users and profiles...");
  const userMap: Record<string, string> = {};
  const { data: userListData, error: listError } =
    await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw new Error(`List users error: ${listError.message}`);

  const existingUsers = new Map(
    userListData.users.map((u) => [u.email?.toLowerCase(), u]),
  );

  for (const p of DEMO_PERSONAS) {
    const emailKey = p.email.toLowerCase();
    let userId: string;
    const existing = existingUsers.get(emailKey);

    if (existing) {
      userId = existing.id;
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        {
          password: demoPassword,
          email_confirm: true,
          user_metadata: { full_name: p.fullName },
        },
      );
      if (updateError) {
        throw new Error(
          `[Auth Failure] Update user ${p.email} (${userId}): ${updateError.message}`,
        );
      }
    } else {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: p.email,
        password: demoPassword,
        email_confirm: true,
        user_metadata: { full_name: p.fullName },
      });
      if (error || !created.user) {
        throw new Error(
          `[Auth Failure] Create user ${p.email}: ${error?.message}`,
        );
      }
      userId = created.user.id;
    }

    userMap[p.email] = userId;

    const upsertProfileResult = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          role: p.role,
          full_name: p.fullName,
          phone_e164: p.phone,
          is_active: true,
        },
        { onConflict: "id" },
      )
      .select("id")
      .single();

    assertDbSuccess(upsertProfileResult, `Upsert profile for ${p.email}`);
  }
  return userMap;
}

async function reconcileClientsAndContacts(
  adminId: string,
  userMap: Record<string, string>,
): Promise<Record<string, string>> {
  console.log("🏢 Reconciling demo client organizations and contacts...");
  const orgs = [
    {
      name: "Acme Corp",
      legalName: "Acme Corporation S.A. de C.V.",
      slug: "acme-corp",
      driveUrl: "https://drive.google.com/drive/folders/demo-acme-corp",
    },
    {
      name: "Starlight Media",
      legalName: "Starlight Media Group LLC",
      slug: "starlight-media",
      driveUrl: "https://drive.google.com/drive/folders/demo-starlight-media",
    },
  ];
  const orgMap: Record<string, string> = {};

  for (const org of orgs) {
    const existingOrgResult = await supabase
      .from("clients")
      .select("id")
      .eq("slug", org.slug)
      .maybeSingle();

    assertDbSuccess(existingOrgResult, `Query client org ${org.slug}`);

    if (existingOrgResult.data) {
      orgMap[org.slug] = existingOrgResult.data.id;
    } else {
      const createdOrgResult = await supabase
        .from("clients")
        .insert({
          display_name: org.name,
          legal_name: org.legalName,
          slug: org.slug,
          default_drive_folder_url: org.driveUrl,
          created_by: adminId,
          is_active: true,
        })
        .select("id")
        .single();

      const created = assertDbSuccess(
        createdOrgResult,
        `Create client org ${org.slug}`,
      );
      orgMap[org.slug] = created.id;
    }
  }

  // Reconcile client_contacts
  const contacts = [
    {
      clientId: orgMap["acme-corp"]!,
      profileId: userMap["demo-client-a1@demo.jsf.internal"]!,
      fullName: "Demo Client A1",
      email: "demo-client-a1@demo.jsf.internal",
      phone: "+525511223344",
      jobTitle: "Brand Director",
      isPrimary: true,
    },
    {
      clientId: orgMap["acme-corp"]!,
      profileId: userMap["demo-client-a2@demo.jsf.internal"]!,
      fullName: "Demo Client A2",
      email: "demo-client-a2@demo.jsf.internal",
      phone: "+525522334455",
      jobTitle: "Marketing Manager",
      isPrimary: false,
    },
    {
      clientId: orgMap["starlight-media"]!,
      profileId: userMap["demo-client-b1@demo.jsf.internal"]!,
      fullName: "Demo Client B1",
      email: "demo-client-b1@demo.jsf.internal",
      phone: "+525533445566",
      jobTitle: "Creative Director",
      isPrimary: true,
    },
  ];

  for (const c of contacts) {
    const existingContactResult = await supabase
      .from("client_contacts")
      .select("id")
      .eq("client_id", c.clientId)
      .eq("email", c.email)
      .maybeSingle();

    assertDbSuccess(
      existingContactResult,
      `Query client contact for ${c.email}`,
    );

    if (!existingContactResult.data) {
      const insertContactResult = await supabase
        .from("client_contacts")
        .insert({
          client_id: c.clientId,
          profile_id: c.profileId,
          full_name: c.fullName,
          email: c.email,
          phone_e164: c.phone,
          job_title: c.jobTitle,
          is_primary: c.isPrimary,
          created_by: adminId,
        })
        .select("id")
        .single();

      assertDbSuccess(
        insertContactResult,
        `Insert client contact for ${c.email}`,
      );
    }
  }

  return orgMap;
}

async function reconcileProjectsAndCorpus(
  users: Record<string, string>,
  orgs: Record<string, string>,
) {
  console.log(
    "📁 Reconciling reference projects, sandbox, tasks, deliverables, comments, notifications, and audits...",
  );
  const now = new Date();
  const ONE_DAY_MS = 86400000;
  const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;
  const NINETY_DAYS_MS = 90 * ONE_DAY_MS;
  const currentBucketEpoch = Math.floor(now.getTime() / THIRTY_DAYS_MS);

  function deterministicFixtureUuid(seed: string): string {
    const hex = createHash("sha256").update(seed).digest("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  }

  const adminId = users["demo-admin@demo.jsf.internal"]!;
  const pmLeadAId = users["demo-pm-lead-a@demo.jsf.internal"]!;
  const pmLeadBId = users["demo-pm-lead-b@demo.jsf.internal"]!;
  const watcherAId = users["demo-watcher-a@demo.jsf.internal"]!;
  const opAId = users["demo-operator-a@demo.jsf.internal"]!;
  const opBId = users["demo-operator-b@demo.jsf.internal"]!;
  const clientA1Id = users["demo-client-a1@demo.jsf.internal"]!;
  const clientA2Id = users["demo-client-a2@demo.jsf.internal"]!;
  const clientB1Id = users["demo-client-b1@demo.jsf.internal"]!;

  // ===========================================================================
  // 1. Reference Project 1: Acme Brand Relaunch (Active Multi-Lead Client Project)
  // ===========================================================================
  let p1Id: string;
  const p1ExistingResult = await supabase
    .from("projects")
    .select("id")
    .eq("name", "Acme Brand Relaunch")
    .maybeSingle();

  assertDbSuccess(p1ExistingResult, "Query Project 1 (Acme Brand Relaunch)");

  if (p1ExistingResult.data) {
    p1Id = p1ExistingResult.data.id;
  } else {
    const p1InsertResult = await supabase
      .from("projects")
      .insert({
        name: "Acme Brand Relaunch",
        client_id: orgs["acme-corp"],
        project_type: "client",
        status: "in_progress",
        internal_description:
          "Strategic Q3 Brand Relaunch Campaign for Acme Corp.",
        client_scope:
          "Deliver updated brand guidelines, promo teaser cut, and review asset submissions.",
        drive_folder_url:
          "https://drive.google.com/drive/folders/demo-acme-brand-relaunch",
        deadline_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        created_by: adminId,
      })
      .select("id")
      .single();

    const p1Created = assertDbSuccess(
      p1InsertResult,
      "Insert Project 1 (Acme Brand Relaunch)",
    );
    p1Id = p1Created.id;
  }

  // Memberships for Project 1
  const p1Members: Array<{
    userId: string;
    type: Database["public"]["Enums"]["project_member_type"];
    isPrimary: boolean;
  }> = [
    { userId: pmLeadAId, type: "pm_lead", isPrimary: true },
    { userId: pmLeadBId, type: "pm_lead", isPrimary: false },
    { userId: watcherAId, type: "pm_watcher", isPrimary: false },
    { userId: opAId, type: "operator", isPrimary: false },
    { userId: opBId, type: "operator", isPrimary: false },
    { userId: clientA1Id, type: "client", isPrimary: false },
    { userId: clientA2Id, type: "client", isPrimary: false },
  ];

  const missingP1Members = [];
  for (const m of p1Members) {
    const mExistingResult = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", p1Id)
      .eq("user_id", m.userId)
      .eq("member_type", m.type)
      .maybeSingle();

    assertDbSuccess(
      mExistingResult,
      `Query membership for user ${m.userId} on Project 1`,
    );

    if (!mExistingResult.data) {
      missingP1Members.push({
        project_id: p1Id,
        user_id: m.userId,
        member_type: m.type,
        is_primary: m.isPrimary,
        receives_notifications: true,
        created_by: adminId,
      });
    }
  }

  if (missingP1Members.length > 0) {
    const mInsertResult = await supabase
      .from("project_members")
      .insert(missingP1Members)
      .select("id");

    assertDbSuccess(
      mInsertResult,
      `Batch insert missing memberships on Project 1`,
    );
  }

  // Task 1: Brand Guidelines (Operator A, High Priority)
  let t1Id: string;
  const t1ExistingResult = await supabase
    .from("tasks")
    .select("id")
    .eq("project_id", p1Id)
    .eq("title", "Brand Identity Guidelines")
    .maybeSingle();

  assertDbSuccess(t1ExistingResult, "Query Task 1 (Brand Identity Guidelines)");

  if (t1ExistingResult.data) {
    t1Id = t1ExistingResult.data.id;
  } else {
    const t1InsertResult = await supabase
      .from("tasks")
      .insert({
        project_id: p1Id,
        title: "Brand Identity Guidelines",
        task_type: "internal_work",
        priority: "high",
        status: "in_progress",
        assignee_id: opAId,
        has_deliverables: true,
        description:
          "Develop comprehensive PDF brand guidelines covering typography and colors.",
        deadline_at: new Date(Date.now() + 10 * 86400000).toISOString(),
        created_by: pmLeadAId,
      })
      .select("id")
      .single();

    const t1Created = assertDbSuccess(
      t1InsertResult,
      "Insert Task 1 (Brand Identity Guidelines)",
    );
    t1Id = t1Created.id;
  }

  // Task Resource for Task 1
  const resExistingResult = await supabase
    .from("task_resources")
    .select("id")
    .eq("task_id", t1Id)
    .maybeSingle();

  assertDbSuccess(resExistingResult, "Query task resource for Task 1");

  if (!resExistingResult.data) {
    const resInsertResult = await supabase
      .from("task_resources")
      .insert({
        task_id: t1Id,
        name: "Brand Strategy Deck",
        url: "https://drive.google.com/drive/folders/demo-brand-strategy",
        created_by: pmLeadAId,
      })
      .select("id")
      .single();

    assertDbSuccess(resInsertResult, "Insert task resource for Task 1");
  }

  // Deliverable 1 under Task 1 (Production with Re-Review Cycle)
  let d1Id: string;
  const d1ExistingResult = await supabase
    .from("deliverables")
    .select("id")
    .eq("task_id", t1Id)
    .eq("title", "Brand Guidelines Master PDF")
    .maybeSingle();

  assertDbSuccess(
    d1ExistingResult,
    "Query Deliverable 1 (Brand Guidelines Master PDF)",
  );

  if (d1ExistingResult.data) {
    d1Id = d1ExistingResult.data.id;
  } else {
    const d1InsertResult = await supabase
      .from("deliverables")
      .insert({
        task_id: t1Id,
        project_id: p1Id,
        title: "Brand Guidelines Master PDF",
        workflow_type: "production",
        status: "awaiting_client_review",
        assignee_id: opAId,
        created_by: pmLeadAId,
        specifications: "Export PDF v1.7 RGB with embedded vector assets.",
        current_version_number: 2,
        internal_review_deadline_at: new Date(
          Date.now() + 4 * 86400000,
        ).toISOString(),
        client_delivery_deadline_at: new Date(
          Date.now() + 7 * 86400000,
        ).toISOString(),
      })
      .select("id")
      .single();

    const d1Created = assertDbSuccess(
      d1InsertResult,
      "Insert Deliverable 1 (Brand Guidelines Master PDF)",
    );
    d1Id = d1Created.id;
  }

  // Deliverable 1 Versions & Feedback
  let v1Id: string;
  const v1ExistingResult = await supabase
    .from("deliverable_versions")
    .select("id")
    .eq("deliverable_id", d1Id)
    .eq("version_number", 1)
    .maybeSingle();

  assertDbSuccess(v1ExistingResult, "Query Version 1 for Deliverable 1");

  if (v1ExistingResult.data) {
    v1Id = v1ExistingResult.data.id;
  } else {
    const v1InsertResult = await supabase
      .from("deliverable_versions")
      .insert({
        deliverable_id: d1Id,
        version_number: 1,
        submission_url:
          "https://drive.google.com/file/d/demo-brand-guidelines-v1/view",
        submission_provider: "google_drive",
        submission_note: "Initial draft of brand guidelines PDF.",
        submitted_by: opAId,
      })
      .select("id")
      .single();

    const v1Created = assertDbSuccess(
      v1InsertResult,
      "Insert Version 1 for Deliverable 1",
    );
    v1Id = v1Created.id;
  }

  const fb1ExistingResult = await supabase
    .from("deliverable_feedback")
    .select("id")
    .eq("version_id", v1Id)
    .maybeSingle();

  assertDbSuccess(fb1ExistingResult, "Query Feedback 1 for Version 1");

  if (!fb1ExistingResult.data) {
    const fb1InsertResult = await supabase
      .from("deliverable_feedback")
      .insert({
        deliverable_id: d1Id,
        version_id: v1Id,
        stage: "internal",
        decision: "changes_requested",
        reviewed_by: pmLeadAId,
        comments:
          "Page 4 primary hex colors require WCAG AA contrast adjustment.",
      })
      .select("id")
      .single();

    assertDbSuccess(fb1InsertResult, "Insert Feedback 1 for Version 1");
  }

  let v2Id: string;
  const v2ExistingResult = await supabase
    .from("deliverable_versions")
    .select("id")
    .eq("deliverable_id", d1Id)
    .eq("version_number", 2)
    .maybeSingle();

  assertDbSuccess(v2ExistingResult, "Query Version 2 for Deliverable 1");

  if (v2ExistingResult.data) {
    v2Id = v2ExistingResult.data.id;
  } else {
    const v2InsertResult = await supabase
      .from("deliverable_versions")
      .insert({
        deliverable_id: d1Id,
        version_number: 2,
        submission_url:
          "https://drive.google.com/file/d/demo-brand-guidelines-v2/view",
        submission_provider: "google_drive",
        submission_note: "Revision 2 with contrast-adjusted palette on page 4.",
        submitted_by: opAId,
      })
      .select("id")
      .single();

    const v2Created = assertDbSuccess(
      v2InsertResult,
      "Insert Version 2 for Deliverable 1",
    );
    v2Id = v2Created.id;
  }

  const fb2ExistingResult = await supabase
    .from("deliverable_feedback")
    .select("id")
    .eq("version_id", v2Id)
    .maybeSingle();

  assertDbSuccess(fb2ExistingResult, "Query Feedback 2 for Version 2");

  if (!fb2ExistingResult.data) {
    const fb2InsertResult = await supabase
      .from("deliverable_feedback")
      .insert({
        deliverable_id: d1Id,
        version_id: v2Id,
        stage: "internal",
        decision: "approved",
        reviewed_by: pmLeadAId,
        comments:
          "Internal review approved. Passed to Acme Corp for client review.",
      })
      .select("id")
      .single();

    assertDbSuccess(fb2InsertResult, "Insert Feedback 2 for Version 2");
  }

  // Task 2: Blocking Priority Task (Operator B) + Deliverable 2
  let t2Id: string;
  const t2ExistingResult = await supabase
    .from("tasks")
    .select("id")
    .eq("project_id", p1Id)
    .eq("title", "Hero Promo Video Production")
    .maybeSingle();

  assertDbSuccess(
    t2ExistingResult,
    "Query Task 2 (Hero Promo Video Production)",
  );

  if (t2ExistingResult.data) {
    t2Id = t2ExistingResult.data.id;
  } else {
    const t2InsertResult = await supabase
      .from("tasks")
      .insert({
        project_id: p1Id,
        title: "Hero Promo Video Production",
        task_type: "internal_work",
        priority: "blocking",
        status: "in_progress",
        assignee_id: opBId,
        has_deliverables: true,
        description:
          "Critical hero teaser production blocking marketing distribution.",
        deadline_at: new Date(Date.now() + 14 * 86400000).toISOString(),
        created_by: pmLeadAId,
      })
      .select("id")
      .single();

    const t2Created = assertDbSuccess(
      t2InsertResult,
      "Insert Task 2 (Hero Promo Video Production)",
    );
    t2Id = t2Created.id;
  }

  // Deliverable 2 under Task 2
  let d2Id: string;
  const d2ExistingResult = await supabase
    .from("deliverables")
    .select("id")
    .eq("task_id", t2Id)
    .eq("title", "Hero Promo Teaser Cut")
    .maybeSingle();

  assertDbSuccess(
    d2ExistingResult,
    "Query Deliverable 2 (Hero Promo Teaser Cut)",
  );

  if (d2ExistingResult.data) {
    d2Id = d2ExistingResult.data.id;
  } else {
    const d2InsertResult = await supabase
      .from("deliverables")
      .insert({
        task_id: t2Id,
        project_id: p1Id,
        title: "Hero Promo Teaser Cut",
        workflow_type: "production",
        status: "pending",
        assignee_id: opBId,
        created_by: pmLeadAId,
        specifications:
          "4K ProRes 422 HQ Master and 1080p H.264 Web Cut with color grading.",
        current_version_number: 1,
        internal_review_deadline_at: new Date(
          Date.now() + 8 * 86400000,
        ).toISOString(),
        client_delivery_deadline_at: new Date(
          Date.now() + 12 * 86400000,
        ).toISOString(),
      })
      .select("id")
      .single();

    const d2Created = assertDbSuccess(
      d2InsertResult,
      "Insert Deliverable 2 (Hero Promo Teaser Cut)",
    );
    d2Id = d2Created.id;
  }

  const v2_1ExistingResult = await supabase
    .from("deliverable_versions")
    .select("id")
    .eq("deliverable_id", d2Id)
    .eq("version_number", 1)
    .maybeSingle();

  assertDbSuccess(v2_1ExistingResult, "Query Version 1 for Deliverable 2");

  if (!v2_1ExistingResult.data) {
    const v2_1InsertResult = await supabase
      .from("deliverable_versions")
      .insert({
        deliverable_id: d2Id,
        version_number: 1,
        submission_url:
          "https://drive.google.com/file/d/demo-hero-promo-v1/view",
        submission_provider: "google_drive",
        submission_note: "Initial rough cut of 30-second hero promo teaser.",
        submitted_by: opBId,
      })
      .select("id")
      .single();

    assertDbSuccess(v2_1InsertResult, "Insert Version 1 for Deliverable 2");
  }

  // Task 3: Client Request Task (Client A1) with Client Submission Deliverable
  let t3Id: string;
  const t3ExistingResult = await supabase
    .from("tasks")
    .select("id")
    .eq("project_id", p1Id)
    .eq("title", "Client Vector Logo Assets")
    .maybeSingle();

  assertDbSuccess(t3ExistingResult, "Query Task 3 (Client Vector Logo Assets)");

  if (t3ExistingResult.data) {
    t3Id = t3ExistingResult.data.id;
  } else {
    const t3InsertResult = await supabase
      .from("tasks")
      .insert({
        project_id: p1Id,
        title: "Client Vector Logo Assets",
        task_type: "client_request",
        priority: "medium",
        status: "in_progress",
        assignee_id: clientA1Id,
        has_deliverables: true,
        description: "Acme Corp client upload of source SVG and AI vectors.",
        deadline_at: new Date(Date.now() + 5 * 86400000).toISOString(),
        created_by: pmLeadAId,
      })
      .select("id")
      .single();

    const t3Created = assertDbSuccess(
      t3InsertResult,
      "Insert Task 3 (Client Vector Logo Assets)",
    );
    t3Id = t3Created.id;
  }

  let d3Id: string;
  const d3ExistingResult = await supabase
    .from("deliverables")
    .select("id")
    .eq("task_id", t3Id)
    .eq("title", "Vector Logo Package")
    .maybeSingle();

  assertDbSuccess(
    d3ExistingResult,
    "Query Deliverable 3 (Vector Logo Package)",
  );

  if (d3ExistingResult.data) {
    d3Id = d3ExistingResult.data.id;
  } else {
    const d3InsertResult = await supabase
      .from("deliverables")
      .insert({
        task_id: t3Id,
        project_id: p1Id,
        title: "Vector Logo Package",
        workflow_type: "client_submission",
        status: "submitted",
        assignee_id: clientA1Id,
        created_by: clientA1Id,
        specifications: "Source AI/EPS/SVG vector formats.",
        current_version_number: 1,
        submission_deadline_at: new Date(
          Date.now() + 7 * 86400000,
        ).toISOString(),
      })
      .select("id")
      .single();

    const d3Created = assertDbSuccess(
      d3InsertResult,
      "Insert Deliverable 3 (Vector Logo Package)",
    );
    d3Id = d3Created.id;
  }

  const v3ExistingResult = await supabase
    .from("deliverable_versions")
    .select("id")
    .eq("deliverable_id", d3Id)
    .maybeSingle();

  assertDbSuccess(v3ExistingResult, "Query Version for Deliverable 3");

  if (!v3ExistingResult.data) {
    const v3InsertResult = await supabase
      .from("deliverable_versions")
      .insert({
        deliverable_id: d3Id,
        version_number: 1,
        submission_url:
          "https://wetransfer.com/downloads/demo-acme-logo-vectors",
        submission_provider: "wetransfer",
        submission_note: "Source vector logo files package.",
        submitted_by: clientA1Id,
      })
      .select("id")
      .single();

    assertDbSuccess(v3InsertResult, "Insert Version for Deliverable 3");
  }

  // Task 4: Low-Priority Task (Operator A)
  let t4Id: string;
  const t4ExistingResult = await supabase
    .from("tasks")
    .select("id")
    .eq("project_id", p1Id)
    .eq("title", "Brand Asset Archiving")
    .maybeSingle();

  assertDbSuccess(t4ExistingResult, "Query Task 4 (Brand Asset Archiving)");

  if (t4ExistingResult.data) {
    t4Id = t4ExistingResult.data.id;
  } else {
    const t4InsertResult = await supabase
      .from("tasks")
      .insert({
        project_id: p1Id,
        title: "Brand Asset Archiving",
        task_type: "internal_work",
        priority: "low",
        status: "in_progress",
        assignee_id: opAId,
        has_deliverables: false,
        description:
          "Cataloging and archiving prior brand vector assets and source raw files for historical reference.",
        deadline_at: new Date(Date.now() + 45 * 86400000).toISOString(),
        created_by: pmLeadAId,
      })
      .select("id")
      .single();

    const t4Created = assertDbSuccess(
      t4InsertResult,
      "Insert Task 4 (Brand Asset Archiving)",
    );
    t4Id = t4Created.id;
  }

  // ===========================================================================
  // 2. Reference Project 2: Internal Workflow Automation (Task-Only, No Client)
  // ===========================================================================
  let p2Id: string;
  const p2ExistingResult = await supabase
    .from("projects")
    .select("id")
    .eq("name", "Internal Workflow Automation")
    .maybeSingle();

  assertDbSuccess(
    p2ExistingResult,
    "Query Project 2 (Internal Workflow Automation)",
  );

  if (p2ExistingResult.data) {
    p2Id = p2ExistingResult.data.id;
  } else {
    const p2InsertResult = await supabase
      .from("projects")
      .insert({
        name: "Internal Workflow Automation",
        client_id: null,
        project_type: "internal",
        status: "in_progress",
        internal_description:
          "Internal tooling and QStash event orchestration.",
        deadline_at: new Date(Date.now() + 60 * 86400000).toISOString(),
        created_by: adminId,
      })
      .select("id")
      .single();

    const p2Created = assertDbSuccess(
      p2InsertResult,
      "Insert Project 2 (Internal Workflow Automation)",
    );
    p2Id = p2Created.id;
  }

  const p2Members = [
    { userId: pmLeadAId, type: "pm_lead" as const, isPrimary: true },
    { userId: opAId, type: "operator" as const, isPrimary: false },
  ];

  const missingP2Members = [];
  for (const m of p2Members) {
    const pm2ExistingResult = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", p2Id)
      .eq("user_id", m.userId)
      .maybeSingle();

    assertDbSuccess(
      pm2ExistingResult,
      `Query membership for user ${m.userId} on Project 2`,
    );

    if (!pm2ExistingResult.data) {
      missingP2Members.push({
        project_id: p2Id,
        user_id: m.userId,
        member_type: m.type,
        is_primary: m.isPrimary,
        receives_notifications: true,
        created_by: adminId,
      });
    }
  }

  if (missingP2Members.length > 0) {
    const pm2InsertResult = await supabase
      .from("project_members")
      .insert(missingP2Members)
      .select("id");

    assertDbSuccess(
      pm2InsertResult,
      `Batch insert missing memberships on Project 2`,
    );
  }

  // ===========================================================================
  // 3. Reference Project 3: Acme Commercial Q1 (Completed Client Project)
  // ===========================================================================
  let p3Id: string;
  const p3ExistingResult = await supabase
    .from("projects")
    .select("id")
    .eq("name", "Acme Commercial Q1")
    .maybeSingle();

  assertDbSuccess(p3ExistingResult, "Query Project 3 (Acme Commercial Q1)");

  if (p3ExistingResult.data) {
    p3Id = p3ExistingResult.data.id;
  } else {
    const completedAtIso = new Date(Date.now() - 30 * 86400000).toISOString();
    const p3InsertResult = await supabase
      .from("projects")
      .insert({
        name: "Acme Commercial Q1",
        client_id: orgs["acme-corp"],
        project_type: "client",
        status: "completed",
        internal_description: "Q1 broadcast and digital commercial delivery.",
        deadline_at: completedAtIso,
        completed_at: completedAtIso,
        created_by: adminId,
      })
      .select("id")
      .single();

    const p3Created = assertDbSuccess(
      p3InsertResult,
      "Insert Project 3 (Acme Commercial Q1)",
    );
    p3Id = p3Created.id;
  }

  const p3Members = [
    { userId: pmLeadAId, type: "pm_lead" as const, isPrimary: true },
    { userId: opAId, type: "operator" as const, isPrimary: false },
    { userId: clientA1Id, type: "client" as const, isPrimary: false },
  ];

  const missingP3Members = [];
  for (const m of p3Members) {
    const pm3ExistingResult = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", p3Id)
      .eq("user_id", m.userId)
      .maybeSingle();

    assertDbSuccess(
      pm3ExistingResult,
      `Query membership for user ${m.userId} on Project 3`,
    );

    if (!pm3ExistingResult.data) {
      missingP3Members.push({
        project_id: p3Id,
        user_id: m.userId,
        member_type: m.type,
        is_primary: m.isPrimary,
        receives_notifications: true,
        created_by: adminId,
      });
    }
  }

  if (missingP3Members.length > 0) {
    const pm3InsertResult = await supabase
      .from("project_members")
      .insert(missingP3Members)
      .select("id");

    assertDbSuccess(
      pm3InsertResult,
      `Batch insert missing memberships on Project 3`,
    );
  }

  // Canonical Audit Log for Project 3 Completion (required for project_completion_cycles_view)
  const audit3ExistingResult = await supabase
    .from("audit_logs")
    .select("id")
    .eq("project_id", p3Id)
    .eq("action", "project_completed")
    .maybeSingle();

  assertDbSuccess(
    audit3ExistingResult,
    "Query audit log for Project 3 completion",
  );

  if (!audit3ExistingResult.data) {
    const audit3InsertResult = await supabase
      .from("audit_logs")
      .insert({
        entity_type: "project",
        entity_id: p3Id,
        project_id: p3Id,
        action: "project_completed",
        old_status: "in_progress",
        new_status: "completed",
        actor_id: adminId,
        actor_role: "admin",
        changed_fields: {
          unfinished_task_count: 0,
          unfinished_deliverable_count: 0,
          override_confirmed: false,
        },
      })
      .select("id")
      .single();

    assertDbSuccess(
      audit3InsertResult,
      "Insert audit log for Project 3 completion",
    );
  }

  // ===========================================================================
  // 4. Reference Project 4: Acme Teaser 2025 (Archived Client Project)
  // ===========================================================================
  let p4Id: string;
  const p4ExistingResult = await supabase
    .from("projects")
    .select("id")
    .eq("name", "Acme Teaser 2025")
    .maybeSingle();

  assertDbSuccess(p4ExistingResult, "Query Project 4 (Acme Teaser 2025)");

  if (p4ExistingResult.data) {
    p4Id = p4ExistingResult.data.id;
  } else {
    const p4InsertResult = await supabase
      .from("projects")
      .insert({
        name: "Acme Teaser 2025",
        client_id: orgs["acme-corp"],
        project_type: "client",
        status: "completed",
        internal_description: "Prior year teaser commercial campaign.",
        deadline_at: new Date(Date.now() - 100 * 86400000).toISOString(),
        completed_at: new Date(Date.now() - 100 * 86400000).toISOString(),
        archived_at: new Date(Date.now() - 10 * 86400000).toISOString(),
        created_by: adminId,
      })
      .select("id")
      .single();

    const p4Created = assertDbSuccess(
      p4InsertResult,
      "Insert Project 4 (Acme Teaser 2025)",
    );
    p4Id = p4Created.id;
  }

  const p4Members = [
    { userId: pmLeadAId, type: "pm_lead" as const, isPrimary: true },
    { userId: clientA1Id, type: "client" as const, isPrimary: false },
  ];

  const missingP4Members = [];
  for (const m of p4Members) {
    const pm4ExistingResult = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", p4Id)
      .eq("user_id", m.userId)
      .maybeSingle();

    assertDbSuccess(
      pm4ExistingResult,
      `Query membership for user ${m.userId} on Project 4`,
    );

    if (!pm4ExistingResult.data) {
      missingP4Members.push({
        project_id: p4Id,
        user_id: m.userId,
        member_type: m.type,
        is_primary: m.isPrimary,
        receives_notifications: false,
        created_by: adminId,
      });
    }
  }

  if (missingP4Members.length > 0) {
    const pm4InsertResult = await supabase
      .from("project_members")
      .insert(missingP4Members)
      .select("id");

    assertDbSuccess(
      pm4InsertResult,
      `Batch insert missing memberships on Project 4`,
    );
  }

  // ===========================================================================
  // 5. Allowed-Side Isolation Project: Starlight Summer Campaign (Starlight Media)
  // ===========================================================================
  let p5Id: string;
  const p5ExistingResult = await supabase
    .from("projects")
    .select("id")
    .eq("name", "Starlight Summer Campaign")
    .maybeSingle();

  assertDbSuccess(
    p5ExistingResult,
    "Query Project 5 (Starlight Summer Campaign)",
  );

  if (p5ExistingResult.data) {
    p5Id = p5ExistingResult.data.id;
  } else {
    const p5InsertResult = await supabase
      .from("projects")
      .insert({
        name: "Starlight Summer Campaign",
        client_id: orgs["starlight-media"],
        project_type: "client",
        status: "in_progress",
        internal_description:
          "Digital summer promo campaign for Starlight Media Group.",
        client_scope:
          "Social media video teasers and display banner deliverables.",
        drive_folder_url:
          "https://drive.google.com/drive/folders/demo-starlight-summer",
        deadline_at: new Date(Date.now() + 20 * 86400000).toISOString(),
        created_by: adminId,
      })
      .select("id")
      .single();

    const p5Created = assertDbSuccess(
      p5InsertResult,
      "Insert Project 5 (Starlight Summer Campaign)",
    );
    p5Id = p5Created.id;
  }

  const p5Members = [
    { userId: pmLeadBId, type: "pm_lead" as const, isPrimary: true },
    { userId: opBId, type: "operator" as const, isPrimary: false },
    { userId: clientB1Id, type: "client" as const, isPrimary: false },
  ];

  const missingP5Members = [];
  for (const m of p5Members) {
    const pm5ExistingResult = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", p5Id)
      .eq("user_id", m.userId)
      .maybeSingle();

    assertDbSuccess(
      pm5ExistingResult,
      `Query membership for user ${m.userId} on Project 5`,
    );

    if (!pm5ExistingResult.data) {
      missingP5Members.push({
        project_id: p5Id,
        user_id: m.userId,
        member_type: m.type,
        is_primary: m.isPrimary,
        receives_notifications: true,
        created_by: adminId,
      });
    }
  }

  if (missingP5Members.length > 0) {
    const pm5InsertResult = await supabase
      .from("project_members")
      .insert(missingP5Members)
      .select("id");

    assertDbSuccess(
      pm5InsertResult,
      `Batch insert missing memberships on Project 5`,
    );
  }

  // Starlight Task 1 + Deliverable 1
  let t5_1Id: string;
  const t5_1ExistingResult = await supabase
    .from("tasks")
    .select("id")
    .eq("project_id", p5Id)
    .eq("title", "Summer Campaign Banner Package")
    .maybeSingle();

  assertDbSuccess(
    t5_1ExistingResult,
    "Query Task (Summer Campaign Banner Package)",
  );

  if (t5_1ExistingResult.data) {
    t5_1Id = t5_1ExistingResult.data.id;
  } else {
    const t5_1InsertResult = await supabase
      .from("tasks")
      .insert({
        project_id: p5Id,
        title: "Summer Campaign Banner Package",
        task_type: "internal_work",
        priority: "high",
        status: "in_progress",
        assignee_id: opBId,
        has_deliverables: true,
        description:
          "Design interactive HTML5 and static social media banners.",
        deadline_at: new Date(Date.now() + 15 * 86400000).toISOString(),
        created_by: pmLeadBId,
      })
      .select("id")
      .single();

    const t5_1Created = assertDbSuccess(
      t5_1InsertResult,
      "Insert Task (Summer Campaign Banner Package)",
    );
    t5_1Id = t5_1Created.id;
  }

  const d5_1ExistingResult = await supabase
    .from("deliverables")
    .select("id")
    .eq("task_id", t5_1Id)
    .eq("title", "Display Banner Suite")
    .maybeSingle();

  assertDbSuccess(
    d5_1ExistingResult,
    "Query Deliverable (Display Banner Suite)",
  );

  if (!d5_1ExistingResult.data) {
    const d5_1InsertResult = await supabase
      .from("deliverables")
      .insert({
        task_id: t5_1Id,
        project_id: p5Id,
        title: "Display Banner Suite",
        workflow_type: "production",
        status: "pending",
        assignee_id: opBId,
        created_by: pmLeadBId,
        specifications:
          "Export standard IAB display formats (300x250, 728x90, 160x600).",
        current_version_number: 1,
        internal_review_deadline_at: new Date(
          Date.now() + 7 * 86400000,
        ).toISOString(),
        client_delivery_deadline_at: new Date(
          Date.now() + 10 * 86400000,
        ).toISOString(),
      })
      .select("id")
      .single();

    assertDbSuccess(
      d5_1InsertResult,
      "Insert Deliverable (Display Banner Suite)",
    );
  }

  // ===========================================================================
  // 6. Interactive Sandbox Project: Acme Sandbox Campaign (For Live UI/UX Demo)
  // ===========================================================================
  let p6Id: string;
  const p6ExistingResult = await supabase
    .from("projects")
    .select("id")
    .eq("name", "Acme Sandbox Campaign")
    .maybeSingle();

  assertDbSuccess(p6ExistingResult, "Query Project 6 (Acme Sandbox Campaign)");

  if (p6ExistingResult.data) {
    p6Id = p6ExistingResult.data.id;
  } else {
    const p6InsertResult = await supabase
      .from("projects")
      .insert({
        name: "Acme Sandbox Campaign",
        client_id: orgs["acme-corp"],
        project_type: "client",
        status: "in_progress",
        internal_description:
          "Interactive demonstration project for localhost and client UI/UX walkthroughs.",
        client_scope:
          "Sandbox environment for testing live task assignments, submissions, feedback, and recovery.",
        drive_folder_url:
          "https://drive.google.com/drive/folders/demo-acme-sandbox",
        deadline_at: new Date(Date.now() + 60 * 86400000).toISOString(),
        created_by: adminId,
      })
      .select("id")
      .single();

    const p6Created = assertDbSuccess(
      p6InsertResult,
      "Insert Project 6 (Acme Sandbox Campaign)",
    );
    p6Id = p6Created.id;
  }

  const p6Members = [
    { userId: pmLeadAId, type: "pm_lead" as const, isPrimary: true },
    { userId: pmLeadBId, type: "pm_lead" as const, isPrimary: false },
    { userId: watcherAId, type: "pm_watcher" as const, isPrimary: false },
    { userId: opAId, type: "operator" as const, isPrimary: false },
    { userId: opBId, type: "operator" as const, isPrimary: false },
    { userId: clientA1Id, type: "client" as const, isPrimary: false },
    { userId: clientA2Id, type: "client" as const, isPrimary: false },
  ];

  const missingP6Members = [];
  for (const m of p6Members) {
    const pm6ExistingResult = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", p6Id)
      .eq("user_id", m.userId)
      .eq("member_type", m.type)
      .maybeSingle();

    assertDbSuccess(
      pm6ExistingResult,
      `Query membership for user ${m.userId} on Sandbox Project 6`,
    );

    if (!pm6ExistingResult.data) {
      missingP6Members.push({
        project_id: p6Id,
        user_id: m.userId,
        member_type: m.type,
        is_primary: m.isPrimary,
        receives_notifications: true,
        created_by: adminId,
      });
    }
  }

  if (missingP6Members.length > 0) {
    const pm6InsertResult = await supabase
      .from("project_members")
      .insert(missingP6Members)
      .select("id");

    assertDbSuccess(
      pm6InsertResult,
      `Batch insert missing memberships on Sandbox Project 6`,
    );
  }

  // ===========================================================================
  // 6.1 Sandbox Tasks (Upcoming, Overdue, and Client Request with Provenance)
  // ===========================================================================
  // Task 6.1: Upcoming Attention Task (Operator A)
  let tUpcomingId: string;
  const tUpcomingExistingResult = await supabase
    .from("tasks")
    .select("id")
    .eq("project_id", p6Id)
    .eq("title", "Sandbox Upcoming Feature Cut")
    .eq(
      "description",
      "S07 demo fixture: upcoming attention task for Operator A",
    )
    .maybeSingle();

  assertDbSuccess(
    tUpcomingExistingResult,
    "Query Sandbox Upcoming Task (Sandbox Upcoming Feature Cut)",
  );

  if (tUpcomingExistingResult.data) {
    tUpcomingId = tUpcomingExistingResult.data.id;
    const updateUpcomingResult = await supabase
      .from("tasks")
      .update({
        deadline_at: new Date(now.getTime() + 10 * 86400000).toISOString(),
      })
      .eq("id", tUpcomingId);
    assertDbSuccess(
      updateUpcomingResult,
      "Update Sandbox Upcoming Task deadline",
    );
  } else {
    const insertUpcomingResult = await supabase
      .from("tasks")
      .insert({
        project_id: p6Id,
        title: "Sandbox Upcoming Feature Cut",
        task_type: "internal_work",
        priority: "medium",
        status: "in_progress",
        assignee_id: opAId,
        has_deliverables: true,
        description: "S07 demo fixture: upcoming attention task for Operator A",
        deadline_at: new Date(now.getTime() + 10 * 86400000).toISOString(),
        created_by: pmLeadAId,
      })
      .select("id")
      .single();

    const created = assertDbSuccess(
      insertUpcomingResult,
      "Insert Sandbox Upcoming Task (Sandbox Upcoming Feature Cut)",
    );
    tUpcomingId = created.id;
  }

  // Task 6.2: Overdue Attention Task (Operator B)
  let tOverdueId: string;
  const tOverdueExistingResult = await supabase
    .from("tasks")
    .select("id")
    .eq("project_id", p6Id)
    .eq("title", "Sandbox Overdue Asset Review")
    .eq("description", "S07 demo fixture: overdue task for metrics attention")
    .maybeSingle();

  assertDbSuccess(
    tOverdueExistingResult,
    "Query Sandbox Overdue Task (Sandbox Overdue Asset Review)",
  );

  if (tOverdueExistingResult.data) {
    tOverdueId = tOverdueExistingResult.data.id;
    const updateOverdueResult = await supabase
      .from("tasks")
      .update({
        deadline_at: new Date(now.getTime() - 3 * 86400000).toISOString(),
      })
      .eq("id", tOverdueId);
    assertDbSuccess(
      updateOverdueResult,
      "Update Sandbox Overdue Task deadline",
    );
  } else {
    const insertOverdueResult = await supabase
      .from("tasks")
      .insert({
        project_id: p6Id,
        title: "Sandbox Overdue Asset Review",
        task_type: "internal_work",
        priority: "high",
        status: "in_progress",
        assignee_id: opBId,
        has_deliverables: true,
        description: "S07 demo fixture: overdue task for metrics attention",
        deadline_at: new Date(now.getTime() - 3 * 86400000).toISOString(),
        created_by: pmLeadAId,
      })
      .select("id")
      .single();

    const created = assertDbSuccess(
      insertOverdueResult,
      "Insert Sandbox Overdue Task (Sandbox Overdue Asset Review)",
    );
    tOverdueId = created.id;
  }

  // Task 6.3: Client Source Request Task (Client A1)
  let tClientRequestId: string;
  const tClientRequestExistingResult = await supabase
    .from("tasks")
    .select("id")
    .eq("project_id", p6Id)
    .eq("title", "Sandbox Client Source Request")
    .eq("description", "S07 demo fixture: client submission source request")
    .maybeSingle();

  assertDbSuccess(
    tClientRequestExistingResult,
    "Query Sandbox Client Request Task (Sandbox Client Source Request)",
  );

  if (tClientRequestExistingResult.data) {
    tClientRequestId = tClientRequestExistingResult.data.id;
    const updateClientReqResult = await supabase
      .from("tasks")
      .update({
        deadline_at: new Date(now.getTime() + 7 * 86400000).toISOString(),
      })
      .eq("id", tClientRequestId);
    assertDbSuccess(
      updateClientReqResult,
      "Update Sandbox Client Request Task deadline",
    );
  } else {
    const insertClientReqResult = await supabase
      .from("tasks")
      .insert({
        project_id: p6Id,
        title: "Sandbox Client Source Request",
        task_type: "client_request",
        priority: "medium",
        status: "in_progress",
        assignee_id: clientA1Id,
        has_deliverables: true,
        description: "S07 demo fixture: client submission source request",
        deadline_at: new Date(now.getTime() + 7 * 86400000).toISOString(),
        created_by: pmLeadAId,
      })
      .select("id")
      .single();

    const created = assertDbSuccess(
      insertClientReqResult,
      "Insert Sandbox Client Request Task (Sandbox Client Source Request)",
    );
    tClientRequestId = created.id;
  }

  // ===========================================================================
  // 6.2 Sandbox Deliverables (Approved, Delivered, Client Submission)
  // ===========================================================================
  // Deliverable 6.1: Approved Production Deliverable (Operator A)
  let dApprovedId: string;
  const dApprovedExistingResult = await supabase
    .from("deliverables")
    .select("id")
    .eq("project_id", p6Id)
    .eq("title", "Sandbox Approved Master Video Cut")
    .eq(
      "specifications",
      "S07 demo fixture: approved production deliverable for archive demonstration",
    )
    .maybeSingle();

  assertDbSuccess(
    dApprovedExistingResult,
    "Query Sandbox Approved Deliverable (Sandbox Approved Master Video Cut)",
  );

  if (dApprovedExistingResult.data) {
    dApprovedId = dApprovedExistingResult.data.id;
    const updateApprovedResult = await supabase
      .from("deliverables")
      .update({
        approved_at: new Date(now.getTime() - 15 * 86400000).toISOString(),
        internal_review_deadline_at: new Date(
          now.getTime() - 19 * 86400000,
        ).toISOString(),
        client_delivery_deadline_at: new Date(
          now.getTime() - 16 * 86400000,
        ).toISOString(),
      })
      .eq("id", dApprovedId);
    assertDbSuccess(
      updateApprovedResult,
      "Update Sandbox Approved Deliverable timestamps",
    );
  } else {
    const insertApprovedResult = await supabase
      .from("deliverables")
      .insert({
        task_id: tUpcomingId,
        project_id: p6Id,
        title: "Sandbox Approved Master Video Cut",
        workflow_type: "production",
        status: "approved",
        assignee_id: opAId,
        created_by: pmLeadAId,
        specifications:
          "S07 demo fixture: approved production deliverable for archive demonstration",
        current_version_number: 1,
        submission_deadline_at: null,
        internal_review_deadline_at: new Date(
          now.getTime() - 19 * 86400000,
        ).toISOString(),
        client_delivery_deadline_at: new Date(
          now.getTime() - 16 * 86400000,
        ).toISOString(),
        approved_at: new Date(now.getTime() - 15 * 86400000).toISOString(),
      })
      .select("id")
      .single();

    const created = assertDbSuccess(
      insertApprovedResult,
      "Insert Sandbox Approved Deliverable (Sandbox Approved Master Video Cut)",
    );
    dApprovedId = created.id;
  }

  // Version 1 for Approved Deliverable (Insert-Only)
  const vApprovedExistingResult = await supabase
    .from("deliverable_versions")
    .select("id")
    .eq("deliverable_id", dApprovedId)
    .eq("version_number", 1)
    .maybeSingle();

  assertDbSuccess(
    vApprovedExistingResult,
    "Query Version 1 for Sandbox Approved Deliverable",
  );

  if (!vApprovedExistingResult.data) {
    const insertVApprovedResult = await supabase
      .from("deliverable_versions")
      .insert({
        deliverable_id: dApprovedId,
        version_number: 1,
        submission_url:
          "https://drive.google.com/file/d/demo-sandbox-approved-cut/view",
        submission_provider: "google_drive",
        submission_note:
          "Initial master cut submission for stakeholder review.",
        submitted_by: opAId,
        created_at: new Date(now.getTime() - 20 * 86400000).toISOString(),
      })
      .select("id")
      .single();

    assertDbSuccess(
      insertVApprovedResult,
      "Insert Version 1 for Sandbox Approved Deliverable",
    );
  }

  // Deliverable 6.2: Delivered Production Deliverable (Operator B)
  let dDeliveredId: string;
  let vDeliveredId: string | null = null;
  const dDeliveredExistingResult = await supabase
    .from("deliverables")
    .select("id")
    .eq("project_id", p6Id)
    .eq("title", "Sandbox Delivered Social Teaser")
    .eq(
      "specifications",
      "S07 demo fixture: delivered production deliverable for archive distinction",
    )
    .maybeSingle();

  assertDbSuccess(
    dDeliveredExistingResult,
    "Query Sandbox Delivered Deliverable (Sandbox Delivered Social Teaser)",
  );

  if (dDeliveredExistingResult.data) {
    dDeliveredId = dDeliveredExistingResult.data.id;
    const updateDeliveredResult = await supabase
      .from("deliverables")
      .update({
        delivered_at: new Date(now.getTime() - 10 * 86400000).toISOString(),
        internal_review_deadline_at: new Date(
          now.getTime() - 14 * 86400000,
        ).toISOString(),
        client_delivery_deadline_at: new Date(
          now.getTime() - 11 * 86400000,
        ).toISOString(),
      })
      .eq("id", dDeliveredId);
    assertDbSuccess(
      updateDeliveredResult,
      "Update Sandbox Delivered Deliverable timestamps",
    );
  } else {
    const insertDeliveredResult = await supabase
      .from("deliverables")
      .insert({
        task_id: tOverdueId,
        project_id: p6Id,
        title: "Sandbox Delivered Social Teaser",
        workflow_type: "production",
        status: "delivered",
        assignee_id: opBId,
        created_by: pmLeadAId,
        specifications:
          "S07 demo fixture: delivered production deliverable for archive distinction",
        current_version_number: 1,
        submission_deadline_at: null,
        internal_review_deadline_at: new Date(
          now.getTime() - 14 * 86400000,
        ).toISOString(),
        client_delivery_deadline_at: new Date(
          now.getTime() - 11 * 86400000,
        ).toISOString(),
        delivered_at: new Date(now.getTime() - 10 * 86400000).toISOString(),
      })
      .select("id")
      .single();

    const created = assertDbSuccess(
      insertDeliveredResult,
      "Insert Sandbox Delivered Deliverable (Sandbox Delivered Social Teaser)",
    );
    dDeliveredId = created.id;
  }

  // Version 1 for Delivered Deliverable (Insert-Only)
  const vDeliveredExistingResult = await supabase
    .from("deliverable_versions")
    .select("id")
    .eq("deliverable_id", dDeliveredId)
    .eq("version_number", 1)
    .maybeSingle();

  assertDbSuccess(
    vDeliveredExistingResult,
    "Query Version 1 for Sandbox Delivered Deliverable",
  );

  if (vDeliveredExistingResult.data) {
    vDeliveredId = vDeliveredExistingResult.data.id;
  } else {
    const insertVDeliveredResult = await supabase
      .from("deliverable_versions")
      .insert({
        deliverable_id: dDeliveredId,
        version_number: 1,
        submission_url:
          "https://drive.google.com/file/d/demo-sandbox-delivered-teaser/view",
        submission_provider: "google_drive",
        submission_note: "Final delivered teaser asset package.",
        submitted_by: opBId,
        created_at: new Date(now.getTime() - 12 * 86400000).toISOString(),
      })
      .select("id")
      .single();

    const createdVersion = assertDbSuccess(
      insertVDeliveredResult,
      "Insert Version 1 for Sandbox Delivered Deliverable",
    );
    vDeliveredId = createdVersion.id;
  }

  // Deliverable 6.3: Client Submission Exclusion Deliverable
  const dClientSubExistingResult = await supabase
    .from("deliverables")
    .select("id")
    .eq("project_id", p6Id)
    .eq("title", "Sandbox Client Upload Specification")
    .eq(
      "specifications",
      "S07 demo fixture: client submission excluded from archive",
    )
    .maybeSingle();

  assertDbSuccess(
    dClientSubExistingResult,
    "Query Sandbox Client Submission Deliverable",
  );

  if (dClientSubExistingResult.data) {
    const updateClientSubResult = await supabase
      .from("deliverables")
      .update({
        submission_deadline_at: new Date(
          now.getTime() + 7 * 86400000,
        ).toISOString(),
      })
      .eq("id", dClientSubExistingResult.data.id);
    assertDbSuccess(
      updateClientSubResult,
      "Update Sandbox Client Submission Deliverable deadline",
    );
  } else {
    const insertClientSubResult = await supabase
      .from("deliverables")
      .insert({
        task_id: tClientRequestId,
        project_id: p6Id,
        title: "Sandbox Client Upload Specification",
        workflow_type: "client_submission",
        status: "submitted",
        assignee_id: clientA1Id,
        created_by: pmLeadAId,
        specifications:
          "S07 demo fixture: client submission excluded from archive",
        current_version_number: 1,
        submission_deadline_at: new Date(
          now.getTime() + 7 * 86400000,
        ).toISOString(),
        internal_review_deadline_at: null,
        client_delivery_deadline_at: null,
      })
      .select("id")
      .single();

    assertDbSuccess(
      insertClientSubResult,
      "Insert Sandbox Client Submission Deliverable",
    );
  }

  // ===========================================================================
  // 6.3 Sandbox Link Incident Report (on Delivered Deliverable v1)
  // ===========================================================================
  if (vDeliveredId) {
    const incidentExistingResult = await supabase
      .from("deliverable_link_reports")
      .select("id")
      .eq("deliverable_id", dDeliveredId)
      .eq("version_id", vDeliveredId)
      .eq("reason", "Link target requires authorization or is unavailable")
      .maybeSingle();

    assertDbSuccess(
      incidentExistingResult,
      "Query Sandbox Link Incident Report",
    );

    if (incidentExistingResult.data) {
      const updateIncidentResult = await supabase
        .from("deliverable_link_reports")
        .update({
          created_at: new Date(now.getTime() - 7 * 86400000).toISOString(),
        })
        .eq("id", incidentExistingResult.data.id);
      assertDbSuccess(
        updateIncidentResult,
        "Update Sandbox Link Incident Report timestamp",
      );
    } else {
      const insertIncidentResult = await supabase
        .from("deliverable_link_reports")
        .insert({
          deliverable_id: dDeliveredId,
          version_id: vDeliveredId,
          status: "open",
          reason: "Link target requires authorization or is unavailable",
          reported_by: opBId,
          created_at: new Date(now.getTime() - 7 * 86400000).toISOString(),
        })
        .select("id")
        .single();

      assertDbSuccess(
        insertIncidentResult,
        "Insert Sandbox Link Incident Report",
      );
    }
  }

  // ===========================================================================
  // 6.4 Canonical Audit Logs for Deliverable Cycle & Project Completion
  // ===========================================================================
  console.log(
    "📜 Reconciling canonical audit logs for deliverable & project completion cycles...",
  );
  const candidateAuditEpochs = [
    currentBucketEpoch,
    currentBucketEpoch - 1,
    currentBucketEpoch - 2,
    currentBucketEpoch - 3,
  ];

  const allCandidateAuditRequestIds = candidateAuditEpochs.flatMap((e) => [
    deterministicFixtureUuid(`s07_audit_approved_sub_${e}`),
    deterministicFixtureUuid(`s07_audit_approved_start_${e}`),
    deterministicFixtureUuid(`s07_audit_approved_act_${e}`),
    deterministicFixtureUuid(`s07_audit_proj_completed_${e}`),
    deterministicFixtureUuid(`s07_audit_proj_reopened_${e}`),
  ]);

  const candidateAuditResult = await supabase
    .from("audit_logs")
    .select(
      "id, request_id, entity_type, entity_id, project_id, action, old_status, new_status, actor_id, actor_role, changed_fields, created_at",
    )
    .in("request_id", allCandidateAuditRequestIds);

  const foundAuditLogs = assertDbSuccess(
    candidateAuditResult,
    "Query candidate audit log generations",
  );

  // Group raw returned rows by request_id to detect duplicates across all expected candidate request IDs
  const rawRowsByRequestId = new Map<
    string,
    (typeof foundAuditLogs)[number][]
  >();
  for (const row of foundAuditLogs) {
    if (row.request_id) {
      const list = rawRowsByRequestId.get(row.request_id) || [];
      list.push(row);
      rawRowsByRequestId.set(row.request_id, list);
    }
  }

  for (const e of candidateAuditEpochs) {
    const epochRequestIds = [
      deterministicFixtureUuid(`s07_audit_approved_sub_${e}`),
      deterministicFixtureUuid(`s07_audit_approved_start_${e}`),
      deterministicFixtureUuid(`s07_audit_approved_act_${e}`),
      deterministicFixtureUuid(`s07_audit_proj_completed_${e}`),
      deterministicFixtureUuid(`s07_audit_proj_reopened_${e}`),
    ];
    for (const reqId of epochRequestIds) {
      const occurrences = rawRowsByRequestId.get(reqId) || [];
      if (occurrences.length > 1) {
        throw new Error(
          `[Bootstrap Error] Duplicate audit log found for candidate epoch ${e} with request_id: ${reqId}. Raw occurrences: ${occurrences.length}. Fail-closed.`,
        );
      }
    }
  }

  const auditByRequestId = new Map(
    foundAuditLogs.map((row) => [row.request_id, row]),
  );

  const reusableAuditEpochs: number[] = [];

  for (const e of candidateAuditEpochs) {
    const reqSub = deterministicFixtureUuid(`s07_audit_approved_sub_${e}`);
    const reqStart = deterministicFixtureUuid(`s07_audit_approved_start_${e}`);
    const reqAct = deterministicFixtureUuid(`s07_audit_approved_act_${e}`);
    const reqCompleted = deterministicFixtureUuid(
      `s07_audit_proj_completed_${e}`,
    );
    const reqReopened = deterministicFixtureUuid(
      `s07_audit_proj_reopened_${e}`,
    );

    const subRow = auditByRequestId.get(reqSub);
    const startRow = auditByRequestId.get(reqStart);
    const actRow = auditByRequestId.get(reqAct);
    const completedRow = auditByRequestId.get(reqCompleted);
    const reopenedRow = auditByRequestId.get(reqReopened);

    const presentRows = [
      subRow,
      startRow,
      actRow,
      completedRow,
      reopenedRow,
    ].filter((r): r is NonNullable<typeof r> => r !== undefined);

    if (presentRows.length === 0) {
      // Absent generation for this candidate epoch
      continue;
    }

    if (
      presentRows.length !== 5 ||
      !subRow ||
      !startRow ||
      !actRow ||
      !completedRow ||
      !reopenedRow
    ) {
      throw new Error(
        `[Bootstrap Error] Partial audit log generation found for epoch ${e} (expected 5 rows, found ${presentRows.length}). Fail-closed.`,
      );
    }

    // Validate deliverable entity relationships across all 3 deliverable audit rows
    if (
      subRow.entity_type !== "deliverable" ||
      startRow.entity_type !== "deliverable" ||
      actRow.entity_type !== "deliverable" ||
      subRow.project_id !== p6Id ||
      startRow.project_id !== p6Id ||
      actRow.project_id !== p6Id ||
      subRow.entity_id !== startRow.entity_id ||
      startRow.entity_id !== actRow.entity_id
    ) {
      throw new Error(
        `[Bootstrap Error] Corrupt audit log generation for epoch ${e}: deliverable entity mismatch across submission/review audit rows. Fail-closed.`,
      );
    }

    const candidateDelivId = subRow.entity_id;

    if (candidateDelivId === dApprovedId) {
      // Legacy/current first generation targeting dApprovedId — valid Sandbox fixture
    } else {
      // Generation-scoped deliverable fixture for candidate epoch e
      const genDelivResult = await supabase
        .from("deliverables")
        .select(
          "id, task_id, project_id, title, specifications, workflow_type, status, assignee_id, created_by, current_version_number, deleted_at",
        )
        .eq("id", candidateDelivId)
        .maybeSingle();

      const genDeliv = assertDbSuccess(
        genDelivResult,
        `Query generation-scoped deliverable for candidate epoch ${e}`,
      );

      if (
        !genDeliv ||
        genDeliv.task_id !== tUpcomingId ||
        genDeliv.project_id !== p6Id ||
        genDeliv.title !== `Sandbox Metrics Review Cycle — Epoch ${e}` ||
        genDeliv.specifications !==
          `S07 demo fixture: immutable metrics rollover deliverable generation ${e}` ||
        genDeliv.workflow_type !== "production" ||
        genDeliv.status !== "approved" ||
        genDeliv.assignee_id !== opAId ||
        genDeliv.created_by !== pmLeadAId ||
        genDeliv.current_version_number !== 1 ||
        genDeliv.deleted_at !== null
      ) {
        throw new Error(
          `[Bootstrap Error] Corrupt generation-scoped deliverable for candidate epoch ${e}. Deliverable identity does not match expected provenance contract. Fail-closed.`,
        );
      }
    }

    // Validate project entity relationships
    if (
      completedRow.entity_type !== "project" ||
      completedRow.entity_id !== p6Id ||
      completedRow.project_id !== p6Id ||
      reopenedRow.entity_type !== "project" ||
      reopenedRow.entity_id !== p6Id ||
      reopenedRow.project_id !== p6Id
    ) {
      throw new Error(
        `[Bootstrap Error] Corrupt audit log generation for epoch ${e}: project completion entity ID mismatch. Fail-closed.`,
      );
    }

    // Validate actions, actors, roles, and status transitions
    if (
      subRow.action !== "deliverable_version_submitted" ||
      subRow.actor_id !== opAId ||
      subRow.actor_role !== "operator" ||
      subRow.old_status !== "pending" ||
      subRow.new_status !== "awaiting_internal_review" ||
      startRow.action !== "internal_review_approved" ||
      startRow.actor_id !== pmLeadAId ||
      startRow.actor_role !== "pm" ||
      startRow.old_status !== "awaiting_internal_review" ||
      startRow.new_status !== "awaiting_client_review" ||
      actRow.action !== "client_review_approved" ||
      actRow.actor_id !== clientA1Id ||
      actRow.actor_role !== "client" ||
      actRow.old_status !== "awaiting_client_review" ||
      actRow.new_status !== "approved" ||
      completedRow.action !== "project_completed" ||
      completedRow.actor_id !== adminId ||
      completedRow.actor_role !== "admin" ||
      completedRow.old_status !== "in_progress" ||
      completedRow.new_status !== "completed" ||
      reopenedRow.action !== "project_reopened" ||
      reopenedRow.actor_id !== adminId ||
      reopenedRow.actor_role !== "admin" ||
      reopenedRow.old_status !== "completed" ||
      reopenedRow.new_status !== "in_progress"
    ) {
      throw new Error(
        `[Bootstrap Error] Corrupt audit log generation for epoch ${e}: action, actor, role, or status contract mismatch. Fail-closed.`,
      );
    }

    // Validate chronological ordering
    const subTime = new Date(subRow.created_at).getTime();
    const startTime = new Date(startRow.created_at).getTime();
    const actTime = new Date(actRow.created_at).getTime();
    const completedTime = new Date(completedRow.created_at).getTime();
    const reopenedTime = new Date(reopenedRow.created_at).getTime();

    if (!(
      subTime < startTime &&
      startTime < actTime &&
      completedTime < reopenedTime
    )) {
      throw new Error(
        `[Bootstrap Error] Corrupt audit log generation for epoch ${e}: invalid chronological timestamp sequence. Fail-closed.`,
      );
    }

    // Validate 90-day presentation usability
    const actAge = now.getTime() - actTime;
    const completedAge = now.getTime() - completedTime;
    const isUsable =
      actAge >= 0 &&
      actAge <= NINETY_DAYS_MS &&
      completedAge >= 0 &&
      completedAge <= NINETY_DAYS_MS;

    if (isUsable) {
      reusableAuditEpochs.push(e);
    }
  }

  if (reusableAuditEpochs.length > 1) {
    throw new Error(
      `[Bootstrap Error] Multiple reusable audit log generations found (${reusableAuditEpochs.join(", ")}). Fail-closed to prevent duplicated metrics cohorts.`,
    );
  }

  if (reusableAuditEpochs.length === 1) {
    console.log(
      `  ✓ Reusing existing valid audit log generation from epoch ${reusableAuditEpochs[0]}`,
    );
  } else {
    console.log(
      `  ➕ Creating new generation-scoped deliverable and audit log generation for epoch ${currentBucketEpoch}...`,
    );

    // Reconcile generation-scoped deliverable for currentBucketEpoch
    const genDelivTitle = `Sandbox Metrics Review Cycle — Epoch ${currentBucketEpoch}`;
    const genDelivSpecs = `S07 demo fixture: immutable metrics rollover deliverable generation ${currentBucketEpoch}`;

    let generationDeliverableId: string;
    const genDelivExistingResult = await supabase
      .from("deliverables")
      .select(
        "id, task_id, project_id, title, specifications, workflow_type, status, assignee_id, created_by, current_version_number, deleted_at",
      )
      .eq("project_id", p6Id)
      .eq("title", genDelivTitle)
      .eq("specifications", genDelivSpecs)
      .maybeSingle();

    const existingGenerationDeliverable = assertDbSuccess(
      genDelivExistingResult,
      `Query generation-scoped deliverable (${genDelivTitle})`,
    );

    if (existingGenerationDeliverable) {
      if (
        existingGenerationDeliverable.task_id !== tUpcomingId ||
        existingGenerationDeliverable.project_id !== p6Id ||
        existingGenerationDeliverable.title !== genDelivTitle ||
        existingGenerationDeliverable.specifications !== genDelivSpecs ||
        existingGenerationDeliverable.workflow_type !== "production" ||
        existingGenerationDeliverable.status !== "approved" ||
        existingGenerationDeliverable.assignee_id !== opAId ||
        existingGenerationDeliverable.created_by !== pmLeadAId ||
        existingGenerationDeliverable.current_version_number !== 1 ||
        existingGenerationDeliverable.deleted_at !== null
      ) {
        throw new Error(
          `[Bootstrap Error] Corrupt generation-scoped deliverable for current epoch ${currentBucketEpoch}. Deliverable identity does not match expected provenance contract. Fail-closed.`,
        );
      }

      generationDeliverableId = existingGenerationDeliverable.id;
      const updateGenDelivResult = await supabase
        .from("deliverables")
        .update({
          approved_at: new Date(now.getTime() - 15 * ONE_DAY_MS).toISOString(),
          internal_review_deadline_at: new Date(
            now.getTime() - 19 * ONE_DAY_MS,
          ).toISOString(),
          client_delivery_deadline_at: new Date(
            now.getTime() - 16 * ONE_DAY_MS,
          ).toISOString(),
        })
        .eq("id", generationDeliverableId);
      assertDbSuccess(
        updateGenDelivResult,
        `Update generation-scoped deliverable presentation timestamps`,
      );
    } else {
      const insertGenDelivResult = await supabase
        .from("deliverables")
        .insert({
          task_id: tUpcomingId,
          project_id: p6Id,
          title: genDelivTitle,
          workflow_type: "production",
          status: "approved",
          assignee_id: opAId,
          created_by: pmLeadAId,
          specifications: genDelivSpecs,
          current_version_number: 1,
          submission_deadline_at: null,
          internal_review_deadline_at: new Date(
            now.getTime() - 19 * ONE_DAY_MS,
          ).toISOString(),
          client_delivery_deadline_at: new Date(
            now.getTime() - 16 * ONE_DAY_MS,
          ).toISOString(),
          approved_at: new Date(now.getTime() - 15 * ONE_DAY_MS).toISOString(),
        })
        .select("id")
        .single();

      const createdGenDeliv = assertDbSuccess(
        insertGenDelivResult,
        `Insert generation-scoped deliverable (${genDelivTitle})`,
      );
      generationDeliverableId = createdGenDeliv.id;
    }

    // Reconcile generation-scoped deliverable version 1 (insert-only)
    const genVersionExistingResult = await supabase
      .from("deliverable_versions")
      .select(
        "id, deliverable_id, version_number, submission_url, submission_provider, submission_note, submitted_by",
      )
      .eq("deliverable_id", generationDeliverableId)
      .eq("version_number", 1)
      .maybeSingle();

    const existingGenerationVersion = assertDbSuccess(
      genVersionExistingResult,
      `Query Version 1 for generation-scoped deliverable`,
    );

    if (existingGenerationVersion) {
      if (
        existingGenerationVersion.deliverable_id !== generationDeliverableId ||
        existingGenerationVersion.version_number !== 1 ||
        existingGenerationVersion.submission_url !==
          `https://drive.google.com/file/d/demo-sandbox-metrics-cycle-epoch-${currentBucketEpoch}/view` ||
        existingGenerationVersion.submission_provider !== "google_drive" ||
        existingGenerationVersion.submission_note !==
          `Initial master cut submission for metrics rollover cycle epoch ${currentBucketEpoch}.` ||
        existingGenerationVersion.submitted_by !== opAId
      ) {
        throw new Error(
          `[Bootstrap Error] Corrupt Version 1 for generation-scoped deliverable in current epoch ${currentBucketEpoch}. Fail-closed.`,
        );
      }
    } else {
      const insertGenVersionResult = await supabase
        .from("deliverable_versions")
        .insert({
          deliverable_id: generationDeliverableId,
          version_number: 1,
          submission_url: `https://drive.google.com/file/d/demo-sandbox-metrics-cycle-epoch-${currentBucketEpoch}/view`,
          submission_provider: "google_drive",
          submission_note: `Initial master cut submission for metrics rollover cycle epoch ${currentBucketEpoch}.`,
          submitted_by: opAId,
          created_at: new Date(now.getTime() - 20 * ONE_DAY_MS).toISOString(),
        })
        .select("id")
        .single();

      assertDbSuccess(
        insertGenVersionResult,
        `Insert Version 1 for generation-scoped deliverable`,
      );
    }

    const newAuditFixtures = [
      {
        requestId: deterministicFixtureUuid(
          `s07_audit_approved_sub_${currentBucketEpoch}`,
        ),
        entityType: "deliverable" as const,
        entityId: generationDeliverableId,
        projectId: p6Id,
        action: "deliverable_version_submitted" as const,
        oldStatus: "pending",
        newStatus: "awaiting_internal_review",
        actorId: opAId,
        actorRole: "operator" as const,
        changedFields: {
          version_number: 1,
          s07_demo_fixture: "immutable-metrics-rollover",
          s07_fixture_generation: String(currentBucketEpoch),
        },
        createdAt: new Date(now.getTime() - 20 * ONE_DAY_MS).toISOString(),
      },
      {
        requestId: deterministicFixtureUuid(
          `s07_audit_approved_start_${currentBucketEpoch}`,
        ),
        entityType: "deliverable" as const,
        entityId: generationDeliverableId,
        projectId: p6Id,
        action: "internal_review_approved" as const,
        oldStatus: "awaiting_internal_review",
        newStatus: "awaiting_client_review",
        actorId: pmLeadAId,
        actorRole: "pm" as const,
        changedFields: {
          decision: "approved",
          stage: "internal",
          s07_demo_fixture: "immutable-metrics-rollover",
          s07_fixture_generation: String(currentBucketEpoch),
        },
        createdAt: new Date(now.getTime() - 18 * ONE_DAY_MS).toISOString(),
      },
      {
        requestId: deterministicFixtureUuid(
          `s07_audit_approved_act_${currentBucketEpoch}`,
        ),
        entityType: "deliverable" as const,
        entityId: generationDeliverableId,
        projectId: p6Id,
        action: "client_review_approved" as const,
        oldStatus: "awaiting_client_review",
        newStatus: "approved",
        actorId: clientA1Id,
        actorRole: "client" as const,
        changedFields: {
          decision: "approved",
          stage: "client",
          s07_demo_fixture: "immutable-metrics-rollover",
          s07_fixture_generation: String(currentBucketEpoch),
        },
        createdAt: new Date(now.getTime() - 15 * ONE_DAY_MS).toISOString(),
      },
      {
        requestId: deterministicFixtureUuid(
          `s07_audit_proj_completed_${currentBucketEpoch}`,
        ),
        entityType: "project" as const,
        entityId: p6Id,
        projectId: p6Id,
        action: "project_completed" as const,
        oldStatus: "in_progress",
        newStatus: "completed",
        actorId: adminId,
        actorRole: "admin" as const,
        changedFields: {
          unfinished_task_count: 0,
          unfinished_deliverable_count: 0,
          override_confirmed: false,
          s07_demo_fixture: "immutable-metrics-rollover",
          s07_fixture_generation: String(currentBucketEpoch),
        },
        createdAt: new Date(now.getTime() - 40 * ONE_DAY_MS).toISOString(),
      },
      {
        requestId: deterministicFixtureUuid(
          `s07_audit_proj_reopened_${currentBucketEpoch}`,
        ),
        entityType: "project" as const,
        entityId: p6Id,
        projectId: p6Id,
        action: "project_reopened" as const,
        oldStatus: "completed",
        newStatus: "in_progress",
        actorId: adminId,
        actorRole: "admin" as const,
        changedFields: {
          reopen_reason: "Stakeholder requested scope extension",
          prior_completed_at: new Date(
            now.getTime() - 40 * ONE_DAY_MS,
          ).toISOString(),
          s07_demo_fixture: "immutable-metrics-rollover",
          s07_fixture_generation: String(currentBucketEpoch),
        },
        createdAt: new Date(now.getTime() - 35 * ONE_DAY_MS).toISOString(),
      },
    ];

    for (const af of newAuditFixtures) {
      const insertAuditResult = await supabase
        .from("audit_logs")
        .insert({
          entity_type: af.entityType,
          entity_id: af.entityId,
          project_id: af.projectId,
          action: af.action,
          old_status: af.oldStatus,
          new_status: af.newStatus,
          actor_id: af.actorId,
          actor_role: af.actorRole,
          changed_fields: af.changedFields,
          request_id: af.requestId,
          created_at: af.createdAt,
        })
        .select("id")
        .single();

      assertDbSuccess(
        insertAuditResult,
        `Insert canonical audit log (${af.action})`,
      );
    }
  }

  // ===========================================================================
  // 6.5 Deterministic Invitation State (Token-Hash First Lookup)
  // ===========================================================================
  const tokenHashHex = createHash("sha256")
    .update("sandbox-demo-invitation-token-seed")
    .digest("hex");
  const byteaHash = `\\x${tokenHashHex}`;

  const inviteExistingResult = await supabase
    .from("invite_tokens")
    .select("id, status, project_id, email, role")
    .eq("token_hash", byteaHash)
    .maybeSingle();

  assertDbSuccess(
    inviteExistingResult,
    "Query Sandbox demo invitation by token hash",
  );

  if (inviteExistingResult.data) {
    const inv = inviteExistingResult.data;
    if (
      inv.project_id === p6Id &&
      inv.email.toLowerCase() === "sandbox-invitee@demo.jsf.internal" &&
      inv.role === "operator"
    ) {
      if (inv.status === "pending") {
        const updateInviteResult = await supabase
          .from("invite_tokens")
          .update({
            expires_at: new Date(now.getTime() + 7 * 86400000).toISOString(),
          })
          .eq("id", inv.id);
        assertDbSuccess(
          updateInviteResult,
          "Update Sandbox demo invitation expiration",
        );
      }
    } else {
      throw new Error(
        `[Bootstrap Error] Invitation fixture token hash collision with unexpected metadata.`,
      );
    }
  } else {
    // Check if conflicting pending record exists under email
    const emailConflictResult = await supabase
      .from("invite_tokens")
      .select("id")
      .eq("project_id", p6Id)
      .eq("email", "sandbox-invitee@demo.jsf.internal")
      .eq("status", "pending")
      .maybeSingle();

    assertDbSuccess(
      emailConflictResult,
      "Query Sandbox demo invitation by email conflict",
    );

    if (!emailConflictResult.data) {
      const insertInviteResult = await supabase
        .from("invite_tokens")
        .insert({
          project_id: p6Id,
          role: "operator",
          email: "sandbox-invitee@demo.jsf.internal",
          status: "pending",
          token_hash: byteaHash,
          expires_at: new Date(now.getTime() + 7 * 86400000).toISOString(),
          created_by: adminId,
        })
        .select("id")
        .single();

      assertDbSuccess(
        insertInviteResult,
        "Insert Sandbox demo invitation fixture",
      );
    }
  }

  // ===========================================================================
  // 7. Collaboration Comments (Across Capacities)
  // ===========================================================================
  console.log("💬 Reconciling collaboration comments...");
  const commentsToSeed = [
    {
      projectId: p1Id,
      targetId: p1Id,
      targetType: "project" as const,
      authorId: pmLeadAId,
      capacity: "pm_lead" as const,
      body: "Campaign kick-off complete. Operator A on brand guidelines, Operator B on video teaser.",
    },
    {
      projectId: p1Id,
      targetId: t1Id,
      targetType: "task" as const,
      authorId: watcherAId,
      capacity: "pm_watcher" as const,
      body: "Reviewed accessibility requirements; ensure typography adheres to WCAG 2.1 AA contrast guidelines.",
    },
    {
      projectId: p1Id,
      targetId: d1Id,
      targetType: "deliverable" as const,
      authorId: opAId,
      capacity: "operator" as const,
      body: "Revision 2 uploaded with adjusted color contrast tokens.",
    },
    {
      projectId: p1Id,
      targetId: t4Id,
      targetType: "task" as const,
      authorId: opAId,
      capacity: "operator" as const,
      body: "All legacy brand guidelines (2023-2025) organized in archive storage.",
    },
  ];

  for (const c of commentsToSeed) {
    const existingCommentResult = await supabase
      .from("collaboration_comments")
      .select("id")
      .eq("target_id", c.targetId)
      .eq("author_id", c.authorId)
      .eq("body", c.body)
      .maybeSingle();

    assertDbSuccess(
      existingCommentResult,
      `Query collaboration comment for target ${c.targetId}`,
    );

    if (!existingCommentResult.data) {
      const commentInsertResult = await supabase
        .from("collaboration_comments")
        .insert({
          project_id: c.projectId,
          target_id: c.targetId,
          target_type: c.targetType,
          author_id: c.authorId,
          author_capacity_snapshot: c.capacity,
          body: c.body,
        })
        .select("id")
        .single();

      assertDbSuccess(
        commentInsertResult,
        `Insert collaboration comment on ${c.targetType}`,
      );
    }
  }

  // ===========================================================================
  // 8. Notification Events & Recipients
  // ===========================================================================
  console.log("🔔 Reconciling notification events and recipients...");

  interface SeedRecipient {
    userId: string;
    channel: Database["public"]["Enums"]["notification_channel"];
    status: Database["public"]["Enums"]["notification_delivery_status"];
    readAt: string | null;
    createdAt?: string;
    suppressionReason?: string;
    suppressedAt?: string;
    attemptCount?: number;
  }

  interface SeedNotification {
    trigger: Database["public"]["Enums"]["notification_trigger"];
    entityType: Database["public"]["Enums"]["entity_type"];
    entityId: string;
    projectId: string;
    actorId: string;
    dedupKey: string;
    payload: Database["public"]["Tables"]["notification_events"]["Insert"]["payload"];
    createdAt?: string;
    occurredAt?: string;
    recipients: SeedRecipient[];
  }

  // 8.0 Reference Project 1 Notifications
  const refNotificationsToSeed: SeedNotification[] = [
    {
      trigger: "deliverable_submitted" as const,
      entityType: "deliverable" as const,
      entityId: d1Id,
      projectId: p1Id,
      actorId: opAId,
      dedupKey: `deliverable_submitted:${d1Id}:v1`,
      payload: {
        deliverable_title: "Brand Guidelines Master PDF",
        version_number: 1,
      },
      recipients: [
        {
          userId: pmLeadAId,
          channel: "in_app" as const,
          status: "read" as const,
          readAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          userId: pmLeadBId,
          channel: "in_app" as const,
          status: "read" as const,
          readAt: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
    },
    {
      trigger: "internal_review_approved" as const,
      entityType: "deliverable" as const,
      entityId: d1Id,
      projectId: p1Id,
      actorId: pmLeadAId,
      dedupKey: `internal_review_approved:${d1Id}:v2`,
      payload: {
        deliverable_title: "Brand Guidelines Master PDF",
        version_number: 2,
      },
      recipients: [
        {
          userId: clientA1Id,
          channel: "in_app" as const,
          status: "pending" as const,
          readAt: null, // Unread in-app notification for Client A1
        },
        {
          userId: clientA2Id,
          channel: "in_app" as const,
          status: "pending" as const,
          readAt: null, // Unread in-app notification for Client A2
        },
        {
          userId: opAId,
          channel: "in_app" as const,
          status: "read" as const,
          readAt: new Date(Date.now() - 7200000).toISOString(),
        },
      ],
    },
    {
      trigger: "task_assigned" as const,
      entityType: "task" as const,
      entityId: t2Id,
      projectId: p1Id,
      actorId: pmLeadAId,
      dedupKey: `task_assigned:${t2Id}:${opBId}`,
      payload: {
        task_title: "Hero Promo Video Production",
      },
      recipients: [
        {
          userId: opBId,
          channel: "in_app" as const,
          status: "pending" as const,
          readAt: null, // Unread in-app notification for Operator B
        },
      ],
    },
  ];

  for (const n of refNotificationsToSeed) {
    let eventId: string;
    const existingEventResult = await supabase
      .from("notification_events")
      .select("id")
      .eq("deduplication_key", n.dedupKey)
      .maybeSingle();

    assertDbSuccess(
      existingEventResult,
      `Query reference notification event ${n.dedupKey}`,
    );

    if (existingEventResult.data) {
      eventId = existingEventResult.data.id;
    } else {
      const eventInsertResult = await supabase
        .from("notification_events")
        .insert({
          trigger: n.trigger,
          entity_type: n.entityType,
          entity_id: n.entityId,
          project_id: n.projectId,
          actor_id: n.actorId,
          payload: n.payload,
          deduplication_key: n.dedupKey,
          ...(n.createdAt ? { created_at: n.createdAt } : {}),
          ...(n.occurredAt ? { occurred_at: n.occurredAt } : {}),
        })
        .select("id")
        .single();

      const eventCreated = assertDbSuccess(
        eventInsertResult,
        `Insert reference notification event ${n.dedupKey}`,
      );
      eventId = eventCreated.id;
    }

    for (const r of n.recipients) {
      const existingRecipResult = await supabase
        .from("notification_recipients")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", r.userId)
        .eq("channel", r.channel)
        .maybeSingle();

      assertDbSuccess(
        existingRecipResult,
        `Query notification recipient ${r.userId} for event ${eventId}`,
      );

      if (!existingRecipResult.data) {
        const recipInsertResult = await supabase
          .from("notification_recipients")
          .insert({
            event_id: eventId,
            user_id: r.userId,
            channel: r.channel,
            delivery_status: r.status,
            read_at: r.readAt,
            ...(r.createdAt ? { created_at: r.createdAt } : {}),
            next_attempt_at: null,
            claimed_at: null,
            claim_token: null,
            provider_message_id: null,
            provider_error_code: null,
            provider_error_message: null,
            sent_at: null,
            delivered_at: null,
            failed_at: null,
          })
          .select("id")
          .single();

        assertDbSuccess(
          recipInsertResult,
          `Insert notification recipient ${r.userId} on channel ${r.channel}`,
        );
      }
    }
  }

  // 8.1 Sandbox Standard In-App Notification Pair (Reuse before Rollover)
  console.log("  • Reconciling Sandbox standard in-app notification pair...");
  const candidateNotifEpochs = [
    currentBucketEpoch,
    currentBucketEpoch - 1,
    currentBucketEpoch - 2,
    currentBucketEpoch - 3,
  ];

  const allCandidateNotifKeys = candidateNotifEpochs.flatMap((e) => [
    `task_assigned:sandbox_overdue_task:opA:s07_b${e}`,
    `deliverable_submitted:sandbox_approved:v1:s07_b${e}`,
  ]);

  const candidateEventsResult = await supabase
    .from("notification_events")
    .select(
      "id, trigger, entity_type, entity_id, project_id, actor_id, deduplication_key, payload, created_at, occurred_at",
    )
    .in("deduplication_key", allCandidateNotifKeys);

  const foundNotifEvents = assertDbSuccess(
    candidateEventsResult,
    "Query candidate standard notification events",
  );

  const foundEventIds = foundNotifEvents.map((ev) => ev.id);
  let foundNotifRecipients: Database["public"]["Tables"]["notification_recipients"]["Row"][] =
    [];
  if (foundEventIds.length > 0) {
    const candidateRecipientsResult = await supabase
      .from("notification_recipients")
      .select("*")
      .in("event_id", foundEventIds);
    foundNotifRecipients = assertDbSuccess(
      candidateRecipientsResult,
      "Query candidate standard notification recipients",
    );
  }

  const eventsByKey = new Map(
    foundNotifEvents.map((ev) => [ev.deduplication_key, ev]),
  );
  const recipsByEventId = new Map<
    string,
    Database["public"]["Tables"]["notification_recipients"]["Row"][]
  >();
  for (const r of foundNotifRecipients) {
    const list = recipsByEventId.get(r.event_id) || [];
    list.push(r);
    recipsByEventId.set(r.event_id, list);
  }

  const reusableNotifEpochs: number[] = [];

  for (const e of candidateNotifEpochs) {
    const keyUnread = `task_assigned:sandbox_overdue_task:opA:s07_b${e}`;
    const keyRead = `deliverable_submitted:sandbox_approved:v1:s07_b${e}`;

    const evUnread = eventsByKey.get(keyUnread);
    const evRead = eventsByKey.get(keyRead);

    if (!evUnread && !evRead) {
      // Absent candidate for this epoch
      continue;
    }

    if (!evUnread || !evRead) {
      throw new Error(
        `[Bootstrap Error] Partial standard notification pair for epoch ${e}: one event present without its pair member. Fail-closed.`,
      );
    }

    // Validate event metadata and payload contracts
    const unreadPayload = evUnread.payload;
    const readPayload = evRead.payload;
    const hasExpectedUnreadPayload =
      typeof unreadPayload === "object" &&
      unreadPayload !== null &&
      !Array.isArray(unreadPayload) &&
      unreadPayload.task_title === "Sandbox Overdue Asset Review";
    const hasExpectedReadPayload =
      typeof readPayload === "object" &&
      readPayload !== null &&
      !Array.isArray(readPayload) &&
      readPayload.deliverable_title === "Sandbox Approved Master Video Cut" &&
      readPayload.version_number === 1;

    if (
      evUnread.trigger !== "task_assigned" ||
      evUnread.entity_type !== "task" ||
      evUnread.entity_id !== tOverdueId ||
      evUnread.project_id !== p6Id ||
      evUnread.actor_id !== pmLeadAId ||
      !hasExpectedUnreadPayload
    ) {
      throw new Error(
        `[Bootstrap Error] Corrupt standard unread notification event metadata for epoch ${e}. Fail-closed.`,
      );
    }

    if (
      evRead.trigger !== "deliverable_submitted" ||
      evRead.entity_type !== "deliverable" ||
      evRead.entity_id !== dApprovedId ||
      evRead.project_id !== p6Id ||
      evRead.actor_id !== opAId ||
      !hasExpectedReadPayload
    ) {
      throw new Error(
        `[Bootstrap Error] Corrupt standard read notification event metadata for epoch ${e}. Fail-closed.`,
      );
    }

    const recipsUnread = recipsByEventId.get(evUnread.id) || [];
    const recipsRead = recipsByEventId.get(evRead.id) || [];

    if (recipsUnread.length !== 1 || recipsRead.length !== 1) {
      throw new Error(
        `[Bootstrap Error] Standard notification candidate for epoch ${e} has invalid recipient cardinality (unread: ${recipsUnread.length}, read: ${recipsRead.length}). Expected exactly 1 each. Fail-closed.`,
      );
    }

    const rUnread = recipsUnread[0]!;
    const rRead = recipsRead[0]!;

    if (
      rUnread.user_id !== opAId ||
      rUnread.channel !== "in_app" ||
      rUnread.delivery_status !== "delivered" ||
      rUnread.read_at !== null
    ) {
      throw new Error(
        `[Bootstrap Error] Corrupt standard unread notification recipient state for epoch ${e}. Fail-closed.`,
      );
    }

    if (
      rRead.user_id !== opAId ||
      rRead.channel !== "in_app" ||
      rRead.delivery_status !== "delivered" ||
      rRead.read_at === null
    ) {
      throw new Error(
        `[Bootstrap Error] Corrupt standard read notification recipient state for epoch ${e}. Fail-closed.`,
      );
    }

    const unreadEventCreatedAt = new Date(evUnread.created_at).getTime();
    const unreadEventOccurredAt = new Date(evUnread.occurred_at).getTime();
    const unreadRecipientCreatedAt = new Date(rUnread.created_at).getTime();
    const readEventCreatedAt = new Date(evRead.created_at).getTime();
    const readEventOccurredAt = new Date(evRead.occurred_at).getTime();
    const readRecipientCreatedAt = new Date(rRead.created_at).getTime();
    const timestampsAreCoherent =
      Number.isFinite(unreadEventCreatedAt) &&
      Number.isFinite(unreadEventOccurredAt) &&
      Number.isFinite(unreadRecipientCreatedAt) &&
      Number.isFinite(readEventCreatedAt) &&
      Number.isFinite(readEventOccurredAt) &&
      Number.isFinite(readRecipientCreatedAt) &&
      Math.abs(unreadEventCreatedAt - unreadEventOccurredAt) <= 1000 &&
      Math.abs(unreadEventCreatedAt - unreadRecipientCreatedAt) <= 1000 &&
      Math.abs(readEventCreatedAt - readEventOccurredAt) <= 1000 &&
      Math.abs(readEventCreatedAt - readRecipientCreatedAt) <= 1000;

    if (!timestampsAreCoherent) {
      throw new Error(
        `[Bootstrap Error] Corrupt standard notification event/recipient timestamps for epoch ${e}. Fail-closed.`,
      );
    }

    // Validate 90-day presentation usability
    const ageUnread = now.getTime() - new Date(rUnread.created_at).getTime();
    const ageRead = now.getTime() - new Date(rRead.created_at).getTime();
    const isUsable =
      ageUnread >= 0 &&
      ageUnread <= NINETY_DAYS_MS &&
      ageRead >= 0 &&
      ageRead <= NINETY_DAYS_MS;

    if (isUsable) {
      reusableNotifEpochs.push(e);
    }
  }

  if (reusableNotifEpochs.length > 1) {
    throw new Error(
      `[Bootstrap Error] Multiple reusable standard notification pairs found (${reusableNotifEpochs.join(", ")}). Fail-closed.`,
    );
  }

  if (reusableNotifEpochs.length === 1) {
    console.log(
      `  ✓ Reusing existing valid standard notification pair from epoch ${reusableNotifEpochs[0]}`,
    );
  } else {
    console.log(
      `  ➕ Inserting new standard in-app notification pair for epoch ${currentBucketEpoch}...`,
    );
    const newUnreadKey = `task_assigned:sandbox_overdue_task:opA:s07_b${currentBucketEpoch}`;
    const newReadKey = `deliverable_submitted:sandbox_approved:v1:s07_b${currentBucketEpoch}`;

    const insertUnreadEvent = await supabase
      .from("notification_events")
      .insert({
        trigger: "task_assigned",
        entity_type: "task",
        entity_id: tOverdueId,
        project_id: p6Id,
        actor_id: pmLeadAId,
        deduplication_key: newUnreadKey,
        payload: { task_title: "Sandbox Overdue Asset Review" },
        created_at: new Date(now.getTime() - 4 * ONE_DAY_MS).toISOString(),
        occurred_at: new Date(now.getTime() - 4 * ONE_DAY_MS).toISOString(),
      })
      .select("id")
      .single();

    const createdUnreadEvent = assertDbSuccess(
      insertUnreadEvent,
      "Insert standard unread notification event",
    );

    const insertUnreadRecip = await supabase
      .from("notification_recipients")
      .insert({
        event_id: createdUnreadEvent.id,
        user_id: opAId,
        channel: "in_app",
        delivery_status: "delivered",
        read_at: null,
        created_at: new Date(now.getTime() - 4 * ONE_DAY_MS).toISOString(),
        next_attempt_at: null,
        claimed_at: null,
        claim_token: null,
        provider_message_id: null,
        provider_error_code: null,
        provider_error_message: null,
        sent_at: null,
        delivered_at: null,
        failed_at: null,
      })
      .select("id")
      .single();

    assertDbSuccess(
      insertUnreadRecip,
      "Insert standard unread notification recipient",
    );

    const insertReadEvent = await supabase
      .from("notification_events")
      .insert({
        trigger: "deliverable_submitted",
        entity_type: "deliverable",
        entity_id: dApprovedId,
        project_id: p6Id,
        actor_id: opAId,
        deduplication_key: newReadKey,
        payload: {
          deliverable_title: "Sandbox Approved Master Video Cut",
          version_number: 1,
        },
        created_at: new Date(now.getTime() - 2 * ONE_DAY_MS).toISOString(),
        occurred_at: new Date(now.getTime() - 2 * ONE_DAY_MS).toISOString(),
      })
      .select("id")
      .single();

    const createdReadEvent = assertDbSuccess(
      insertReadEvent,
      "Insert standard read notification event",
    );

    const insertReadRecip = await supabase
      .from("notification_recipients")
      .insert({
        event_id: createdReadEvent.id,
        user_id: opAId,
        channel: "in_app",
        delivery_status: "delivered",
        read_at: new Date(now.getTime() - 1 * ONE_DAY_MS).toISOString(),
        created_at: new Date(now.getTime() - 2 * ONE_DAY_MS).toISOString(),
        next_attempt_at: null,
        claimed_at: null,
        claim_token: null,
        provider_message_id: null,
        provider_error_code: null,
        provider_error_message: null,
        sent_at: null,
        delivered_at: null,
        failed_at: null,
      })
      .select("id")
      .single();

    assertDbSuccess(
      insertReadRecip,
      "Insert standard read notification recipient",
    );
  }

  // 8.2 Older 91–93-Day History Notification Fixture (1-Day Epoch Granularity)
  console.log(
    "  • Reconciling Sandbox 91–93-day historic notification fixture...",
  );
  const histEventsResult = await supabase
    .from("notification_events")
    .select(
      "id, trigger, entity_type, entity_id, project_id, actor_id, deduplication_key, payload, created_at, occurred_at",
    )
    .like("deduplication_key", "sandbox_historical_event_92d:%");

  const foundHistEvents = assertDbSuccess(
    histEventsResult,
    "Query historic notification events by prefix",
  );

  const histEventIds = foundHistEvents.map((ev) => ev.id);
  let foundHistRecipients: Database["public"]["Tables"]["notification_recipients"]["Row"][] =
    [];
  if (histEventIds.length > 0) {
    const histRecipientsResult = await supabase
      .from("notification_recipients")
      .select("*")
      .in("event_id", histEventIds);
    foundHistRecipients = assertDbSuccess(
      histRecipientsResult,
      "Query historic notification recipients",
    );
  }

  const histRecipsByEventId = new Map<
    string,
    Database["public"]["Tables"]["notification_recipients"]["Row"][]
  >();
  for (const r of foundHistRecipients) {
    const list = histRecipsByEventId.get(r.event_id) || [];
    list.push(r);
    histRecipsByEventId.set(r.event_id, list);
  }

  const reusableHistFixtures: Array<{
    event: (typeof foundHistEvents)[0];
    recipient: (typeof foundHistRecipients)[0];
  }> = [];

  for (const ev of foundHistEvents) {
    const recips = histRecipsByEventId.get(ev.id) || [];
    const opRecips = recips.filter(
      (r) => r.user_id === opAId && r.channel === "in_app",
    );

    if (recips.length !== 1 || opRecips.length !== 1) {
      // Not a compliant single-recipient fixture
      continue;
    }

    const r = opRecips[0]!;
    const recipAgeMs = now.getTime() - new Date(r.created_at).getTime();
    const isAgeValid =
      recipAgeMs >= 91 * ONE_DAY_MS && recipAgeMs <= 93 * ONE_DAY_MS;
    const isStateValid =
      r.delivery_status === "delivered" && r.read_at !== null;
    const evCreatedAt = new Date(ev.created_at).getTime();
    const evOccurredAt = new Date(ev.occurred_at).getTime();
    const recipientCreatedAt = new Date(r.created_at).getTime();
    const isEventCoherent =
      Number.isFinite(evCreatedAt) &&
      Number.isFinite(evOccurredAt) &&
      Number.isFinite(recipientCreatedAt) &&
      ev.trigger === "task_assigned" &&
      ev.entity_type === "task" &&
      ev.entity_id === tUpcomingId &&
      ev.project_id === p6Id &&
      ev.actor_id === pmLeadAId &&
      Math.abs(evCreatedAt - evOccurredAt) <= 1000 &&
      Math.abs(evCreatedAt - recipientCreatedAt) <= 1000;

    if (isAgeValid && isStateValid && isEventCoherent) {
      reusableHistFixtures.push({ event: ev, recipient: r });
    }
  }

  if (reusableHistFixtures.length > 1) {
    throw new Error(
      `[Bootstrap Error] Found ${reusableHistFixtures.length} reusable historic notification fixtures in 91-93 day range. Expected at most 1. Fail-closed.`,
    );
  }

  if (reusableHistFixtures.length === 1) {
    console.log(
      `  ✓ Reusing existing valid 91–93-day historic notification fixture (${reusableHistFixtures[0]!.event.deduplication_key})`,
    );
  } else {
    const historicEpoch = Math.floor(now.getTime() / ONE_DAY_MS);
    const historicDeduplicationKey = `sandbox_historical_event_92d:${historicEpoch}`;

    const exactKeyResult = await supabase
      .from("notification_events")
      .select("id, trigger, entity_type, entity_id, project_id, actor_id")
      .eq("deduplication_key", historicDeduplicationKey)
      .maybeSingle();

    const existingExactKey = assertDbSuccess(
      exactKeyResult,
      "Query exact historic event key",
    );

    if (existingExactKey) {
      throw new Error(
        `[Bootstrap Error] Historic event with key ${historicDeduplicationKey} already exists but lacks a reusable 91-93 day recipient. Fail-closed.`,
      );
    }

    console.log(
      `  ➕ Inserting new historic notification fixture (${historicDeduplicationKey})...`,
    );

    const insertHistEvent = await supabase
      .from("notification_events")
      .insert({
        trigger: "task_assigned",
        entity_type: "task",
        entity_id: tUpcomingId,
        project_id: p6Id,
        actor_id: pmLeadAId,
        deduplication_key: historicDeduplicationKey,
        payload: { task_title: "Historical Sandbox Asset Generation" },
        created_at: new Date(now.getTime() - 92 * ONE_DAY_MS).toISOString(),
        occurred_at: new Date(now.getTime() - 92 * ONE_DAY_MS).toISOString(),
      })
      .select("id")
      .single();

    const createdHistEvent = assertDbSuccess(
      insertHistEvent,
      "Insert historic notification event",
    );

    const insertHistRecip = await supabase
      .from("notification_recipients")
      .insert({
        event_id: createdHistEvent.id,
        user_id: opAId,
        channel: "in_app",
        delivery_status: "delivered",
        created_at: new Date(now.getTime() - 92 * ONE_DAY_MS).toISOString(),
        read_at: new Date(now.getTime() - 90 * ONE_DAY_MS).toISOString(),
        next_attempt_at: null,
        claimed_at: null,
        claim_token: null,
        provider_message_id: null,
        provider_error_code: null,
        provider_error_message: null,
        sent_at: null,
        delivered_at: null,
        failed_at: null,
      })
      .select("id")
      .single();

    assertDbSuccess(insertHistRecip, "Insert historic notification recipient");
  }

  // 8.3 Sandbox External Suppression Fixture (Singular Fixture Preservation)
  console.log("  • Reconciling Sandbox external suppression fixture...");
  const suppEventsResult = await supabase
    .from("notification_events")
    .select(
      "id, trigger, entity_type, entity_id, project_id, actor_id, deduplication_key",
    )
    .like("deduplication_key", "sandbox_external_suppression_event:%");

  const foundSuppEvents = assertDbSuccess(
    suppEventsResult,
    "Query suppression notification events by prefix",
  );

  if (foundSuppEvents.length > 1) {
    throw new Error(
      `[Bootstrap Error] Found ${foundSuppEvents.length} S07 suppression fixtures. Expected at most 1. Fail-closed.`,
    );
  }

  if (foundSuppEvents.length === 1) {
    const suppEvent = foundSuppEvents[0]!;
    if (
      suppEvent.trigger !== "deliverable_submitted" ||
      suppEvent.entity_type !== "deliverable" ||
      suppEvent.entity_id !== dApprovedId ||
      suppEvent.project_id !== p6Id ||
      suppEvent.actor_id !== opAId
    ) {
      throw new Error(
        `[Bootstrap Error] Suppression event metadata does not match expected Sandbox deliverable contract. Fail-closed.`,
      );
    }

    const suppRecipsResult = await supabase
      .from("notification_recipients")
      .select("*")
      .eq("event_id", suppEvent.id);

    const foundSuppRecips = assertDbSuccess(
      suppRecipsResult,
      "Query suppression notification recipients",
    );

    if (foundSuppRecips.length !== 1) {
      throw new Error(
        `[Bootstrap Error] Suppression event has invalid recipient count (${foundSuppRecips.length}). Expected exactly 1. Fail-closed.`,
      );
    }

    const r = foundSuppRecips[0]!;
    const isCompliant =
      r.user_id === opAId &&
      r.channel === "email" &&
      r.delivery_status === "suppressed" &&
      r.suppression_reason === "provider_disabled" &&
      r.attempt_count === 0 &&
      r.next_attempt_at === null &&
      r.claimed_at === null &&
      r.claim_token === null &&
      r.provider_message_id === null &&
      r.provider_error_code === null &&
      r.provider_error_message === null &&
      r.sent_at === null &&
      r.delivered_at === null &&
      r.read_at === null &&
      r.failed_at === null;

    if (!isCompliant) {
      throw new Error(
        `[Bootstrap Error] Corrupt suppression fixture recipient topology or non-compliant terminal state. Fail-closed.`,
      );
    }

    const updateSuppResult = await supabase
      .from("notification_recipients")
      .update({
        suppressed_at: new Date(now.getTime() - 5 * ONE_DAY_MS).toISOString(),
      })
      .eq("id", r.id);

    assertDbSuccess(
      updateSuppResult,
      "Update Sandbox Suppression Notification recipient suppressed_at",
    );
    console.log(
      "  ✓ Reused existing singular suppression fixture and refreshed suppressed_at",
    );
  } else {
    console.log("  ➕ Inserting singular suppression notification fixture...");
    const suppDedupKey = `sandbox_external_suppression_event:s07_b${currentBucketEpoch}`;

    const insertSuppEvent = await supabase
      .from("notification_events")
      .insert({
        trigger: "deliverable_submitted",
        entity_type: "deliverable",
        entity_id: dApprovedId,
        project_id: p6Id,
        actor_id: opAId,
        deduplication_key: suppDedupKey,
        payload: {
          deliverable_title: "Sandbox Approved Master Video Cut",
          version_number: 1,
        },
        created_at: new Date(now.getTime() - 5 * ONE_DAY_MS).toISOString(),
        occurred_at: new Date(now.getTime() - 5 * ONE_DAY_MS).toISOString(),
      })
      .select("id")
      .single();

    const createdSuppEvent = assertDbSuccess(
      insertSuppEvent,
      "Insert suppression notification event",
    );

    const insertSuppRecip = await supabase
      .from("notification_recipients")
      .insert({
        event_id: createdSuppEvent.id,
        user_id: opAId,
        channel: "email",
        delivery_status: "suppressed",
        suppression_reason: "provider_disabled",
        suppressed_at: new Date(now.getTime() - 5 * ONE_DAY_MS).toISOString(),
        attempt_count: 0,
        created_at: new Date(now.getTime() - 5 * ONE_DAY_MS).toISOString(),
        read_at: null,
        next_attempt_at: null,
        claimed_at: null,
        claim_token: null,
        provider_message_id: null,
        provider_error_code: null,
        provider_error_message: null,
        sent_at: null,
        delivered_at: null,
        failed_at: null,
      })
      .select("id")
      .single();

    assertDbSuccess(
      insertSuppRecip,
      "Insert suppression notification recipient",
    );
  }

  // ===========================================================================
  // 9. Calendar Feed Milestone Events (Reference & Sandbox)
  // ===========================================================================
  console.log("📅 Reconciling calendar milestone events...");
  const milestoneExistingResult = await supabase
    .from("calendar_events")
    .select("id")
    .eq("project_id", p1Id)
    .eq("title", "Campaign Launch Review Milestone")
    .maybeSingle();

  assertDbSuccess(milestoneExistingResult, "Query calendar milestone event");

  if (!milestoneExistingResult.data) {
    const milestoneInsertResult = await supabase
      .from("calendar_events")
      .insert({
        project_id: p1Id,
        title: "Campaign Launch Review Milestone",
        description: "Executive stakeholder review for final campaign assets.",
        event_type: "milestone",
        starts_at: new Date(Date.now() + 25 * 86400000).toISOString(),
        ends_at: new Date(Date.now() + 25 * 86400000).toISOString(),
        is_all_day: true,
        created_by: adminId,
      })
      .select("id")
      .single();

    assertDbSuccess(milestoneInsertResult, "Insert calendar milestone event");
  }

  // 9.1 Sandbox Task-Scoped Milestone (Operator A visible)
  const taskMilestoneExistingResult = await supabase
    .from("calendar_events")
    .select("id")
    .eq("project_id", p6Id)
    .eq("title", "Sandbox Operator Checkpoint")
    .eq(
      "description",
      "S07 demo fixture: task-scoped milestone for Operator A visibility",
    )
    .maybeSingle();

  assertDbSuccess(
    taskMilestoneExistingResult,
    "Query Sandbox Task-Scoped Milestone",
  );

  if (taskMilestoneExistingResult.data) {
    const updateTaskMilestone = await supabase
      .from("calendar_events")
      .update({
        starts_at: new Date(now.getTime() + 12 * 86400000).toISOString(),
        ends_at: new Date(now.getTime() + 12 * 86400000).toISOString(),
      })
      .eq("id", taskMilestoneExistingResult.data.id);
    assertDbSuccess(
      updateTaskMilestone,
      "Update Sandbox Task-Scoped Milestone bounds",
    );
  } else {
    const insertTaskMilestone = await supabase
      .from("calendar_events")
      .insert({
        project_id: p6Id,
        task_id: tUpcomingId,
        title: "Sandbox Operator Checkpoint",
        description:
          "S07 demo fixture: task-scoped milestone for Operator A visibility",
        event_type: "milestone",
        starts_at: new Date(now.getTime() + 12 * 86400000).toISOString(),
        ends_at: new Date(now.getTime() + 12 * 86400000).toISOString(),
        is_all_day: true,
        created_by: adminId,
      })
      .select("id")
      .single();

    assertDbSuccess(
      insertTaskMilestone,
      "Insert Sandbox Task-Scoped Milestone",
    );
  }

  // 9.2 Sandbox Project-Scoped Milestone (Admin/PM only)
  const projMilestoneExistingResult = await supabase
    .from("calendar_events")
    .select("id")
    .eq("project_id", p6Id)
    .eq("title", "Sandbox Project Review")
    .eq(
      "description",
      "S07 demo fixture: project-scoped milestone for Admin/PM only",
    )
    .maybeSingle();

  assertDbSuccess(
    projMilestoneExistingResult,
    "Query Sandbox Project-Scoped Milestone",
  );

  if (projMilestoneExistingResult.data) {
    const updateProjMilestone = await supabase
      .from("calendar_events")
      .update({
        starts_at: new Date(now.getTime() + 20 * 86400000).toISOString(),
        ends_at: new Date(now.getTime() + 20 * 86400000).toISOString(),
      })
      .eq("id", projMilestoneExistingResult.data.id);
    assertDbSuccess(
      updateProjMilestone,
      "Update Sandbox Project-Scoped Milestone bounds",
    );
  } else {
    const insertProjMilestone = await supabase
      .from("calendar_events")
      .insert({
        project_id: p6Id,
        task_id: null,
        title: "Sandbox Project Review",
        description:
          "S07 demo fixture: project-scoped milestone for Admin/PM only",
        event_type: "milestone",
        starts_at: new Date(now.getTime() + 20 * 86400000).toISOString(),
        ends_at: new Date(now.getTime() + 20 * 86400000).toISOString(),
        is_all_day: true,
        created_by: adminId,
      })
      .select("id")
      .single();

    assertDbSuccess(
      insertProjMilestone,
      "Insert Sandbox Project-Scoped Milestone",
    );
  }
}

// =============================================================================
// Main Bootstrap Execution
// =============================================================================

async function main() {
  console.log("🚀 Starting Joya Star Films PM App Demo Data Bootstrap...");
  try {
    const userMap = await reconcileAuthUsers();
    const adminId = userMap["demo-admin@demo.jsf.internal"]!;
    const orgMap = await reconcileClientsAndContacts(adminId, userMap);
    await reconcileProjectsAndCorpus(userMap, orgMap);

    console.log(
      "\n===========================================================",
    );
    console.log("🎉 Demo Bootstrap Complete!");
    console.log("===========================================================");
    console.log("Summary of reconciled demo corpus on jsf-pm-dev:");
    console.log(
      ` • 9 Synthetic Demo Personas (Admin, PM Leads, Watcher, Operators, Clients)`,
    );
    console.log(
      ` • 2 Client Organizations (Acme Corp, Starlight Media) + 3 Client Contacts`,
    );
    console.log(` • 6 Projects:`);
    console.log(
      `   - [Reference] Acme Brand Relaunch (Multi-Lead, High/Blocking/Medium/Low Tasks, Re-Review Chain, Submissions)`,
    );
    console.log(
      `   - [Reference] Internal Workflow Automation (Internal tooling, No Client, No Deliverables)`,
    );
    console.log(
      `   - [Reference] Acme Commercial Q1 (Completed with Canonical Audit Log)`,
    );
    console.log(`   - [Reference] Acme Teaser 2025 (Archived Project)`);
    console.log(
      `   - [Isolation] Starlight Summer Campaign (Isolated Starlight Media Client Data)`,
    );
    console.log(
      `   - [Sandbox]   Acme Sandbox Campaign (Designated Interactive Demo Workspace)`,
    );
    console.log(
      ` • Collaboration Comments (PM Lead, Watcher, Operator stamps)`,
    );
    console.log(
      ` • Notification Events & Recipients (Read, Unread, 92-Day History, and Suppressed Email queues)`,
    );
    console.log(
      ` • Calendar Milestones (Task-Scoped & Project-Scoped) and Completion Cycle Evidence`,
    );
    console.log(
      ` • Deterministic Pending Invitation Fixture (Sandbox Project Scope)`,
    );
    console.log(
      "===========================================================\n",
    );
  } catch (err) {
    console.error("❌ Bootstrap failed loudly with error:", err);
    process.exit(1);
  }
}

main();
