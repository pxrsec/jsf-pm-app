-- Migration: S02-E02 Authoritative Data Platform & Access Controls
-- Timestamp: 20260818143500
-- Reference: dev-docs/specs/s02/database-schema-v1.6-s02-reconciled.md
-- Spec: dev-docs/specs/s02/s02-e02-authoritative-data-platform-and-access-controls-v1.0.md

begin;

-- ============================================================================
-- 1. EXTENSIONS & SCHEMAS
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- ============================================================================
-- 2. ENUMERATED TYPES
-- ============================================================================

create type public.app_role as enum ('admin', 'pm', 'operator', 'client');

create type public.project_type as enum ('client', 'internal');
create type public.project_status as enum (
  'planning', 'in_progress', 'paused', 'completed', 'cancelled'
);

create type public.project_member_type as enum (
  'pm_lead', 'pm_watcher', 'operator', 'client'
);

create type public.collaboration_target_type as enum (
  'project', 'task', 'deliverable'
);

create type public.collaboration_author_capacity as enum (
  'admin', 'pm_lead', 'pm_watcher', 'operator'
);

create type public.task_status as enum (
  'pending', 'in_progress', 'in_review', 'completed', 'blocked'
);

create type public.task_type as enum ('internal_work', 'client_request');
create type public.task_priority as enum ('low', 'medium', 'high', 'blocking');

create type public.deliverable_workflow_type as enum (
  'production', 'client_submission'
);

create type public.deliverable_status as enum (
  'pending',
  'awaiting_internal_review',
  'awaiting_client_review',
  'approved',
  'changes_requested',
  'delivered',
  'submitted'
);

create type public.submission_provider as enum (
  'google_drive', 'dropbox', 'onedrive', 'wetransfer', 'frame_io', 'other_https'
);

create type public.review_stage as enum ('internal', 'client');
create type public.review_decision as enum ('approved', 'changes_requested');

create type public.notification_channel as enum ('in_app', 'whatsapp', 'email');
create type public.notification_delivery_status as enum (
  'pending', 'processing', 'sent', 'delivered', 'read', 'failed', 'cancelled'
);

create type public.notification_trigger as enum (
  'user_invited',
  'project_assigned',
  'task_assigned',
  'task_status_changed',
  'client_task_blocking',
  'client_submission_received',
  'client_submission_reopened',
  'deliverable_submitted',
  'internal_changes_requested',
  'internal_review_approved',
  'client_changes_requested',
  'client_review_approved',
  'deliverable_delivered',
  'deadline_24h',
  'deadline_12h',
  'deadline_6h',
  'deadline_overdue',
  'review_inactivity_reminder',
  'link_reported_broken',
  'invite_expiring',
  'system'
);

create type public.entity_type as enum (
  'profile', 'client', 'project', 'project_member', 'task', 'deliverable',
  'deliverable_version', 'feedback', 'calendar_event', 'notification',
  'invite_token', 'collaboration_comment', 'link_report'
);

create type public.invite_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type public.whatsapp_template_status as enum (
  'draft', 'pending_approval', 'approved', 'paused', 'rejected', 'disabled'
);
create type public.link_report_status as enum ('open', 'resolved', 'dismissed');
create type public.calendar_event_type as enum (
  'project_deadline', 'task_deadline', 'internal_review_deadline',
  'client_delivery_deadline', 'milestone'
);

-- ============================================================================
-- 3. TABLES (Canonical Build Order)
-- ============================================================================

-- 3.1 Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  role public.app_role not null,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  phone_e164 text,
  preferred_locale text not null default 'es-MX'
    check (preferred_locale in ('es-MX', 'en-US')),
  timezone text not null default 'America/Mexico_City',
  avatar_url text check (avatar_url is null or (char_length(avatar_url) <= 2048 and avatar_url ~ '^https://')),
  whatsapp_opt_in boolean not null default false,
  whatsapp_consent_at timestamptz,
  whatsapp_consent_ip inet,
  whatsapp_consent_source text,
  email_notifications_enabled boolean not null default true,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint profiles_whatsapp_consent_ck check (
    whatsapp_opt_in = false
    or (whatsapp_consent_at is not null and whatsapp_consent_ip is not null)
  )
);

-- 3.2 Clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null check (char_length(btrim(legal_name)) between 1 and 160),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  slug text not null check (char_length(btrim(slug)) between 1 and 120),
  notes text check (notes is null or char_length(notes) <= 5000),
  default_drive_folder_url text check (default_drive_folder_url is null or (char_length(default_drive_folder_url) <= 2048 and default_drive_folder_url ~ '^https://')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 3.3 WhatsApp Templates
create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  logical_name text not null,
  meta_template_name text not null,
  meta_template_id text,
  language_code text not null default 'es_MX',
  category text not null,
  status public.whatsapp_template_status not null default 'draft',
  version integer not null default 1,
  variable_schema jsonb not null default '{}'::jsonb,
  body_preview text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint whatsapp_templates_variable_schema_object_ck check (jsonb_typeof(variable_schema) = 'object'),
  constraint whatsapp_templates_variable_schema_size_ck check (octet_length(variable_schema::text) <= 16384)
);

-- 3.4 Client Contacts
create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  profile_id uuid references public.profiles(id) on delete set null,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  email citext not null,
  phone_e164 text,
  job_title text check (job_title is null or char_length(btrim(job_title)) <= 120),
  is_primary boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 3.5 Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete restrict,
  project_type public.project_type not null default 'client',
  status public.project_status not null default 'planning',
  name text not null check (char_length(btrim(name)) between 1 and 160),
  internal_description text not null,
  client_scope text,
  deadline_at timestamptz not null,
  drive_folder_url text check (drive_folder_url is null or (char_length(drive_folder_url) <= 2048 and drive_folder_url ~ '^https://')),
  completed_at timestamptz,
  archived_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint projects_type_client_ck check (
    (project_type = 'client' and client_id is not null)
    or (project_type = 'internal' and client_id is null)
  )
);

-- 3.6 Project Members
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  member_type public.project_member_type not null,
  is_primary boolean not null default false,
  receives_notifications boolean not null default true,
  joined_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint project_members_is_primary_lead_only_ck check (
    is_primary = false or member_type = 'pm_lead'
  )
);

-- 3.7 Tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  assignee_id uuid not null references public.profiles(id) on delete restrict,
  task_type public.task_type not null default 'internal_work',
  title text not null check (char_length(btrim(title)) between 1 and 180),
  description text not null check (char_length(description) <= 20000),
  status public.task_status not null default 'pending',
  priority public.task_priority not null default 'medium',
  has_deliverables boolean not null default false,
  deadline_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 3.8 Task Resources
