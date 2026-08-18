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

  // Sandbox initial task & deliverable
  let t6Id: string;
  const t6ExistingResult = await supabase
    .from("tasks")
    .select("id")
    .eq("project_id", p6Id)
    .eq("title", "Sandbox Initial Onboarding Task")
    .maybeSingle();

  assertDbSuccess(
    t6ExistingResult,
    "Query Sandbox Task (Sandbox Initial Onboarding Task)",
  );

  if (t6ExistingResult.data) {
    t6Id = t6ExistingResult.data.id;
  } else {
    const t6InsertResult = await supabase
      .from("tasks")
      .insert({
        project_id: p6Id,
        title: "Sandbox Initial Onboarding Task",
        task_type: "internal_work",
        priority: "medium",
        status: "pending",
        assignee_id: opAId,
        has_deliverables: true,
        description:
          "Demonstration task available for interactive transition, assignee updates, and submission testing.",
        deadline_at: new Date(Date.now() + 14 * 86400000).toISOString(),
        created_by: pmLeadAId,
      })
      .select("id")
      .single();

    const t6Created = assertDbSuccess(
      t6InsertResult,
      "Insert Sandbox Task (Sandbox Initial Onboarding Task)",
    );
    t6Id = t6Created.id;
  }

  const d6ExistingResult = await supabase
    .from("deliverables")
    .select("id")
    .eq("task_id", t6Id)
    .eq("title", "Sandbox Demo Asset")
    .maybeSingle();

  assertDbSuccess(
    d6ExistingResult,
    "Query Sandbox Deliverable (Sandbox Demo Asset)",
  );

  if (!d6ExistingResult.data) {
    const d6InsertResult = await supabase
      .from("deliverables")
      .insert({
        task_id: t6Id,
        project_id: p6Id,
        title: "Sandbox Demo Asset",
        workflow_type: "production",
        status: "pending",
        assignee_id: opAId,
        created_by: pmLeadAId,
        specifications: "Sandbox specification for demonstration purposes.",
        current_version_number: 1,
        internal_review_deadline_at: new Date(
          Date.now() + 5 * 86400000,
        ).toISOString(),
        client_delivery_deadline_at: new Date(
          Date.now() + 10 * 86400000,
        ).toISOString(),
      })
      .select("id")
      .single();

    assertDbSuccess(
      d6InsertResult,
      "Insert Sandbox Deliverable (Sandbox Demo Asset)",
    );
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
  // 8. Notification Events & Recipients (Including Unread in_app Notifications)
  // ===========================================================================
  console.log("🔔 Reconciling notification events and recipients...");
  const notificationsToSeed = [
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

  for (const n of notificationsToSeed) {
    let eventId: string;
    const existingEventResult = await supabase
      .from("notification_events")
      .select("id")
      .eq("deduplication_key", n.dedupKey)
      .maybeSingle();

    assertDbSuccess(
      existingEventResult,
      `Query notification event ${n.dedupKey}`,
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
        })
        .select("id")
        .single();

      const eventCreated = assertDbSuccess(
        eventInsertResult,
        `Insert notification event ${n.dedupKey}`,
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

  // ===========================================================================
  // 9. Calendar Feed Milestone Events
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
      ` • Notification Events & Recipients (Read and Unread in_app queues)`,
    );
    console.log(` • Calendar Milestones and Completion Cycle Evidence`);
    console.log(
      "===========================================================\n",
    );
  } catch (err) {
    console.error("❌ Bootstrap failed loudly with error:", err);
    process.exit(1);
  }
}

main();
