-- Migration: S04-03 Flexible Client Project Planning Trigger
-- Timestamp: 20260819140000
-- Reference: dev-docs/specs/s04/s04-specs/s04-03-project-directory-creation-and-membership-governance-spec.md

begin;

create or replace function private.validate_project_memberships()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_target_project_id uuid;
  v_proj record;
  v_primary_leads integer;
  v_leads integer;
  v_clients integer;
  v_total_members integer;
begin
  if TG_TABLE_NAME = 'projects' then
    if TG_OP = 'DELETE' then
      v_target_project_id := OLD.id;
    else
      v_target_project_id := NEW.id;
    end if;
  else
    -- TG_TABLE_NAME = 'project_members'
    if TG_OP = 'DELETE' then
      v_target_project_id := OLD.project_id;
    else
      v_target_project_id := NEW.project_id;
    end if;
  end if;

  if v_target_project_id is not null then
    for v_proj in
      select p.id, p.project_type, p.status, p.client_id, p.deleted_at
      from public.projects p
      where p.id = v_target_project_id
        and p.deleted_at is null
        and p.status <> 'cancelled'
    loop
      select
        count(*) filter (where member_type = 'pm_lead' and is_primary = true),
        count(*) filter (where member_type = 'pm_lead'),
        count(*) filter (where member_type = 'client'),
        count(*)
      into v_primary_leads, v_leads, v_clients, v_total_members
      from public.project_members
      where project_id = v_proj.id
        and deleted_at is null;

      -- If project_members have been established (or on project_members trigger)
      if TG_TABLE_NAME = 'project_members' or v_total_members > 0 then
        if v_leads < 1 then
          raise exception 'Active project % must have at least one active PM Lead', v_proj.id;
        end if;

        if v_primary_leads <> 1 then
          raise exception 'Active project % must have exactly one active primary PM Lead (found %)', v_proj.id, v_primary_leads;
        end if;

        -- In non-planning active states ('in_progress', 'paused', 'completed'), client project requires at least one client member
        if v_proj.project_type = 'client' and v_proj.status <> 'planning' and v_clients < 1 then
          raise exception 'Active client project % in status % must have at least one active Client member', v_proj.id, v_proj.status;
        end if;

        if v_proj.project_type = 'internal' and v_clients > 0 then
          raise exception 'Active internal project % cannot have Client members', v_proj.id;
        end if;
      end if;
    end loop;
  end if;

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

commit;