create table public.task_resources (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  url text not null check (char_length(url) <= 2048 and url ~ '^https://'),
  sort_order smallint not null default 0 check (sort_order >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 3.9 Deliverables
create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  task_id uuid not null references public.tasks(id) on delete restrict,
  assignee_id uuid not null references public.profiles(id) on delete restrict,
  workflow_type public.deliverable_workflow_type not null default 'production',
  title text not null check (char_length(btrim(title)) between 1 and 180),
  specifications text not null check (char_length(specifications) <= 30000),
  status public.deliverable_status not null default 'pending',
  current_version_number integer not null default 0 check (current_version_number >= 0),
  internal_review_deadline_at timestamptz,
  client_delivery_deadline_at timestamptz,
  submission_deadline_at timestamptz,
  last_activity_at timestamptz not null default now(),
  is_stalled boolean not null default false,
  stalled_at timestamptz,
  approved_at timestamptz,
  delivered_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint deliverables_production_ck check (
    workflow_type <> 'production'
    or (
      internal_review_deadline_at is not null
      and client_delivery_deadline_at is not null
      and client_delivery_deadline_at >= internal_review_deadline_at
      and submission_deadline_at is null
      and status <> 'submitted'
    )
  ),
  constraint deliverables_client_submission_ck check (
    workflow_type <> 'client_submission'
    or (
      submission_deadline_at is not null
      and internal_review_deadline_at is null
      and client_delivery_deadline_at is null
      and status in ('pending', 'submitted')
    )
  )
);

-- 3.10 Deliverable Versions
create table public.deliverable_versions (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.deliverables(id) on delete restrict,
  version_number integer not null check (version_number >= 1),
  submission_url text not null check (char_length(submission_url) <= 2048 and submission_url ~ '^https://'),
  submission_provider public.submission_provider not null,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submission_note text check (submission_note is null or char_length(submission_note) <= 5000),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 3.11 Deliverable Feedback
create table public.deliverable_feedback (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.deliverables(id) on delete restrict,
  version_id uuid not null references public.deliverable_versions(id) on delete restrict,
  stage public.review_stage not null,
  decision public.review_decision not null,
  comments text,
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint feedback_changes_requested_comments_ck check (
    decision <> 'changes_requested'
    or (comments is not null and char_length(btrim(comments)) > 0)
  )
);

-- 3.12 Collaboration Comments
create table public.collaboration_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  target_type public.collaboration_target_type not null,
  target_id uuid not null,
  author_id uuid not null references public.profiles(id) on delete restrict,
  author_capacity_snapshot public.collaboration_author_capacity not null,
  body text not null check (char_length(btrim(body)) between 1 and 20000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

-- 3.13 Calendar Events
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  event_type public.calendar_event_type not null default 'milestone',
  title text not null check (char_length(btrim(title)) between 1 and 180),
  description text check (description is null or char_length(description) <= 10000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_all_day boolean not null default true,
  color_override text check (color_override is null or color_override ~ '^#[0-9a-fA-F]{6}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint calendar_events_ends_at_ck check (ends_at is null or ends_at >= starts_at),
  constraint calendar_events_milestone_only_ck check (event_type = 'milestone')
);

-- 3.14 Deliverable Link Reports
create table public.deliverable_link_reports (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.deliverables(id) on delete restrict,
  version_id uuid references public.deliverable_versions(id) on delete restrict,
  reported_by uuid not null references auth.users(id) on delete restrict,
  reason text check (reason is null or char_length(btrim(reason)) <= 2000),
  status public.link_report_status not null default 'open',
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_note text check (resolution_note is null or char_length(btrim(resolution_note)) <= 2000),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3.15 Invite Tokens
create table public.invite_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash bytea not null unique,
  email citext not null,
  role public.app_role not null check (role in ('operator', 'client')),
  project_id uuid references public.projects(id) on delete restrict,
  client_id uuid references public.clients(id) on delete restrict,
  status public.invite_status not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- 3.16 Notification Events
create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  trigger public.notification_trigger not null,
  entity_type public.entity_type not null,
  entity_id uuid,
  project_id uuid references public.projects(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  deduplication_key text not null unique,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint notification_events_payload_object_ck check (jsonb_typeof(payload) = 'object'),
  constraint notification_events_payload_size_ck check (octet_length(payload::text) <= 16384)
);

-- 3.17 Notification Recipients
create table public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  channel public.notification_channel not null,
  template_id uuid references public.whatsapp_templates(id) on delete restrict,
  delivery_status public.notification_delivery_status not null default 'pending',
  attempt_count smallint not null default 0 check (attempt_count between 0 and 10),
  next_attempt_at timestamptz default now(),
  claimed_at timestamptz,
  claim_token uuid,
  provider_message_id text,
  provider_error_code text,
  provider_error_message text check (provider_error_message is null or char_length(provider_error_message) <= 2000),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_recipients_template_ck check (
    channel <> 'whatsapp' or template_id is not null
  )
);

-- 3.18 Audit Logs
create table public.audit_logs (
  id bigint generated always as identity primary key,
  entity_type public.entity_type not null,
  entity_id uuid not null,
  project_id uuid references public.projects(id) on delete set null,
  action text not null,
  old_status text,
  new_status text,
  changed_fields jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role public.app_role,
  request_id uuid,
  ip_address inet,
  user_agent text check (user_agent is null or char_length(user_agent) <= 512),
  created_at timestamptz not null default now(),
  constraint audit_logs_changed_fields_object_ck check (jsonb_typeof(changed_fields) = 'object'),
  constraint audit_logs_changed_fields_size_ck check (octet_length(changed_fields::text) <= 16384)
);

-- ============================================================================
-- 4. TRIGGERS & PROCEDURAL AUTOMATION
-- ============================================================================

-- 4.1 Update Timestamp Trigger Function
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger set_clients_updated_at
  before update on public.clients
  for each row execute function private.set_updated_at();

create trigger set_whatsapp_templates_updated_at
  before update on public.whatsapp_templates
  for each row execute function private.set_updated_at();

create trigger set_client_contacts_updated_at
  before update on public.client_contacts
  for each row execute function private.set_updated_at();

create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function private.set_updated_at();

create trigger set_project_members_updated_at
  before update on public.project_members
  for each row execute function private.set_updated_at();

create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute function private.set_updated_at();

create trigger set_task_resources_updated_at
  before update on public.task_resources
  for each row execute function private.set_updated_at();

create trigger set_deliverables_updated_at
  before update on public.deliverables
  for each row execute function private.set_updated_at();

create trigger set_calendar_events_updated_at
  before update on public.calendar_events
  for each row execute function private.set_updated_at();

create trigger set_deliverable_link_reports_updated_at
  before update on public.deliverable_link_reports
  for each row execute function private.set_updated_at();

create trigger set_notification_recipients_updated_at
  before update on public.notification_recipients
  for each row execute function private.set_updated_at();

-- 4.2 Prevent Immutable Mutation Function
create or replace function private.prevent_immutable_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Immutable records in % cannot be updated or deleted', TG_TABLE_NAME;
end;
$$;

create trigger prevent_audit_logs_mutation
  before update or delete on public.audit_logs
  for each row execute function private.prevent_immutable_mutation();

create trigger prevent_notification_events_mutation
  before update or delete on public.notification_events
  for each row execute function private.prevent_immutable_mutation();

create trigger prevent_deliverable_versions_mutation
  before update or delete on public.deliverable_versions
  for each row execute function private.prevent_immutable_mutation();

create trigger prevent_deliverable_feedback_mutation
  before update or delete on public.deliverable_feedback
  for each row execute function private.prevent_immutable_mutation();

-- 4.3 Deliverable Project Consistency & Workflow Validation Trigger
create or replace function private.sync_and_validate_deliverable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_task record;
  v_project record;
  v_assignee_role public.app_role;
  v_assignee_member_type public.project_member_type;
begin
  select t.project_id, t.has_deliverables, t.task_type, t.deleted_at
  into v_task
  from public.tasks t
  where t.id = NEW.task_id;

  if not found or v_task.deleted_at is not null then
    raise exception 'Deliverable task % not found or deleted', NEW.task_id;
  end if;

  if not v_task.has_deliverables then
    raise exception 'Parent task % does not allow deliverables (has_deliverables is false)', NEW.task_id;
  end if;

  -- Ensure denormalized project_id matches task's project_id
  NEW.project_id := v_task.project_id;

  select p.project_type, p.deleted_at
  into v_project
  from public.projects p
  where p.id = NEW.project_id;

  if not found or v_project.deleted_at is not null then
    raise exception 'Deliverable project % not found or deleted', NEW.project_id;
  end if;

  if v_project.project_type = 'internal' then
    raise exception 'Internal projects cannot contain deliverables';
  end if;

  -- Check assignee membership in project
  select pm.member_type, pr.role
  into v_assignee_member_type, v_assignee_role
  from public.project_members pm
  join public.profiles pr on pr.id = pm.user_id
  where pm.project_id = NEW.project_id
    and pm.user_id = NEW.assignee_id
    and pm.deleted_at is null
    and pr.deleted_at is null
    and pr.is_active = true;

  if not found then
    raise exception 'Assignee % is not an active member of project %', NEW.assignee_id, NEW.project_id;
  end if;

  if NEW.workflow_type = 'client_submission' then
    if v_task.task_type <> 'client_request' then
      raise exception 'Client submission deliverables require a parent client_request task';
    end if;
    if v_assignee_member_type <> 'client' then
      raise exception 'Client submission deliverables must be assigned to an active Client member';
    end if;
  else
    if v_assignee_member_type not in ('pm_lead', 'pm_watcher', 'operator') then
      raise exception 'Production deliverables must be assigned to a PM or Operator';
    end if;
  end if;

  return NEW;
end;
$$;

create trigger deliverable_sync_and_validate_trg
  before insert or update on public.deliverables
  for each row execute function private.sync_and_validate_deliverable();

-- 4.4 Task Assignee & Project Compatibility Trigger
create or replace function private.validate_task()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_project record;
  v_assignee_member_type public.project_member_type;
begin
  select p.project_type, p.deleted_at
  into v_project
  from public.projects p
  where p.id = NEW.project_id;

  if not found or v_project.deleted_at is not null then
    raise exception 'Task project % not found or deleted', NEW.project_id;
  end if;

  select pm.member_type
  into v_assignee_member_type
  from public.project_members pm
  join public.profiles pr on pr.id = pm.user_id
  where pm.project_id = NEW.project_id
    and pm.user_id = NEW.assignee_id
    and pm.deleted_at is null
    and pr.deleted_at is null
    and pr.is_active = true;

  if not found then
    raise exception 'Assignee % is not an active member of project %', NEW.assignee_id, NEW.project_id;
  end if;

  if NEW.task_type = 'client_request' then
    if v_project.project_type <> 'client' then
      raise exception 'Client request tasks are only permitted on client projects';
    end if;
    if v_assignee_member_type <> 'client' then
      raise exception 'Client request tasks must be assigned to an active Client member';
    end if;
  else
    if v_assignee_member_type not in ('pm_lead', 'pm_watcher', 'operator') then
      raise exception 'Internal work tasks must be assigned to a PM or Operator';
    end if;
  end if;

  return NEW;
end;
$$;

create trigger task_validate_trg
  before insert or update on public.tasks
  for each row execute function private.validate_task();

-- 4.5 Deferred Project Membership Validation Trigger
create or replace function private.validate_project_memberships()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_proj record;
  v_primary_leads integer;
  v_leads integer;
  v_clients integer;
begin
  -- Identify affected project IDs
  for v_proj in
    select distinct p.id, p.project_type, p.status, p.deleted_at
    from public.projects p
    where p.deleted_at is null
      and p.status <> 'cancelled'
      and (
        (TG_TABLE_NAME = 'projects' and p.id = NEW.id)
        or (TG_TABLE_NAME = 'project_members' and (p.id = NEW.project_id or (TG_OP = 'DELETE' and p.id = OLD.project_id)))
      )
  loop
    select
      count(*) filter (where member_type = 'pm_lead' and is_primary = true),
      count(*) filter (where member_type = 'pm_lead'),
      count(*) filter (where member_type = 'client')
    into v_primary_leads, v_leads, v_clients
    from public.project_members
    where project_id = v_proj.id
      and deleted_at is null;

    if v_leads < 1 then
      raise exception 'Active project % must have at least one active PM Lead', v_proj.id;
    end if;

    if v_primary_leads <> 1 then
      raise exception 'Active project % must have exactly one active primary PM Lead (found %)', v_proj.id, v_primary_leads;
    end if;

    if v_proj.project_type = 'client' and v_clients < 1 then
      raise exception 'Active client project % must have at least one active Client member', v_proj.id;
    end if;

    if v_proj.project_type = 'internal' and v_clients > 0 then
      raise exception 'Active internal project % cannot have Client members', v_proj.id;
    end if;
  end loop;

  -- Validate role compatibility for inserted/updated project_members
  if TG_TABLE_NAME = 'project_members' and TG_OP in ('INSERT', 'UPDATE') and NEW.deleted_at is null then
    declare
      v_role public.app_role;
    begin
      select role into v_role from public.profiles where id = NEW.user_id;
      if NEW.member_type in ('pm_lead', 'pm_watcher') and v_role not in ('pm', 'admin') then
        raise exception 'Member % with role % cannot be assigned capacity %', NEW.user_id, v_role, NEW.member_type;
      elsif NEW.member_type = 'operator' and v_role not in ('operator', 'admin') then
        raise exception 'Member % with role % cannot be assigned capacity operator', NEW.user_id, v_role;
      elsif NEW.member_type = 'client' and v_role <> 'client' then
        raise exception 'Member % with role % cannot be assigned capacity client', NEW.user_id, v_role;
      end if;
    end;
  end if;

  return null;
end;
$$;

create constraint trigger project_members_deferred_validation_trg
  after insert or update or delete on public.project_members
  deferrable initially deferred
  for each row execute function private.validate_project_memberships();

create constraint trigger projects_deferred_validation_trg
  after insert or update on public.projects
  deferrable initially deferred
  for each row execute function private.validate_project_memberships();

-- ============================================================================
-- 5. PRIVATE AUTHORIZATION HELPERS
-- ============================================================================

create or replace function private.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active = true
    and p.deleted_at is null;
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.is_active = true
      and p.deleted_at is null
  );
$$;

create or replace function private.is_pm()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin', 'pm')
      and p.is_active = true
      and p.deleted_at is null
  );
$$;

create or replace function private.is_project_member(project_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.project_members pm
    join public.profiles p on p.id = pm.user_id
    where pm.project_id = project_uuid
      and pm.user_id = (select auth.uid())
      and pm.deleted_at is null
      and p.is_active = true
      and p.deleted_at is null
  );
$$;

create or replace function private.is_project_pm(project_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.project_members pm
    join public.profiles p on p.id = pm.user_id
    where pm.project_id = project_uuid
      and pm.user_id = (select auth.uid())
      and pm.member_type in ('pm_lead', 'pm_watcher')
      and pm.deleted_at is null
      and p.is_active = true
      and p.deleted_at is null
  ) or (select private.is_admin());
$$;

create or replace function private.is_project_lead(project_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.project_members pm
    join public.profiles p on p.id = pm.user_id
    where pm.project_id = project_uuid
      and pm.user_id = (select auth.uid())
      and pm.member_type = 'pm_lead'
      and pm.deleted_at is null
      and p.is_active = true
      and p.deleted_at is null
  ) or (select private.is_admin());
$$;

create or replace function private.is_project_watcher(project_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.project_members pm
    join public.profiles p on p.id = pm.user_id
    where pm.project_id = project_uuid
      and pm.user_id = (select auth.uid())
      and pm.member_type = 'pm_watcher'
      and pm.deleted_at is null
      and p.is_active = true
      and p.deleted_at is null
  );
$$;

create or replace function private.is_project_operator(project_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.project_members pm
    join public.profiles p on p.id = pm.user_id
    where pm.project_id = project_uuid
      and pm.user_id = (select auth.uid())
      and pm.member_type = 'operator'
      and pm.deleted_at is null
      and p.is_active = true
      and p.deleted_at is null
  );
$$;

create or replace function private.is_project_client(project_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.project_members pm
    join public.profiles p on p.id = pm.user_id
    where pm.project_id = project_uuid
      and pm.user_id = (select auth.uid())
      and pm.member_type = 'client'
      and pm.deleted_at is null
      and p.is_active = true
      and p.deleted_at is null
  );
$$;

create or replace function private.is_task_assignee(task_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.tasks t
    join public.profiles p on p.id = t.assignee_id
    where t.id = task_uuid
      and t.assignee_id = (select auth.uid())
      and t.deleted_at is null
      and p.is_active = true
      and p.deleted_at is null
  );
$$;

create or replace function private.is_client_task_assignee(task_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.tasks t
    join public.profiles p on p.id = t.assignee_id
    where t.id = task_uuid
      and t.task_type = 'client_request'
      and t.assignee_id = (select auth.uid())
      and t.deleted_at is null
      and p.role = 'client'
      and p.is_active = true
      and p.deleted_at is null
  );
$$;

create or replace function private.is_deliverable_assignee(deliverable_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.deliverables d
    join public.profiles p on p.id = d.assignee_id
    where d.id = deliverable_uuid
      and d.assignee_id = (select auth.uid())
      and d.deleted_at is null
      and p.is_active = true
      and p.deleted_at is null
  );
$$;

create or replace function private.is_client_submission_assignee(deliverable_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.deliverables d
    join public.profiles p on p.id = d.assignee_id
    where d.id = deliverable_uuid
      and d.workflow_type = 'client_submission'
      and d.assignee_id = (select auth.uid())
      and d.deleted_at is null
      and p.role = 'client'
      and p.is_active = true
      and p.deleted_at is null
  );
$$;

revoke all on function private.current_user_role() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.is_pm() from public;
revoke all on function private.is_project_member(uuid) from public;
revoke all on function private.is_project_pm(uuid) from public;
revoke all on function private.is_project_lead(uuid) from public;
revoke all on function private.is_project_watcher(uuid) from public;
revoke all on function private.is_project_operator(uuid) from public;
revoke all on function private.is_project_client(uuid) from public;
revoke all on function private.is_task_assignee(uuid) from public;
revoke all on function private.is_client_task_assignee(uuid) from public;
revoke all on function private.is_deliverable_assignee(uuid) from public;
revoke all on function private.is_client_submission_assignee(uuid) from public;

grant execute on function private.current_user_role() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_pm() to authenticated;
grant execute on function private.is_project_member(uuid) to authenticated;
grant execute on function private.is_project_pm(uuid) to authenticated;
grant execute on function private.is_project_lead(uuid) to authenticated;
grant execute on function private.is_project_watcher(uuid) to authenticated;
grant execute on function private.is_project_operator(uuid) to authenticated;
grant execute on function private.is_project_client(uuid) to authenticated;
grant execute on function private.is_task_assignee(uuid) to authenticated;
grant execute on function private.is_client_task_assignee(uuid) to authenticated;
grant execute on function private.is_deliverable_assignee(uuid) to authenticated;
grant execute on function private.is_client_submission_assignee(uuid) to authenticated;

-- ============================================================================
-- 6. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_resources enable row level security;
alter table public.deliverables enable row level security;
alter table public.deliverable_versions enable row level security;
alter table public.deliverable_feedback enable row level security;
alter table public.collaboration_comments enable row level security;
alter table public.calendar_events enable row level security;
alter table public.deliverable_link_reports enable row level security;
alter table public.invite_tokens enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_recipients enable row level security;
alter table public.whatsapp_templates enable row level security;
alter table public.audit_logs enable row level security;

revoke all on all tables in schema public from anon;

-- 6.1 profiles
create policy profiles_select_policy on public.profiles
for select to authenticated
using (
  (select private.is_admin())
  or id = (select auth.uid())
  or exists (
    select 1
    from public.project_members pm1
    join public.project_members pm2 on pm1.project_id = pm2.project_id
    where pm1.user_id = (select auth.uid())
      and pm2.user_id = profiles.id
      and pm1.deleted_at is null
      and pm2.deleted_at is null
  )
);

create policy profiles_update_policy on public.profiles
for update to authenticated
using (
  (select private.is_admin())
  or (
    id = (select auth.uid())
    and role = (select p.role from public.profiles p where p.id = (select auth.uid()))
    and is_active = true
    and deleted_at is null
  )
);

-- 6.2 clients
create policy clients_select_policy on public.clients
for select to authenticated
using (
  deleted_at is null and (
    (select private.is_admin())
    or exists (
      select 1
      from public.projects p
      join public.project_members pm on pm.project_id = p.id
      where p.client_id = clients.id
        and pm.user_id = (select auth.uid())
        and pm.deleted_at is null
        and p.deleted_at is null
    )
  )
);

create policy clients_insert_policy on public.clients
for insert to authenticated
with check ((select private.is_admin()) or (select private.is_pm()));

create policy clients_update_policy on public.clients
for update to authenticated
using (
  deleted_at is null and ((select private.is_admin()) or (select private.is_pm()))
);

-- 6.3 client_contacts
create policy client_contacts_select_policy on public.client_contacts
for select to authenticated
using (
  deleted_at is null and (
    (select private.is_admin())
    or (select private.is_pm())
    or exists (
      select 1
      from public.projects p
      join public.project_members pm on pm.project_id = p.id
      where p.client_id = client_contacts.client_id
        and pm.user_id = (select auth.uid())
        and pm.member_type = 'client'
        and pm.deleted_at is null
        and p.deleted_at is null
    )
  )
);

create policy client_contacts_insert_policy on public.client_contacts
for insert to authenticated
with check ((select private.is_admin()) or (select private.is_pm()));

create policy client_contacts_update_policy on public.client_contacts
for update to authenticated
using (
  deleted_at is null and ((select private.is_admin()) or (select private.is_pm()))
);

-- 6.4 projects
create policy projects_select_policy on public.projects
for select to authenticated
using (
  deleted_at is null and (
    (select private.is_admin())
    or (select private.is_project_member(id))
  )
);

create policy projects_insert_policy on public.projects
for insert to authenticated
with check ((select private.is_admin()) or (select private.is_pm()));

create policy projects_update_policy on public.projects
for update to authenticated
using (
  deleted_at is null and (
    (select private.is_admin())
    or (select private.is_project_lead(id))
  )
);

-- 6.5 project_members
create policy project_members_select_policy on public.project_members
for select to authenticated
using (
  deleted_at is null and (
    (select private.is_admin())
    or (select private.is_project_pm(project_id))
    or user_id = (select auth.uid())
  )
);

create policy project_members_insert_policy on public.project_members
for insert to authenticated
with check (
  (select private.is_admin())
  or (select private.is_project_lead(project_id))
);

create policy project_members_update_policy on public.project_members
for update to authenticated
using (
  (select private.is_admin())
  or (select private.is_project_lead(project_id))
);

create policy project_members_delete_policy on public.project_members
for delete to authenticated
using (
  (select private.is_admin())
  or (select private.is_project_lead(project_id))
);

-- 6.6 tasks
create policy tasks_select_policy on public.tasks
for select to authenticated
using (
  deleted_at is null and (
    (select private.is_admin())
    or (select private.is_project_pm(project_id))
    or assignee_id = (select auth.uid())
  )
);

create policy tasks_insert_policy on public.tasks
for insert to authenticated
with check (
  (select private.is_admin())
  or (select private.is_project_lead(project_id))
);

create policy tasks_update_policy on public.tasks
for update to authenticated
using (
  deleted_at is null and (
    (select private.is_admin())
    or (select private.is_project_lead(project_id))
  )
);

-- 6.7 task_resources
create policy task_resources_select_policy on public.task_resources
for select to authenticated
using (
  deleted_at is null and (
    (select private.is_admin())
    or exists (
      select 1
      from public.tasks t
      where t.id = task_resources.task_id
        and t.deleted_at is null
        and (
          (select private.is_project_pm(t.project_id))
          or t.assignee_id = (select auth.uid())
        )
    )
  )
);

create policy task_resources_insert_policy on public.task_resources
for insert to authenticated
with check (
  (select private.is_admin())
  or exists (
    select 1
    from public.tasks t
    where t.id = task_resources.task_id
      and (select private.is_project_lead(t.project_id))
  )
);

create policy task_resources_update_policy on public.task_resources
for update to authenticated
using (
  deleted_at is null and (
    (select private.is_admin())
    or exists (
      select 1
      from public.tasks t
      where t.id = task_resources.task_id
        and (select private.is_project_lead(t.project_id))
    )
  )
);

-- 6.8 deliverables
create policy deliverables_select_policy on public.deliverables
for select to authenticated
using (
  deleted_at is null and (
    (select private.is_admin())
    or (select private.is_project_pm(project_id))
    or assignee_id = (select auth.uid())
    or (
      workflow_type = 'production'
      and status in ('awaiting_client_review', 'approved', 'delivered', 'changes_requested')
      and (select private.is_project_client(project_id))
    )
  )
);

create policy deliverables_insert_policy on public.deliverables
for insert to authenticated
with check (
  (select private.is_admin())
  or (select private.is_project_lead(project_id))
);

create policy deliverables_update_policy on public.deliverables
for update to authenticated
using (
  deleted_at is null and (
    (select private.is_admin())
    or (select private.is_project_lead(project_id))
  )
);

-- 6.9 deliverable_versions
create policy deliverable_versions_select_policy on public.deliverable_versions
for select to authenticated
using (
  exists (
    select 1
    from public.deliverables d
    where d.id = deliverable_versions.deliverable_id
      and d.deleted_at is null
      and (
        (select private.is_admin())
        or (select private.is_project_pm(d.project_id))
        or d.assignee_id = (select auth.uid())
        or (
          d.workflow_type = 'production'
          and d.status in ('awaiting_client_review', 'approved', 'delivered', 'changes_requested')
          and (select private.is_project_client(d.project_id))
        )
      )
  )
);

-- 6.10 deliverable_feedback
create policy deliverable_feedback_select_policy on public.deliverable_feedback
for select to authenticated
using (
  exists (
    select 1
    from public.deliverables d
    where d.id = deliverable_feedback.deliverable_id
      and d.deleted_at is null
      and (
        (select private.is_admin())
        or (select private.is_project_pm(d.project_id))
        or d.assignee_id = (select auth.uid())
        or (
          deliverable_feedback.stage = 'client'
          and (select private.is_project_client(d.project_id))
        )
      )
  )
);

-- 6.11 collaboration_comments
create policy collaboration_comments_select_policy on public.collaboration_comments
for select to authenticated
using (
  deleted_at is null and (
    (select private.is_admin())
    or (select private.is_project_pm(project_id))
    or (target_type = 'task' and (select private.is_task_assignee(target_id)))
    or (target_type = 'deliverable' and (select private.is_deliverable_assignee(target_id)))
  )
);

create policy collaboration_comments_insert_policy on public.collaboration_comments
for insert to authenticated
with check (
  (select private.is_admin())
  or (select private.is_project_pm(project_id))
  or (target_type = 'task' and (select private.is_task_assignee(target_id)))
  or (target_type = 'deliverable' and (select private.is_deliverable_assignee(target_id)))
);

create policy collaboration_comments_update_policy on public.collaboration_comments
for update to authenticated
using (
  deleted_at is null and (
    (select private.is_admin())
    or author_id = (select auth.uid())
  )
);

-- 6.12 calendar_events
create policy calendar_events_select_policy on public.calendar_events
for select to authenticated
using (
  deleted_at is null and (
    (select private.is_admin())
    or (select private.is_project_member(project_id))
  )
);

create policy calendar_events_insert_policy on public.calendar_events
for insert to authenticated
with check (
  (select private.is_admin())
  or (select private.is_project_lead(project_id))
);

create policy calendar_events_update_policy on public.calendar_events
for update to authenticated
using (
  deleted_at is null and (
    (select private.is_admin())
    or (select private.is_project_lead(project_id))
  )
);

-- 6.13 deliverable_link_reports
create policy deliverable_link_reports_select_policy on public.deliverable_link_reports
for select to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1
    from public.deliverables d
    where d.id = deliverable_link_reports.deliverable_id
      and (
        (select private.is_project_pm(d.project_id))
        or deliverable_link_reports.reported_by = (select auth.uid())
        or d.assignee_id = (select auth.uid())
      )
  )
);

create policy deliverable_link_reports_insert_policy on public.deliverable_link_reports
for insert to authenticated
with check (
  (select private.is_admin())
  or exists (
    select 1
    from public.deliverables d
    where d.id = deliverable_link_reports.deliverable_id
      and (
        (select private.is_project_pm(d.project_id))
        or (select private.is_project_client(d.project_id))
      )
  )
);

create policy deliverable_link_reports_update_policy on public.deliverable_link_reports
for update to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1
    from public.deliverables d
    where d.id = deliverable_link_reports.deliverable_id
      and (select private.is_project_lead(d.project_id))
  )
);

-- 6.14 invite_tokens
create policy invite_tokens_select_policy on public.invite_tokens
for select to authenticated
using ((select private.is_admin()) or (select private.is_pm()));

create policy invite_tokens_insert_policy on public.invite_tokens
for insert to authenticated
with check ((select private.is_admin()) or (select private.is_pm()));

create policy invite_tokens_update_policy on public.invite_tokens
for update to authenticated
using ((select private.is_admin()) or (select private.is_pm()));

-- 6.15 notification_events
create policy notification_events_select_policy on public.notification_events
for select to authenticated
using ((select private.is_admin()));

-- 6.16 notification_recipients
create policy notification_recipients_select_policy on public.notification_recipients
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
);

-- 6.17 whatsapp_templates
create policy whatsapp_templates_select_policy on public.whatsapp_templates
for select to authenticated
using ((select private.is_admin()) or (select private.is_pm()));

create policy whatsapp_templates_insert_policy on public.whatsapp_templates
for insert to authenticated
with check ((select private.is_admin()));

create policy whatsapp_templates_update_policy on public.whatsapp_templates
for update to authenticated
using ((select private.is_admin()));

-- 6.18 audit_logs
create policy audit_logs_select_policy on public.audit_logs
for select to authenticated
using ((select private.is_admin()));

-- ============================================================================
-- 7. TRANSACTIONAL RPC FUNCTIONS
-- ============================================================================

-- 7.1 Accept Invite
create or replace function public.accept_invite(p_token_hash bytea)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_invite record;
  v_user_email citext;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required to accept invite';
  end if;

  select email into v_user_email
  from auth.users
  where id = v_user_id;

  select *
  into v_invite
  from public.invite_tokens
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'Invalid or not found invitation token';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'Invitation is no longer pending (status: %)', v_invite.status;
  end if;

  if v_invite.expires_at <= now() then
    update public.invite_tokens set status = 'expired' where id = v_invite.id;
    raise exception 'Invitation token has expired';
  end if;

  if v_invite.revoked_at is not null then
    update public.invite_tokens set status = 'revoked' where id = v_invite.id;
    raise exception 'Invitation token has been revoked';
  end if;

  if lower(v_invite.email::text) <> lower(v_user_email::text) then
    raise exception 'User email % does not match invitation recipient email %', v_user_email, v_invite.email;
  end if;

  -- Mark accepted
  update public.invite_tokens
  set status = 'accepted',
      accepted_at = now(),
      accepted_by = v_user_id
  where id = v_invite.id;

  -- Update or create profile
  insert into public.profiles (
    id,
    role,
    full_name,
    is_active
  ) values (
    v_user_id,
    v_invite.role,
    coalesce((select raw_user_meta_data->>'full_name' from auth.users where id = v_user_id), split_part(v_user_email::text, '@', 1)),
    true
  )
  on conflict (id) do update
  set role = v_invite.role,
      is_active = true,
      deleted_at = null,
      updated_at = now();

  -- Associate project if applicable
  if v_invite.project_id is not null then
    declare
      v_member_type public.project_member_type;
    begin
      if v_invite.role = 'operator' then
        v_member_type := 'operator';
      elsif v_invite.role = 'client' then
        v_member_type := 'client';
      else
        v_member_type := 'pm_lead';
      end if;

      insert into public.project_members (
        project_id,
        user_id,
        member_type,
        created_by
      ) values (
        v_invite.project_id,
        v_user_id,
        v_member_type,
        v_invite.created_by
      )
      on conflict do nothing;
    end;
  end if;

  -- Associate client contact if applicable
  if v_invite.client_id is not null and v_invite.role = 'client' then
    update public.client_contacts
    set profile_id = v_user_id,
        updated_at = now()
    where client_id = v_invite.client_id
      and email = v_invite.email
      and profile_id is null;
  end if;

  -- Audit log
  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    'invite_token',
    v_invite.id,
    v_invite.project_id,
    'invite_accepted',
    jsonb_build_object(
      'email', v_invite.email,
      'role', v_invite.role,
      'project_id', v_invite.project_id,
      'client_id', v_invite.client_id
    ),
    v_user_id,
    v_invite.role
  );

  return jsonb_build_object(
    'success', true,
    'role', v_invite.role,
    'project_id', v_invite.project_id,
    'client_id', v_invite.client_id
  );
end;
$$;

-- 7.2 Project Readiness Check
create or replace function public.get_project_completion_readiness(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_unfinished_tasks jsonb;
  v_unfinished_deliverables jsonb;
  v_task_count integer;
  v_deliverable_count integer;
begin
  if not ((select private.is_admin()) or (select private.is_project_pm(p_project_id))) then
    raise exception 'Not authorized to check project readiness';
  end if;

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'status', t.status,
        'assignee_id', t.assignee_id
      ) order by t.deadline_at asc
    ), '[]'::jsonb),
    count(*)
  into v_unfinished_tasks, v_task_count
  from public.tasks t
  where t.project_id = p_project_id
    and t.deleted_at is null
    and t.status <> 'completed';

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'title', d.title,
        'status', d.status,
        'workflow_type', d.workflow_type,
        'assignee_id', d.assignee_id
      ) order by d.created_at asc
    ), '[]'::jsonb),
    count(*)
  into v_unfinished_deliverables, v_deliverable_count
  from public.deliverables d
  where d.project_id = p_project_id
    and d.deleted_at is null
    and d.status <> 'delivered';

  return jsonb_build_object(
    'project_id', p_project_id,
    'is_ready', (v_task_count = 0 and v_deliverable_count = 0),
    'unfinished_task_count', v_task_count,
    'unfinished_tasks', v_unfinished_tasks,
    'unfinished_deliverable_count', v_deliverable_count,
    'unfinished_deliverables', v_unfinished_deliverables
  );
end;
$$;

-- 7.3 Transition Project Status
create or replace function public.transition_project_status(
  p_project_id uuid,
  p_next_status public.project_status,
  p_confirm_unfinished boolean default false,
  p_reopen_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_proj record;
  v_readiness jsonb;
  v_old_status public.project_status;
  v_user_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_prior_completed_at timestamptz;
begin
  if not ((select private.is_admin()) or (select private.is_project_lead(p_project_id))) then
    raise exception 'Only an active PM Lead or Admin can transition project status';
  end if;

  select * into v_proj
  from public.projects
  where id = p_project_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Project % not found or deleted', p_project_id;
  end if;

  v_old_status := v_proj.status;
  v_actor_role := (select private.current_user_role());

  -- Transition Validation
  if v_old_status = 'cancelled' then
    raise exception 'Cancelled project cannot be transitioned directly; use recover_project_status';
  elsif v_old_status = 'completed' then
    if p_next_status <> 'in_progress' then
      raise exception 'Completed project can only transition to in_progress (reopen)';
    end if;
    if p_reopen_reason is null or char_length(btrim(p_reopen_reason)) = 0 then
      raise exception 'Reopening a completed project requires a non-empty reason';
    end if;
  else
    if p_next_status = v_old_status then
      return jsonb_build_object('project_id', p_project_id, 'status', v_old_status);
    end if;
  end if;

  -- Handle Completion
  if p_next_status = 'completed' then
    v_readiness := public.get_project_completion_readiness(p_project_id);
    if not (v_readiness->>'is_ready')::boolean and not p_confirm_unfinished then
      raise exception 'Project has % unfinished tasks and % unfinished deliverables; explicit confirm_unfinished required',
        v_readiness->>'unfinished_task_count',
        v_readiness->>'unfinished_deliverable_count';
    end if;

    update public.projects
    set status = 'completed',
        completed_at = now(),
        updated_by = v_user_id,
        updated_at = now()
    where id = p_project_id;

    -- Audit log
    insert into public.audit_logs (
      entity_type,
      entity_id,
      project_id,
      action,
      old_status,
      new_status,
      changed_fields,
      actor_id,
      actor_role
    ) values (
      'project',
      p_project_id,
      p_project_id,
      'project_completed',
      v_old_status::text,
      'completed',
      jsonb_build_object(
        'unfinished_task_count', v_readiness->'unfinished_task_count',
        'unfinished_deliverable_count', v_readiness->'unfinished_deliverable_count',
        'override_confirmed', p_confirm_unfinished
      ),
      v_user_id,
      v_actor_role
    );

    -- Notification event
    insert into public.notification_events (
      trigger,
      entity_type,
      entity_id,
      project_id,
      actor_id,
      payload,
      deduplication_key
    ) values (
      'system',
      'project',
      p_project_id,
      p_project_id,
      v_user_id,
      jsonb_build_object('action', 'project_completed', 'project_name', v_proj.name),
      'project_completed:' || p_project_id || ':' || extract(epoch from now())::bigint
    ) on conflict do nothing;

  -- Handle Reopening
  elsif v_old_status = 'completed' and p_next_status = 'in_progress' then
    v_prior_completed_at := v_proj.completed_at;

    update public.projects
    set status = 'in_progress',
        completed_at = null,
        updated_by = v_user_id,
        updated_at = now()
    where id = p_project_id;

    insert into public.audit_logs (
      entity_type,
      entity_id,
      project_id,
      action,
      old_status,
      new_status,
      changed_fields,
      actor_id,
      actor_role
    ) values (
      'project',
      p_project_id,
      p_project_id,
      'project_reopened',
      'completed',
      'in_progress',
      jsonb_build_object(
        'reopen_reason', p_reopen_reason,
        'prior_completed_at', v_prior_completed_at
      ),
      v_user_id,
      v_actor_role
    );

    insert into public.notification_events (
      trigger,
      entity_type,
      entity_id,
      project_id,
      actor_id,
      payload,
      deduplication_key
    ) values (
      'system',
      'project',
      p_project_id,
      p_project_id,
      v_user_id,
      jsonb_build_object('action', 'project_reopened', 'reopen_reason', p_reopen_reason),
      'project_reopened:' || p_project_id || ':' || extract(epoch from now())::bigint
    ) on conflict do nothing;

  -- Other Transitions
  else
    update public.projects
    set status = p_next_status,
        updated_by = v_user_id,
        updated_at = now()
    where id = p_project_id;

    insert into public.audit_logs (
      entity_type,
      entity_id,
      project_id,
      action,
      old_status,
      new_status,
      changed_fields,
      actor_id,
      actor_role
    ) values (
      'project',
      p_project_id,
      p_project_id,
      'project_status_changed',
      v_old_status::text,
      p_next_status::text,
      '{}'::jsonb,
      v_user_id,
      v_actor_role
    );
  end if;

  return jsonb_build_object(
    'project_id', p_project_id,
    'old_status', v_old_status,
    'new_status', p_next_status
  );
end;
$$;

-- 7.4 Recover Project Status (Admin Only)
create or replace function public.recover_project_status(
  p_project_id uuid,
  p_target_status public.project_status,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_proj record;
  v_user_id uuid := auth.uid();
  v_old_status public.project_status;
begin
  if not (select private.is_admin()) then
    raise exception 'Only Admin can recover project status';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'Recovery reason is mandatory';
  end if;

  select * into v_proj
  from public.projects
  where id = p_project_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Project % not found or deleted', p_project_id;
  end if;

  v_old_status := v_proj.status;

  update public.projects
  set status = p_target_status,
      completed_at = case when p_target_status = 'completed' then now() else null end,
      updated_by = v_user_id,
      updated_at = now()
  where id = p_project_id;

  -- Admin recovery audit event
  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    old_status,
    new_status,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    'project',
    p_project_id,
    p_project_id,
    'admin_project_recovered',
    v_old_status::text,
    p_target_status::text,
    jsonb_build_object('recovery', true, 'reason', p_reason),
    v_user_id,
    'admin'
  );

  return jsonb_build_object(
    'project_id', p_project_id,
    'old_status', v_old_status,
    'target_status', p_target_status,
    'recovered', true
  );
end;
$$;

-- 7.5 Transition Task Status
create or replace function public.transition_task_status(
  p_task_id uuid,
  p_next_status public.task_status,
  p_reopen_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_task record;
  v_user_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_is_lead boolean;
  v_is_client_assignee boolean;
  v_is_operator_assignee boolean;
  v_pending_submissions integer;
begin
  select * into v_task
  from public.tasks
  where id = p_task_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Task % not found or deleted', p_task_id;
  end if;

  v_actor_role := (select private.current_user_role());
  v_is_lead := (select private.is_admin()) or (select private.is_project_lead(v_task.project_id));
  v_is_client_assignee := (v_task.task_type = 'client_request' and v_task.assignee_id = v_user_id and v_actor_role = 'client');
  v_is_operator_assignee := (v_task.assignee_id = v_user_id and v_actor_role = 'operator');

  if v_is_client_assignee then
    -- Client assignee constrained transitions
    if v_task.status = 'pending' and p_next_status in ('in_progress', 'completed') then
      null;
    elsif v_task.status = 'in_progress' and p_next_status = 'completed' then
      null;
    else
      raise exception 'Client assignees can only transition pending -> in_progress/completed or in_progress -> completed';
    end if;

    if p_next_status = 'completed' then
      select count(*)
      into v_pending_submissions
      from public.deliverables
      where task_id = p_task_id
        and workflow_type = 'client_submission'
        and status <> 'submitted'
        and deleted_at is null;

      if v_pending_submissions > 0 then
        raise exception 'Cannot complete client request task while % client submissions remain unsubmitted', v_pending_submissions;
      end if;
    end if;
  elsif v_is_lead or v_is_operator_assignee then
    -- Valid state machine transitions
    if v_task.status = 'pending' and p_next_status in ('in_progress', 'blocked') then
      null;
    elsif v_task.status = 'in_progress' and p_next_status in ('pending', 'in_review', 'blocked') then
      null;
    elsif v_task.status = 'in_review' and p_next_status in ('in_progress', 'completed') then
      null;
    elsif v_task.status = 'blocked' and p_next_status in ('pending', 'in_progress') then
      null;
    elsif v_task.status = 'completed' and p_next_status = 'in_progress' then
      if not v_is_lead then
        raise exception 'Only PM Lead/Admin can reopen completed task';
      end if;
      if p_reopen_reason is null or char_length(btrim(p_reopen_reason)) = 0 then
        raise exception 'Reopening a completed task requires a non-empty reason';
      end if;
    elsif v_task.status = p_next_status then
      return jsonb_build_object('task_id', p_task_id, 'status', v_task.status);
    else
      raise exception 'Illegal transition from % to % for task %', v_task.status, p_next_status, p_task_id;
    end if;
  else
    raise exception 'Not authorized to transition task %', p_task_id;
  end if;

  update public.tasks
  set status = p_next_status,
      started_at = case when p_next_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when p_next_status = 'completed' then now() else null end,
      updated_by = v_user_id,
      updated_at = now()
  where id = p_task_id;

  -- Audit log
  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    old_status,
    new_status,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    'task',
    p_task_id,
    v_task.project_id,
    'task_status_changed',
    v_task.status::text,
    p_next_status::text,
    case when p_reopen_reason is not null then jsonb_build_object('reopen_reason', p_reopen_reason) else '{}'::jsonb end,
    v_user_id,
    v_actor_role
  );

  -- Notification Event
  insert into public.notification_events (
    trigger,
    entity_type,
    entity_id,
    project_id,
    actor_id,
    payload,
    deduplication_key
  ) values (
    'task_status_changed',
    'task',
    p_task_id,
    v_task.project_id,
    v_user_id,
    jsonb_build_object('task_title', v_task.title, 'old_status', v_task.status, 'new_status', p_next_status),
    'task_status_changed:' || p_task_id || ':' || p_next_status || ':' || extract(epoch from now())::bigint
  ) on conflict do nothing;

  return jsonb_build_object(
    'task_id', p_task_id,
    'old_status', v_task.status,
    'new_status', p_next_status
  );
end;
$$;

-- 7.6 Submit Deliverable Version (Production)
create or replace function public.submit_deliverable_version(
  p_deliverable_id uuid,
  p_submission_url text,
  p_submission_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_deliv record;
  v_user_id uuid := auth.uid();
  v_new_version integer;
  v_version_id uuid;
  v_event_id uuid;
  v_pm record;
begin
  select * into v_deliv
  from public.deliverables
  where id = p_deliverable_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Deliverable % not found or deleted', p_deliverable_id;
  end if;

  if v_deliv.workflow_type <> 'production' then
    raise exception 'Deliverable % is not a production workflow; use submit_client_deliverable', p_deliverable_id;
  end if;

  if not (
    v_deliv.assignee_id = v_user_id
    or (select private.is_admin())
    or (select private.is_project_lead(v_deliv.project_id))
  ) then
    raise exception 'Not authorized to submit version for deliverable %', p_deliverable_id;
  end if;

  if v_deliv.status not in ('pending', 'changes_requested') then
    raise exception 'Cannot submit version while deliverable status is % (must be pending or changes_requested)', v_deliv.status;
  end if;

  -- Validate Google Drive URL
  if not (p_submission_url ~* '^https://(drive\.google\.com|docs\.google\.com)/') then
    raise exception 'Production deliverable submission URL must be a valid Google Drive link';
  end if;

  v_new_version := v_deliv.current_version_number + 1;

  -- Insert Version
  insert into public.deliverable_versions (
    deliverable_id,
    version_number,
    submission_url,
    submission_provider,
    submitted_by,
    submission_note
  ) values (
    p_deliverable_id,
    v_new_version,
    p_submission_url,
    'google_drive',
    v_user_id,
    p_submission_note
  ) returning id into v_version_id;

  -- Update Deliverable
  update public.deliverables
  set status = 'awaiting_internal_review',
      current_version_number = v_new_version,
      is_stalled = false,
      stalled_at = null,
      last_activity_at = now(),
      updated_by = v_user_id,
      updated_at = now()
  where id = p_deliverable_id;

  -- Audit Log
  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    old_status,
    new_status,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    'deliverable_version_submitted',
    v_deliv.status::text,
    'awaiting_internal_review',
    jsonb_build_object('version_number', v_new_version, 'version_id', v_version_id),
    v_user_id,
    (select private.current_user_role())
  );

  -- Notification Event
  insert into public.notification_events (
    trigger,
    entity_type,
    entity_id,
    project_id,
    actor_id,
    payload,
    deduplication_key
  ) values (
    'deliverable_submitted',
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    v_user_id,
    jsonb_build_object(
      'deliverable_title', v_deliv.title,
      'version_number', v_new_version,
      'version_id', v_version_id
    ),
    'deliverable_submitted:' || p_deliverable_id || ':v' || v_new_version
  )
  on conflict (deduplication_key) do nothing
  returning id into v_event_id;

  -- Fan-out notification recipients to PM Leads and Watchers
  if v_event_id is not null then
    for v_pm in
      select pm.user_id
      from public.project_members pm
      where pm.project_id = v_deliv.project_id
        and pm.member_type in ('pm_lead', 'pm_watcher')
        and pm.receives_notifications = true
        and pm.deleted_at is null
    loop
      insert into public.notification_recipients (
        event_id,
        user_id,
        channel,
        delivery_status
      ) values (
        v_event_id,
        v_pm.user_id,
        'in_app',
        'pending'
      ) on conflict do nothing;
    end loop;
  end if;

  return jsonb_build_object(
    'deliverable_id', p_deliverable_id,
    'version_id', v_version_id,
    'version_number', v_new_version,
    'status', 'awaiting_internal_review'
  );
end;
$$;

-- 7.7 Review Deliverable (Internal or Client Decision)
create or replace function public.review_deliverable(
  p_deliverable_id uuid,
  p_stage public.review_stage,
  p_decision public.review_decision,
  p_comments text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_deliv record;
  v_version record;
  v_user_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_next_status public.deliverable_status;
  v_feedback_id uuid;
  v_event_id uuid;
  v_trigger public.notification_trigger;
  v_recipient record;
begin
  select * into v_deliv
  from public.deliverables
  where id = p_deliverable_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Deliverable % not found or deleted', p_deliverable_id;
  end if;

  if v_deliv.workflow_type <> 'production' then
    raise exception 'Deliverable % is not a production workflow', p_deliverable_id;
  end if;

  v_actor_role := (select private.current_user_role());

  -- Current version record
  select * into v_version
  from public.deliverable_versions
  where deliverable_id = p_deliverable_id
    and version_number = v_deliv.current_version_number;

  if not found then
    raise exception 'No current version found for deliverable %', p_deliverable_id;
  end if;

  -- Stage & Role validation
  if p_stage = 'internal' then
    if v_deliv.status <> 'awaiting_internal_review' then
      raise exception 'Deliverable % is not in awaiting_internal_review (status: %)', p_deliverable_id, v_deliv.status;
    end if;
    if not ((select private.is_admin()) or (select private.is_project_lead(v_deliv.project_id))) then
      raise exception 'Only an active PM Lead or Admin can perform internal review';
    end if;

    if p_decision = 'approved' then
      v_next_status := 'awaiting_client_review';
      v_trigger := 'internal_review_approved';
    else
      if p_comments is null or char_length(btrim(p_comments)) = 0 then
        raise exception 'Comments are mandatory when requesting internal changes';
      end if;
      v_next_status := 'pending';
      v_trigger := 'internal_changes_requested';
    end if;

  elsif p_stage = 'client' then
    if v_deliv.status <> 'awaiting_client_review' then
      raise exception 'Deliverable % is not in awaiting_client_review (status: %)', p_deliverable_id, v_deliv.status;
    end if;
    if not (select private.is_project_client(v_deliv.project_id)) then
      raise exception 'Only an active Client member of project % can perform client review', v_deliv.project_id;
    end if;

    if p_decision = 'approved' then
      v_next_status := 'approved';
      v_trigger := 'client_review_approved';
    else
      if p_comments is null or char_length(btrim(p_comments)) = 0 then
        raise exception 'Comments are mandatory when requesting client changes';
      end if;
      v_next_status := 'changes_requested';
      v_trigger := 'client_changes_requested';
    end if;
  end if;

  -- Insert Feedback
  insert into public.deliverable_feedback (
    deliverable_id,
    version_id,
    stage,
    decision,
    comments,
    reviewed_by
  ) values (
    p_deliverable_id,
    v_version.id,
    p_stage,
    p_decision,
    p_comments,
    v_user_id
  ) returning id into v_feedback_id;

  -- Update Deliverable
  update public.deliverables
  set status = v_next_status,
      approved_at = case when v_next_status = 'approved' then now() else approved_at end,
      last_activity_at = now(),
      is_stalled = false,
      stalled_at = null,
      updated_by = v_user_id,
      updated_at = now()
  where id = p_deliverable_id;

  -- Audit Log
  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    old_status,
    new_status,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    'deliverable_reviewed',
    v_deliv.status::text,
    v_next_status::text,
    jsonb_build_object(
      'stage', p_stage,
      'decision', p_decision,
      'version_id', v_version.id,
      'feedback_id', v_feedback_id
    ),
    v_user_id,
    v_actor_role
  );

  -- Notification Event
  insert into public.notification_events (
    trigger,
    entity_type,
    entity_id,
    project_id,
    actor_id,
    payload,
    deduplication_key
  ) values (
    v_trigger,
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    v_user_id,
    jsonb_build_object(
      'deliverable_title', v_deliv.title,
      'stage', p_stage,
      'decision', p_decision,
      'comments', p_comments
    ),
    'deliverable_reviewed:' || p_deliverable_id || ':' || v_version.id || ':' || p_stage || ':' || extract(epoch from now())::bigint
  )
  on conflict (deduplication_key) do nothing
  returning id into v_event_id;

  if v_event_id is not null then
    -- Fan out notification to Assignee and PMs
    for v_recipient in
      select pm.user_id
      from public.project_members pm
      where pm.project_id = v_deliv.project_id
        and (
          pm.user_id = v_deliv.assignee_id
          or pm.member_type in ('pm_lead', 'pm_watcher')
        )
        and pm.receives_notifications = true
        and pm.deleted_at is null
    loop
      insert into public.notification_recipients (
        event_id,
        user_id,
        channel,
        delivery_status
      ) values (
        v_event_id,
        v_recipient.user_id,
        'in_app',
        'pending'
      ) on conflict do nothing;
    end loop;
  end if;

  return jsonb_build_object(
    'deliverable_id', p_deliverable_id,
    'stage', p_stage,
    'decision', p_decision,
    'next_status', v_next_status,
    'feedback_id', v_feedback_id
  );
end;
$$;

-- 7.8 Mark Deliverable Delivered
create or replace function public.mark_deliverable_delivered(p_deliverable_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_deliv record;
  v_user_id uuid := auth.uid();
  v_event_id uuid;
  v_recipient record;
begin
  select * into v_deliv
  from public.deliverables
  where id = p_deliverable_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Deliverable % not found or deleted', p_deliverable_id;
  end if;

  if not ((select private.is_admin()) or (select private.is_project_lead(v_deliv.project_id))) then
    raise exception 'Only active PM Lead or Admin can mark deliverable delivered';
  end if;

  if v_deliv.status <> 'approved' then
    raise exception 'Deliverable must be approved before marking delivered (current status: %)', v_deliv.status;
  end if;

  update public.deliverables
  set status = 'delivered',
      delivered_at = now(),
      last_activity_at = now(),
      updated_by = v_user_id,
      updated_at = now()
  where id = p_deliverable_id;

  -- Audit Log
  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    old_status,
    new_status,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    'deliverable_delivered',
    'approved',
    'delivered',
    '{}'::jsonb,
    v_user_id,
    (select private.current_user_role())
  );

  -- Notification Event
  insert into public.notification_events (
    trigger,
    entity_type,
    entity_id,
    project_id,
    actor_id,
    payload,
    deduplication_key
  ) values (
    'deliverable_delivered',
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    v_user_id,
    jsonb_build_object('deliverable_title', v_deliv.title),
    'deliverable_delivered:' || p_deliverable_id || ':' || extract(epoch from now())::bigint
  )
  on conflict (deduplication_key) do nothing
  returning id into v_event_id;

  if v_event_id is not null then
    for v_recipient in
      select pm.user_id
      from public.project_members pm
      where pm.project_id = v_deliv.project_id
        and pm.receives_notifications = true
        and pm.deleted_at is null
    loop
      insert into public.notification_recipients (
        event_id,
        user_id,
        channel,
        delivery_status
      ) values (
        v_event_id,
        v_recipient.user_id,
        'in_app',
        'pending'
      ) on conflict do nothing;
    end loop;
  end if;

  return jsonb_build_object(
    'deliverable_id', p_deliverable_id,
    'status', 'delivered',
    'delivered_at', now()
  );
end;
$$;

-- 7.9 Submit Client Deliverable (Client Submission Workflow)
create or replace function public.submit_client_deliverable(
  p_deliverable_id uuid,
  p_submission_url text,
  p_submission_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_deliv record;
  v_user_id uuid := auth.uid();
  v_provider public.submission_provider;
  v_new_version integer;
  v_version_id uuid;
  v_event_id uuid;
  v_pm record;
begin
  select * into v_deliv
  from public.deliverables
  where id = p_deliverable_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Deliverable % not found or deleted', p_deliverable_id;
  end if;

  if v_deliv.workflow_type <> 'client_submission' then
    raise exception 'Deliverable % is not a client_submission workflow', p_deliverable_id;
  end if;

  if v_deliv.assignee_id <> v_user_id then
    raise exception 'Only the direct Client assignee can submit this deliverable';
  end if;

  if v_deliv.status <> 'pending' then
    raise exception 'Deliverable % is not pending (status: %)', p_deliverable_id, v_deliv.status;
  end if;

  -- Validate public HTTPS URL lexically
  if not (p_submission_url ~* '^https://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$') then
    raise exception 'Submission URL must be a valid public HTTPS URL';
  end if;

  -- Derive provider
  if p_submission_url ~* '^https://(drive\.google\.com|docs\.google\.com)/' then
    v_provider := 'google_drive';
  elsif p_submission_url ~* '^https://([a-zA-Z0-9.-]+\.)?dropbox\.com/' then
    v_provider := 'dropbox';
  elsif p_submission_url ~* '^https://([a-zA-Z0-9.-]+\.)?onedrive\.live\.com/' or p_submission_url ~* '^https://([a-zA-Z0-9.-]+\.)?1drv\.ms/' then
    v_provider := 'onedrive';
  elsif p_submission_url ~* '^https://([a-zA-Z0-9.-]+\.)?wetransfer\.com/' or p_submission_url ~* '^https://we\.tl/' then
    v_provider := 'wetransfer';
  elsif p_submission_url ~* '^https://([a-zA-Z0-9.-]+\.)?frame\.io/' or p_submission_url ~* '^https://f\.io/' then
    v_provider := 'frame_io';
  else
    v_provider := 'other_https';
  end if;

  v_new_version := v_deliv.current_version_number + 1;

  insert into public.deliverable_versions (
    deliverable_id,
    version_number,
    submission_url,
    submission_provider,
    submitted_by,
    submission_note
  ) values (
    p_deliverable_id,
    v_new_version,
    p_submission_url,
    v_provider,
    v_user_id,
    p_submission_note
  ) returning id into v_version_id;

  update public.deliverables
  set status = 'submitted',
      current_version_number = v_new_version,
      last_activity_at = now(),
      updated_by = v_user_id,
      updated_at = now()
  where id = p_deliverable_id;

  -- Audit Log
  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    old_status,
    new_status,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    'client_deliverable_submitted',
    'pending',
    'submitted',
    jsonb_build_object(
      'version_number', v_new_version,
      'version_id', v_version_id,
      'provider', v_provider
    ),
    v_user_id,
    'client'
  );

  -- Notification Event
  insert into public.notification_events (
    trigger,
    entity_type,
    entity_id,
    project_id,
    actor_id,
    payload,
    deduplication_key
  ) values (
    'client_submission_received',
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    v_user_id,
    jsonb_build_object(
      'deliverable_title', v_deliv.title,
      'version_number', v_new_version,
      'version_id', v_version_id
    ),
    'client_submission_received:' || p_deliverable_id || ':v' || v_new_version
  )
  on conflict (deduplication_key) do nothing
  returning id into v_event_id;

  if v_event_id is not null then
    for v_pm in
      select pm.user_id
      from public.project_members pm
      where pm.project_id = v_deliv.project_id
        and pm.member_type in ('pm_lead', 'pm_watcher')
        and pm.receives_notifications = true
        and pm.deleted_at is null
    loop
      insert into public.notification_recipients (
        event_id,
        user_id,
        channel,
        delivery_status
      ) values (
        v_event_id,
        v_pm.user_id,
        'in_app',
        'pending'
      ) on conflict do nothing;
    end loop;
  end if;

  return jsonb_build_object(
    'deliverable_id', p_deliverable_id,
    'version_id', v_version_id,
    'version_number', v_new_version,
    'provider', v_provider,
    'status', 'submitted'
  );
end;
$$;

-- 7.10 Reopen Client Deliverable
create or replace function public.reopen_client_deliverable(
  p_deliverable_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_deliv record;
  v_user_id uuid := auth.uid();
  v_event_id uuid;
begin
  if not ((select private.is_admin()) or (select private.is_project_lead(p_deliverable_id))) then
    null; -- validated below after select
  end if;

  select * into v_deliv
  from public.deliverables
  where id = p_deliverable_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Deliverable % not found or deleted', p_deliverable_id;
  end if;

  if not ((select private.is_admin()) or (select private.is_project_lead(v_deliv.project_id))) then
    raise exception 'Only an active PM Lead or Admin can reopen a client submission';
  end if;

  if v_deliv.workflow_type <> 'client_submission' then
    raise exception 'Deliverable % is not a client_submission workflow', p_deliverable_id;
  end if;

  if v_deliv.status <> 'submitted' then
    raise exception 'Deliverable % is not currently submitted (status: %)', p_deliverable_id, v_deliv.status;
  end if;

  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'A non-empty reason is required to reopen a client submission';
  end if;

  update public.deliverables
  set status = 'pending',
      last_activity_at = now(),
      updated_by = v_user_id,
      updated_at = now()
  where id = p_deliverable_id;

  -- Audit Log
  insert into public.audit_logs (
    entity_type,
    entity_id,
    project_id,
    action,
    old_status,
    new_status,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    'client_submission_reopened',
    'submitted',
    'pending',
    jsonb_build_object('reason', p_reason),
    v_user_id,
    (select private.current_user_role())
  );

  -- Notification to direct Client assignee
  insert into public.notification_events (
    trigger,
    entity_type,
    entity_id,
    project_id,
    actor_id,
    payload,
    deduplication_key
  ) values (
    'client_submission_reopened',
    'deliverable',
    p_deliverable_id,
    v_deliv.project_id,
    v_user_id,
    jsonb_build_object('deliverable_title', v_deliv.title, 'reason', p_reason),
    'client_submission_reopened:' || p_deliverable_id || ':' || extract(epoch from now())::bigint
  )
  on conflict (deduplication_key) do nothing
  returning id into v_event_id;

  if v_event_id is not null then
    insert into public.notification_recipients (
      event_id,
      user_id,
      channel,
      delivery_status
    ) values (
      v_event_id,
      v_deliv.assignee_id,
      'in_app',
      'pending'
    ) on conflict do nothing;
  end if;

  return jsonb_build_object(
    'deliverable_id', p_deliverable_id,
    'status', 'pending',
    'reason', p_reason
  );
end;
$$;

-- 7.11 Create Collaboration Comment
create or replace function public.create_collaboration_comment(
  p_project_id uuid,
  p_target_type public.collaboration_target_type,
  p_target_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role;
  v_capacity public.collaboration_author_capacity;
  v_comment_id uuid;
  v_target_project_id uuid;
begin
  if p_body is null or char_length(btrim(p_body)) = 0 then
    raise exception 'Comment body cannot be empty';
  end if;

  v_role := (select private.current_user_role());

  if v_role = 'client' then
    raise exception 'Client users cannot post internal collaboration comments';
  end if;

  -- Validate target belongs to p_project_id
  if p_target_type = 'project' then
    if p_target_id <> p_project_id then
      raise exception 'Target project ID mismatch';
    end if;
  elsif p_target_type = 'task' then
    select project_id into v_target_project_id
    from public.tasks
    where id = p_target_id and deleted_at is null;
    if v_target_project_id is null or v_target_project_id <> p_project_id then
      raise exception 'Task target % does not belong to project %', p_target_id, p_project_id;
    end if;
  elsif p_target_type = 'deliverable' then
    select project_id into v_target_project_id
    from public.deliverables
    where id = p_target_id and deleted_at is null;
    if v_target_project_id is null or v_target_project_id <> p_project_id then
      raise exception 'Deliverable target % does not belong to project %', p_target_id, p_project_id;
    end if;
  end if;

  -- Derive author capacity
  if (select private.is_admin()) then
    v_capacity := 'admin';
  elsif (select private.is_project_lead(p_project_id)) then
    v_capacity := 'pm_lead';
  elsif (select private.is_project_watcher(p_project_id)) then
    v_capacity := 'pm_watcher';
  elsif p_target_type = 'task' and (select private.is_task_assignee(p_target_id)) then
    v_capacity := 'operator';
  elsif p_target_type = 'deliverable' and (select private.is_deliverable_assignee(p_target_id)) then
    v_capacity := 'operator';
  else
    raise exception 'Not authorized to comment on % % in project %', p_target_type, p_target_id, p_project_id;
  end if;

  insert into public.collaboration_comments (
    project_id,
    target_type,
    target_id,
    author_id,
    author_capacity_snapshot,
    body
  ) values (
    p_project_id,
    p_target_type,
    p_target_id,
    v_user_id,
    v_capacity,
    p_body
  ) returning id into v_comment_id;

  return jsonb_build_object(
    'id', v_comment_id,
    'project_id', p_project_id,
    'target_type', p_target_type,
    'target_id', p_target_id,
    'author_id', v_user_id,
    'author_capacity_snapshot', v_capacity
  );
end;
$$;

-- 7.12 Report Broken Link
create or replace function public.report_broken_link(
  p_deliverable_id uuid,
  p_version_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_deliv record;
  v_version record;
  v_user_id uuid := auth.uid();
  v_report_id uuid;
  v_event_id uuid;
begin
  select * into v_deliv
  from public.deliverables
  where id = p_deliverable_id and deleted_at is null;

  if not found then
    raise exception 'Deliverable % not found or deleted', p_deliverable_id;
  end if;

  if not (
    (select private.is_admin())
    or (select private.is_project_pm(v_deliv.project_id))
    or (select private.is_project_client(v_deliv.project_id))
  ) then
    raise exception 'Not authorized to report broken link for deliverable %', p_deliverable_id;
  end if;

  select * into v_version
  from public.deliverable_versions
  where id = p_version_id and deliverable_id = p_deliverable_id;

  if not found then
    raise exception 'Version % does not belong to deliverable %', p_version_id, p_deliverable_id;
  end if;

  insert into public.deliverable_link_reports (
    deliverable_id,
    version_id,
    reported_by,
    reason,
    status
  ) values (
    p_deliverable_id,
    p_version_id,
    v_user_id,
    p_reason,
    'open'
  ) returning id into v_report_id;

  -- Emit notification to version submitter
  insert into public.notification_events (
    trigger,
    entity_type,
    entity_id,
    project_id,
    actor_id,
    payload,
    deduplication_key
  ) values (
    'link_reported_broken',
    'link_report',
    v_report_id,
    v_deliv.project_id,
    v_user_id,
    jsonb_build_object(
      'deliverable_title', v_deliv.title,
      'version_number', v_version.version_number,
      'reason', p_reason
    ),
    'link_reported_broken:' || p_deliverable_id || ':' || p_version_id || ':' || extract(epoch from now())::bigint
  )
  on conflict (deduplication_key) do nothing
  returning id into v_event_id;

  if v_event_id is not null then
    insert into public.notification_recipients (
      event_id,
      user_id,
      channel,
      delivery_status
    ) values (
      v_event_id,
      v_version.submitted_by,
      'in_app',
      'pending'
    ) on conflict do nothing;
  end if;

  return jsonb_build_object(
    'report_id', v_report_id,
    'status', 'open',
    'deliverable_id', p_deliverable_id,
    'version_id', p_version_id
  );
end;
$$;

-- 7.13 Mark Single Notification Read
create or replace function public.mark_notification_read(p_notification_recipient_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
begin
  update public.notification_recipients
  set read_at = now(),
      delivery_status = 'read',
      updated_at = now()
  where id = p_notification_recipient_id
    and user_id = (select auth.uid())
    and read_at is null;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

-- 7.14 Mark All In-App Notifications Read
create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
begin
  update public.notification_recipients
  set read_at = now(),
      delivery_status = 'read',
      updated_at = now()
  where user_id = (select auth.uid())
    and channel = 'in_app'
    and read_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 7.15 Claim Outbound Notification Batch
create or replace function private.claim_notification_batch(
  p_batch_size integer default 50,
  p_lease_seconds integer default 300
)
returns setof public.notification_recipients
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_claim_token uuid := gen_random_uuid();
begin
  return query
  with candidates as (
    select id
    from public.notification_recipients
    where channel in ('whatsapp', 'email')
      and (
        delivery_status = 'pending'
        or (delivery_status = 'processing' and claimed_at < now() - (p_lease_seconds || ' seconds')::interval)
      )
      and coalesce(next_attempt_at, now()) <= now()
      and attempt_count < 10
    order by created_at asc
    for update skip locked
    limit p_batch_size
  )
  update public.notification_recipients nr
  set delivery_status = 'processing',
      claimed_at = now(),
      claim_token = v_claim_token,
      attempt_count = attempt_count + 1,
      updated_at = now()
  from candidates c
  where nr.id = c.id
  returning nr.*;
end;
$$;

-- 7.16 Record Provider Receipt (Monotonic Delivery Advancement)
create or replace function private.record_provider_receipt(
  p_provider_message_id text,
  p_status public.notification_delivery_status,
  p_error_code text default null,
  p_error_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_rec record;
begin
  select * into v_rec
  from public.notification_recipients
  where provider_message_id = p_provider_message_id
  for update;

  if not found then
    return false;
  end if;

  -- Monotonic progression: do not overwrite 'read' with 'delivered'
  if v_rec.delivery_status = 'read' and p_status in ('sent', 'delivered') then
    return true;
  end if;

  update public.notification_recipients
  set delivery_status = p_status,
      delivered_at = case when p_status = 'delivered' and delivered_at is null then now() else delivered_at end,
      read_at = case when p_status = 'read' and read_at is null then now() else read_at end,
      failed_at = case when p_status = 'failed' and failed_at is null then now() else failed_at end,
      provider_error_code = coalesce(p_error_code, provider_error_code),
      provider_error_message = coalesce(p_error_message, provider_error_message),
      updated_at = now()
  where id = v_rec.id;

  return true;
end;
$$;

-- 7.17 Soft Delete Entity (Admin Only)
create or replace function public.soft_delete_entity(
  p_entity_type public.entity_type,
  p_entity_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if not (select private.is_admin()) then
    raise exception 'Only Admin can soft delete entities';
  end if;

  if p_entity_type in ('audit_log', 'notification', 'deliverable_version', 'feedback', 'invite_token', 'link_report') then
    raise exception 'Entity type % is immutable/constrained and cannot be soft deleted', p_entity_type;
  end if;

  execute format('update public.%I set deleted_at = now(), updated_at = now() where id = $1 and deleted_at is null',
    case p_entity_type
      when 'profile' then 'profiles'
      when 'client' then 'clients'
      when 'project' then 'projects'
      when 'project_member' then 'project_members'
      when 'task' then 'tasks'
      when 'deliverable' then 'deliverables'
      when 'calendar_event' then 'calendar_events'
      when 'collaboration_comment' then 'collaboration_comments'
    end
  ) using p_entity_id;

  insert into public.audit_logs (
    entity_type,
    entity_id,
    action,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    p_entity_type,
    p_entity_id,
    'entity_soft_deleted',
    jsonb_build_object('reason', p_reason),
    v_user_id,
    'admin'
  );

  return true;
end;
$$;

-- 7.18 Restore Entity (Admin Only)
create or replace function public.restore_entity(
  p_entity_type public.entity_type,
  p_entity_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if not (select private.is_admin()) then
    raise exception 'Only Admin can restore soft deleted entities';
  end if;

  execute format('update public.%I set deleted_at = null, updated_at = now() where id = $1 and deleted_at is not null',
    case p_entity_type
      when 'profile' then 'profiles'
      when 'client' then 'clients'
      when 'project' then 'projects'
      when 'project_member' then 'project_members'
      when 'task' then 'tasks'
      when 'deliverable' then 'deliverables'
      when 'calendar_event' then 'calendar_events'
      when 'collaboration_comment' then 'collaboration_comments'
    end
  ) using p_entity_id;

  insert into public.audit_logs (
    entity_type,
    entity_id,
    action,
    changed_fields,
    actor_id,
    actor_role
  ) values (
    p_entity_type,
    p_entity_id,
    'entity_restored',
    jsonb_build_object('reason', p_reason),
    v_user_id,
    'admin'
  );

  return true;
end;
$$;

revoke all on function public.accept_invite(bytea) from public;
revoke all on function public.get_project_completion_readiness(uuid) from public;
revoke all on function public.transition_project_status(uuid, public.project_status, boolean, text) from public;
revoke all on function public.recover_project_status(uuid, public.project_status, text) from public;
revoke all on function public.transition_task_status(uuid, public.task_status, text) from public;
revoke all on function public.submit_deliverable_version(uuid, text, text) from public;
revoke all on function public.review_deliverable(uuid, public.review_stage, public.review_decision, text) from public;
revoke all on function public.mark_deliverable_delivered(uuid) from public;
revoke all on function public.submit_client_deliverable(uuid, text, text) from public;
revoke all on function public.reopen_client_deliverable(uuid, text) from public;
revoke all on function public.create_collaboration_comment(uuid, public.collaboration_target_type, uuid, text) from public;
revoke all on function public.report_broken_link(uuid, uuid, text) from public;
revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_all_notifications_read() from public;
revoke all on function public.soft_delete_entity(public.entity_type, uuid, text) from public;
revoke all on function public.restore_entity(public.entity_type, uuid, text) from public;

grant execute on function public.accept_invite(bytea) to authenticated;
grant execute on function public.get_project_completion_readiness(uuid) to authenticated;
grant execute on function public.transition_project_status(uuid, public.project_status, boolean, text) to authenticated;
grant execute on function public.recover_project_status(uuid, public.project_status, text) to authenticated;
grant execute on function public.transition_task_status(uuid, public.task_status, text) to authenticated;
grant execute on function public.submit_deliverable_version(uuid, text, text) to authenticated;
grant execute on function public.review_deliverable(uuid, public.review_stage, public.review_decision, text) to authenticated;
grant execute on function public.mark_deliverable_delivered(uuid) to authenticated;
grant execute on function public.submit_client_deliverable(uuid, text, text) to authenticated;
grant execute on function public.reopen_client_deliverable(uuid, text) to authenticated;
grant execute on function public.create_collaboration_comment(uuid, public.collaboration_target_type, uuid, text) to authenticated;
grant execute on function public.report_broken_link(uuid, uuid, text) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.soft_delete_entity(public.entity_type, uuid, text) to authenticated;
grant execute on function public.restore_entity(public.entity_type, uuid, text) to authenticated;

-- ============================================================================
-- 8. INDEXES & QUERY PERFORMANCE
-- ============================================================================

create unique index profiles_phone_active_uidx
  on public.profiles (phone_e164)
  where phone_e164 is not null and deleted_at is null;

create unique index clients_slug_active_uidx
  on public.clients (slug)
  where deleted_at is null;

create unique index client_primary_contact_uidx
  on public.client_contacts (client_id)
  where is_primary = true and deleted_at is null;

create index client_contacts_client_id_idx
  on public.client_contacts (client_id);

create index client_contacts_profile_id_idx
  on public.client_contacts (profile_id);

create unique index project_members_active_capacity_uidx
  on public.project_members (project_id, user_id, member_type)
  where deleted_at is null;

create unique index project_members_one_primary_lead_uidx
  on public.project_members (project_id)
  where member_type = 'pm_lead' and is_primary = true and deleted_at is null;

create index project_members_user_project_idx
  on public.project_members (user_id, project_id)
  where deleted_at is null;

create index project_members_project_id_idx
  on public.project_members (project_id);

create index projects_status_deadline_idx
  on public.projects (status, deadline_at)
  where deleted_at is null and archived_at is null;

create index projects_client_idx
  on public.projects (client_id, created_at desc)
  where deleted_at is null;

create index tasks_assignee_agenda_idx
  on public.tasks (assignee_id, status, deadline_at)
  where deleted_at is null and status <> 'completed';

create index tasks_project_status_idx
  on public.tasks (project_id, status, deadline_at)
  where deleted_at is null;

create index tasks_client_assignee_idx
  on public.tasks (assignee_id, priority, deadline_at)
  where task_type = 'client_request' and deleted_at is null and status <> 'completed';

create index task_resources_task_id_idx
  on public.task_resources (task_id);

create index deliverables_assignee_active_idx
  on public.deliverables (assignee_id, status, internal_review_deadline_at)
  where workflow_type = 'production' and deleted_at is null and status <> 'delivered';

create index deliverables_project_status_idx
  on public.deliverables (project_id, status, client_delivery_deadline_at)
  where deleted_at is null;

create index deliverables_client_submission_idx
  on public.deliverables (assignee_id, status, submission_deadline_at)
  where workflow_type = 'client_submission' and deleted_at is null and status <> 'submitted';

create index deliverables_scheduler_idx
  on public.deliverables (status, last_activity_at, internal_review_deadline_at, client_delivery_deadline_at)
  where deleted_at is null and status in ('pending', 'awaiting_internal_review', 'awaiting_client_review', 'changes_requested');

create index deliverables_task_id_idx
  on public.deliverables (task_id);

create unique index deliverable_versions_number_uidx
  on public.deliverable_versions (deliverable_id, version_number);

create index deliverable_versions_deliverable_id_idx
  on public.deliverable_versions (deliverable_id);

create index feedback_deliverable_history_idx
  on public.deliverable_feedback (deliverable_id, reviewed_at desc);

create unique index feedback_one_decision_per_stage_uidx
  on public.deliverable_feedback (version_id, stage);

create index deliverable_feedback_version_id_idx
  on public.deliverable_feedback (version_id);

create index collaboration_comments_target_idx
  on public.collaboration_comments (project_id, target_type, target_id, created_at)
  where deleted_at is null;

create index collaboration_comments_author_idx
  on public.collaboration_comments (author_id, created_at desc)
  where deleted_at is null;

create index calendar_events_project_id_idx
  on public.calendar_events (project_id);

create unique index deliverable_link_reports_open_version_uidx
  on public.deliverable_link_reports (deliverable_id, version_id)
  where status = 'open';

create index deliverable_link_reports_deliverable_id_idx
  on public.deliverable_link_reports (deliverable_id);

create unique index notification_events_dedup_uidx
  on public.notification_events (deduplication_key);

create index notification_events_project_id_idx
  on public.notification_events (project_id);

create unique index notification_recipients_fanout_uidx
  on public.notification_recipients (event_id, user_id, channel);

create index notification_recipients_unread_idx
  on public.notification_recipients (user_id, created_at desc)
  where channel = 'in_app' and read_at is null;

create index notification_recipients_pending_idx
  on public.notification_recipients (next_attempt_at, created_at)
  where delivery_status = 'pending' and channel in ('whatsapp', 'email');

create unique index notification_recipients_provider_uidx
  on public.notification_recipients (provider_message_id)
  where provider_message_id is not null;

create index notification_recipients_user_id_idx
  on public.notification_recipients (user_id);

create unique index invite_tokens_hash_uidx
  on public.invite_tokens (token_hash);

create index invite_tokens_pending_expiry_idx
  on public.invite_tokens (expires_at)
  where status = 'pending';

create index invite_tokens_project_id_idx
  on public.invite_tokens (project_id);

create index invite_tokens_client_id_idx
  on public.invite_tokens (client_id);

create index audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, created_at);

create index audit_logs_project_idx
  on public.audit_logs (project_id, created_at desc)
  where project_id is not null;

create unique index whatsapp_templates_logical_version_uidx
  on public.whatsapp_templates (logical_name, version)
  where deleted_at is null;

-- ============================================================================
-- 9. SECURITY-INVOKER VIEWS
-- ============================================================================

-- 9.1 Operator Agenda View
create or replace view public.operator_agenda_view
with (security_invoker = true)
as
select
  t.id as task_id,
  t.project_id,
  p.name as project_name,
  t.title as task_title,
  t.description as task_description,
  t.status as task_status,
  t.priority as task_priority,
  t.deadline_at as task_deadline_at,
  t.started_at as task_started_at,
  d.id as deliverable_id,
  d.title as deliverable_title,
  d.status as deliverable_status,
  d.workflow_type as deliverable_workflow_type,
  d.current_version_number,
  d.internal_review_deadline_at,
  d.client_delivery_deadline_at,
  case
    when t.deadline_at < now() then 'overdue'
    when t.deadline_at <= now() + interval '24 hours' then 'urgent'
    when t.deadline_at <= now() + interval '72 hours' then 'upcoming'
    else 'normal'
  end as urgency_category
from public.tasks t
join public.projects p on p.id = t.project_id
left join public.deliverables d on d.task_id = t.id and d.deleted_at is null
where t.assignee_id = (select auth.uid())
  and t.deleted_at is null
  and p.deleted_at is null
  and t.status <> 'completed';

-- 9.2 Client Project View
create or replace view public.client_project_view
with (security_invoker = true)
as
select
  p.id,
  p.client_id,
  c.display_name as client_name,
  p.name,
  p.client_scope,
  p.status,
  p.deadline_at,
  p.drive_folder_url,
  p.completed_at,
  p.archived_at,
  (
    select max(d.last_activity_at)
    from public.deliverables d
    where d.project_id = p.id
      and d.deleted_at is null
  ) as last_deliverable_activity_at,
  p.created_at
from public.projects p
join public.clients c on c.id = p.client_id
where p.project_type = 'client'
  and p.deleted_at is null
  and c.deleted_at is null;

-- 9.3 Client Task View
create or replace view public.client_task_view
with (security_invoker = true)
as
select
  t.id,
  t.project_id,
  p.name as project_name,
  t.assignee_id,
  t.title,
  t.description,
  t.status,
  t.priority,
  t.deadline_at,
  t.started_at,
  t.completed_at,
  t.created_at,
  (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', tr.id,
        'name', tr.name,
        'url', tr.url,
        'sort_order', tr.sort_order
      ) order by tr.sort_order asc
    ), '[]'::jsonb)
    from public.task_resources tr
    where tr.task_id = t.id
      and tr.deleted_at is null
  ) as resources,
  (
    select count(*)
    from public.deliverables d
    where d.task_id = t.id
      and d.workflow_type = 'client_submission'
      and d.deleted_at is null
  ) as child_submission_count
from public.tasks t
join public.projects p on p.id = t.project_id
where t.task_type = 'client_request'
  and t.deleted_at is null
  and p.deleted_at is null;

-- 9.4 Client Submission View
create or replace view public.client_submission_view
with (security_invoker = true)
as
select
  d.id,
  d.project_id,
  p.name as project_name,
  d.task_id,
  t.title as task_title,
  d.assignee_id,
  d.title,
  d.specifications,
  d.status,
  d.current_version_number,
  d.submission_deadline_at,
  d.last_activity_at,
  v.submission_url as current_submission_url,
  v.submission_provider as current_submission_provider,
  v.submission_note as current_submission_note,
  v.submitted_at as current_submitted_at,
  d.created_at
from public.deliverables d
join public.projects p on p.id = d.project_id
join public.tasks t on t.id = d.task_id
left join public.deliverable_versions v
  on v.deliverable_id = d.id
  and v.version_number = d.current_version_number
where d.workflow_type = 'client_submission'
  and d.deleted_at is null
  and p.deleted_at is null
  and t.deleted_at is null;

-- 9.5 Client Deliverable View
create or replace view public.client_deliverable_view
with (security_invoker = true)
as
select
  d.id,
  d.project_id,
  p.name as project_name,
  d.task_id,
  d.title,
  d.specifications,
  d.status,
  d.current_version_number,
  d.client_delivery_deadline_at,
  d.approved_at,
  d.delivered_at,
  v.submission_url as current_submission_url,
  v.submission_provider as current_submission_provider,
  v.submission_note as current_submission_note,
  v.submitted_at as current_submitted_at,
  (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', df.id,
        'version_id', df.version_id,
        'decision', df.decision,
        'comments', df.comments,
        'reviewed_at', df.reviewed_at
      ) order by df.reviewed_at desc
    ), '[]'::jsonb)
    from public.deliverable_feedback df
    where df.deliverable_id = d.id
      and df.stage = 'client'
  ) as client_feedback_history,
  d.created_at
from public.deliverables d
join public.projects p on p.id = d.project_id
left join public.deliverable_versions v
  on v.deliverable_id = d.id
  and v.version_number = d.current_version_number
where d.workflow_type = 'production'
  and d.status in ('awaiting_client_review', 'approved', 'delivered', 'changes_requested')
  and d.deleted_at is null
  and p.deleted_at is null;

-- 9.6 Calendar Feed View
create or replace view public.calendar_feed_view
with (security_invoker = true)
as
-- 1. Project deadlines
select
  p.id as entity_id,
  p.id as project_id,
  p.name as title,
  'project_deadline'::public.calendar_event_type as event_type,
  p.deadline_at as starts_at,
  p.deadline_at as ends_at,
  true as is_all_day,
  null::text as color_override
from public.projects p
where p.deleted_at is null

union all

-- 2. Task deadlines
select
  t.id as entity_id,
  t.project_id,
  t.title,
  'task_deadline'::public.calendar_event_type as event_type,
  t.deadline_at as starts_at,
  t.deadline_at as ends_at,
  true as is_all_day,
  null::text as color_override
from public.tasks t
where t.deleted_at is null

union all

-- 3. Deliverable internal review deadlines
select
  d.id as entity_id,
  d.project_id,
  d.title || ' (Internal Review)' as title,
  'internal_review_deadline'::public.calendar_event_type as event_type,
  d.internal_review_deadline_at as starts_at,
  d.internal_review_deadline_at as ends_at,
  true as is_all_day,
  null::text as color_override
from public.deliverables d
where d.workflow_type = 'production'
  and d.internal_review_deadline_at is not null
  and d.deleted_at is null

union all

-- 4. Deliverable client delivery deadlines
select
  d.id as entity_id,
  d.project_id,
  d.title || ' (Client Delivery)' as title,
  'client_delivery_deadline'::public.calendar_event_type as event_type,
  d.client_delivery_deadline_at as starts_at,
  d.client_delivery_deadline_at as ends_at,
  true as is_all_day,
  null::text as color_override
from public.deliverables d
where d.workflow_type = 'production'
  and d.client_delivery_deadline_at is not null
  and d.deleted_at is null

union all

-- 5. Deliverable submission deadlines (client_submission)
select
  d.id as entity_id,
  d.project_id,
  d.title || ' (Client Submission)' as title,
  'task_deadline'::public.calendar_event_type as event_type,
  d.submission_deadline_at as starts_at,
  d.submission_deadline_at as ends_at,
  true as is_all_day,
  null::text as color_override
from public.deliverables d
where d.workflow_type = 'client_submission'
  and d.submission_deadline_at is not null
  and d.deleted_at is null

union all

-- 6. Manual Milestones
select
  ce.id as entity_id,
  ce.project_id,
  ce.title,
  ce.event_type,
  ce.starts_at,
  ce.ends_at,
  ce.is_all_day,
  ce.color_override
from public.calendar_events ce
where ce.deleted_at is null;

-- 9.7 Deliverable Cycle Metrics View
create or replace view public.deliverable_cycle_metrics_view
with (security_invoker = true)
as
select
  d.id as deliverable_id,
  d.project_id,
  d.title,
  d.workflow_type,
  d.status,
  d.current_version_number,
  min(a_sub.created_at) as first_submitted_at,
  min(a_client_start.created_at) as client_review_started_at,
  min(a_client_act.created_at) as client_acted_at,
  extract(epoch from (min(a_client_act.created_at) - min(a_client_start.created_at))) / 3600.0 as client_review_hours,
  d.delivered_at
from public.deliverables d
left join public.audit_logs a_sub
  on a_sub.entity_type = 'deliverable'
  and a_sub.entity_id = d.id
  and a_sub.action in ('deliverable_version_submitted', 'client_deliverable_submitted')
left join public.audit_logs a_client_start
  on a_client_start.entity_type = 'deliverable'
  and a_client_start.entity_id = d.id
  and a_client_start.new_status = 'awaiting_client_review'
left join public.audit_logs a_client_act
  on a_client_act.entity_type = 'deliverable'
  and a_client_act.entity_id = d.id
  and a_client_act.new_status in ('approved', 'changes_requested')
where d.deleted_at is null
group by d.id, d.project_id, d.title, d.workflow_type, d.status, d.current_version_number, d.delivered_at;

-- 9.8 Notification Unread Counts View
create or replace view public.notification_unread_counts_view
with (security_invoker = true)
as
select
  nr.user_id,
  count(*) as unread_count
from public.notification_recipients nr
where nr.channel = 'in_app'
  and nr.read_at is null
group by nr.user_id;

-- 9.9 Project Completion Cycles View
create or replace view public.project_completion_cycles_view
with (security_invoker = true)
as
with completions as (
  select
    a.id as audit_id,
    a.project_id,
    a.created_at as completed_at,
    a.actor_id as completed_by,
    (a.changed_fields->>'unfinished_task_count')::int as unfinished_task_count,
    (a.changed_fields->>'unfinished_deliverable_count')::int as unfinished_deliverable_count,
    (a.changed_fields->>'override_confirmed')::boolean as override_confirmed,
    row_number() over (partition by a.project_id order by a.created_at asc) as cycle_number
  from public.audit_logs a
  where a.entity_type = 'project'
    and a.action = 'project_completed'
),
reopenings as (
  select
    a.id as audit_id,
    a.project_id,
    a.created_at as reopened_at,
    a.actor_id as reopened_by,
    a.changed_fields->>'reopen_reason' as reopen_reason,
    row_number() over (partition by a.project_id order by a.created_at asc) as cycle_number
  from public.audit_logs a
  where a.entity_type = 'project'
    and a.action = 'project_reopened'
)
select
  p.id as project_id,
  p.name as project_name,
  c.cycle_number,
  c.completed_at,
  c.completed_by,
  c.unfinished_task_count,
  c.unfinished_deliverable_count,
  c.override_confirmed,
  r.reopened_at,
  r.reopened_by,
  r.reopen_reason,
  case
    when r.reopened_at is not null then extract(epoch from (r.reopened_at - c.completed_at)) / 86400.0
    else extract(epoch from (now() - c.completed_at)) / 86400.0
  end as cycle_duration_days,
  p.completed_at as current_completed_at,
  p.status as current_project_status
from public.projects p
join completions c on c.project_id = p.id
left join reopenings r on r.project_id = p.id and r.cycle_number = c.cycle_number
where p.deleted_at is null;

-- ============================================================================
-- 10. REALTIME PUBLICATION
-- ============================================================================

alter publication supabase_realtime add table public.notification_recipients;

-- ============================================================================
-- 11. INITIAL STATIC CONFIGURATION SEEDS
-- ============================================================================

insert into public.whatsapp_templates (
  logical_name,
  meta_template_name,
  language_code,
  category,
  status,
  version,
  variable_schema,
  body_preview,
  is_active
) values
(
  'onboarding_invitation',
  'onboarding_invitation_v1',
  'es_MX',
  'AUTHENTICATION',
  'approved',
  1,
  '{"type":"object","required":["invitee_name","inviter_name","join_url"],"properties":{"invitee_name":{"type":"string"},"inviter_name":{"type":"string"},"join_url":{"type":"string"}}}'::jsonb,
  'Hola {{1}}, has sido invitado por {{2}} a colaborar en Joya Star Films. Únete aquí: {{3}}',
  true
),
(
  'new_deliverable_review',
  'new_deliverable_review_v1',
  'es_MX',
  'UTILITY',
  'approved',
  1,
  '{"type":"object","required":["recipient_name","deliverable_title","project_name","review_url"],"properties":{"recipient_name":{"type":"string"},"deliverable_title":{"type":"string"},"project_name":{"type":"string"},"review_url":{"type":"string"}}}'::jsonb,
  'Hola {{1}}, hay un nuevo entregable "{{2}}" para revisión en el proyecto "{{3}}". Revisa los detalles aquí: {{4}}',
  true
),
(
  'changes_requested_alert',
  'changes_requested_alert_v1',
  'es_MX',
  'UTILITY',
  'approved',
  1,
  '{"type":"object","required":["recipient_name","deliverable_title","project_name","feedback_summary","details_url"],"properties":{"recipient_name":{"type":"string"},"deliverable_title":{"type":"string"},"project_name":{"type":"string"},"feedback_summary":{"type":"string"},"details_url":{"type":"string"}}}'::jsonb,
  'Hola {{1}}, se han solicitado cambios en "{{2}}" (Proyecto: {{3}}). Comentarios: {{4}}. Ver detalles: {{5}}',
  true
),
(
  'final_delivery_confirmation',
  'final_delivery_confirmation_v1',
  'es_MX',
  'UTILITY',
  'approved',
  1,
  '{"type":"object","required":["recipient_name","deliverable_title","project_name","drive_url"],"properties":{"recipient_name":{"type":"string"},"deliverable_title":{"type":"string"},"project_name":{"type":"string"},"drive_url":{"type":"string"}}}'::jsonb,
  'Hola {{1}}, el entregable final "{{2}}" para el proyecto "{{3}}" ha sido entregado exitosamente. Accede a los archivos aquí: {{4}}',
  true
)
on conflict do nothing;

commit;
