-- S10-02: Model A ordinary invitation lifecycle for Admin/PM administration.
-- Model A never persists a recoverable raw token. A raw opaque token is returned only
-- from create/rotate to the initiating authenticated request; the application creates
-- its join URL and copies it within that interaction. Later "resend" rotates the
-- invitation and returns a new token. Lists and all other commands return no token,
-- token hash, or recipient email.

begin;

-- -----------------------------------------------------------------------------
-- Shared private helpers. They are not executable by application roles.
-- -----------------------------------------------------------------------------
create or replace function private.assert_s10_invitation_manager()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null or not private.is_pm() then
    raise exception 'Invitation administration is unavailable';
  end if;
  return v_actor_id;
end;
$function$;

create or replace function private.new_s10_invitation_token()
returns text
language sql
volatile
security definer
set search_path = pg_catalog, public, extensions
as $function$
  select rtrim(
    translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'),
    '='
  );
$function$;

create or replace function private.resolve_s10_ordinary_invitation(
  p_role public.app_role,
  p_contact_id uuid,
  p_recipient_email text,
  p_project_id uuid
)
returns table (
  recipient_email extensions.citext,
  contact_id uuid,
  client_id uuid,
  project_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_contact public.client_contacts%rowtype;
  v_project public.projects%rowtype;
begin
  perform private.assert_s10_invitation_manager();

  if p_role not in ('client', 'operator') then
    raise exception 'Invitation role is unavailable';
  end if;

  if p_role = 'client' then
    if p_contact_id is null or p_recipient_email is not null then
      raise exception 'Client invitation requires an exact contact';
    end if;

    select * into v_contact
    from public.client_contacts
    where id = p_contact_id
      and deleted_at is null
    for share;

    if not found then
      raise exception 'Invitation contact is unavailable';
    end if;
    if v_contact.profile_id is not null then
      raise exception 'Invitation contact already has an account';
    end if;

    if p_project_id is not null then
      select * into v_project
      from public.projects
      where id = p_project_id
        and deleted_at is null
      for share;

      if not found or v_project.project_type <> 'client' then
        raise exception 'Invitation project is unavailable';
      end if;

      if v_contact.client_id is null then
        if not exists (
          select 1
          from public.project_client_contacts pcc
          where pcc.project_id = v_project.id
            and pcc.contact_id = v_contact.id
            and pcc.deleted_at is null
        ) then
          raise exception 'Invitation contact is not associated with the selected project';
        end if;
      elsif v_project.client_id is distinct from v_contact.client_id then
        raise exception 'Invitation contact does not match the selected project';
      end if;
    end if;

    return query select v_contact.email, v_contact.id, v_contact.client_id, p_project_id;
    return;
  end if;

  if p_contact_id is not null then
    raise exception 'Operator invitation cannot bind a client contact';
  end if;
  if p_recipient_email is null
    or char_length(btrim(p_recipient_email)) not between 3 and 320
    or position('@' in btrim(p_recipient_email)) = 0 then
    raise exception 'A valid recipient email is required';
  end if;

  if p_project_id is not null then
    select * into v_project
    from public.projects
    where id = p_project_id
      and deleted_at is null
    for share;

    if not found then
      raise exception 'Invitation project is unavailable';
    end if;
  end if;

  return query select btrim(p_recipient_email)::extensions.citext, null::uuid, null::uuid, p_project_id;
end;
$function$;

-- -----------------------------------------------------------------------------
-- Model A write commands. Raw tokens leave the database only at create/rotate.
-- -----------------------------------------------------------------------------
create or replace function public.create_ordinary_invitation(
  p_role public.app_role,
  p_contact_id uuid default null,
  p_recipient_email text default null,
  p_project_id uuid default null,
  p_expires_in_hours integer default 168
)
returns table (
  invitation_id uuid,
  invitation_role public.app_role,
  expires_at timestamptz,
  invitation_token text
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_actor_id uuid;
  v_identity record;
  v_token text;
  v_invitation_id uuid;
  v_expires_at timestamptz;
begin
  v_actor_id := private.assert_s10_invitation_manager();

  if p_expires_in_hours not between 1 and 720 then
    raise exception 'Invitation expiry is unavailable';
  end if;

  select * into v_identity
  from private.resolve_s10_ordinary_invitation(
    p_role, p_contact_id, p_recipient_email, p_project_id
  );

  -- Model A permits one usable ordinary invitation for the exact recipient
  -- identity. Expired rows are normalized; earlier usable rows are revoked
  -- before the successor token is issued, so no prior join link remains valid.
  with superseded as (
    update public.invite_tokens i
    set status = case when i.expires_at <= now() then 'expired'::public.invite_status else 'revoked'::public.invite_status end,
        revoked_at = case when i.expires_at <= now() then i.revoked_at else now() end
    where i.role = p_role
      and i.status = 'pending'
      and (
        (p_role = 'client' and i.contact_id = v_identity.contact_id)
        or (p_role = 'operator' and i.contact_id is null and i.email = v_identity.recipient_email)
      )
    returning i.id, i.project_id, i.status
  )
  insert into public.audit_logs (
    entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role
  )
  select
    'invite_token', superseded.id, superseded.project_id, 'invite_superseded',
    jsonb_build_object('outcome', superseded.status),
    v_actor_id, private.current_user_role()
  from superseded;

  v_token := private.new_s10_invitation_token();
  v_expires_at := now() + make_interval(hours => p_expires_in_hours);

  insert into public.invite_tokens (
    token_hash, email, role, project_id, client_id, contact_id,
    status, expires_at, created_by
  ) values (
    digest(v_token, 'sha256'), v_identity.recipient_email, p_role,
    v_identity.project_id, v_identity.client_id, v_identity.contact_id,
    'pending', v_expires_at, v_actor_id
  ) returning id into v_invitation_id;

  insert into public.audit_logs (
    entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role
  ) values (
    'invite_token', v_invitation_id, v_identity.project_id, 'invite_created',
    jsonb_build_object(
      'role', p_role,
      'contact_id', v_identity.contact_id,
      'client_id', v_identity.client_id,
      'project_id', v_identity.project_id,
      'expires_at', v_expires_at
    ),
    v_actor_id, private.current_user_role()
  );

  return query select v_invitation_id, p_role, v_expires_at, v_token;
end;
$function$;

create or replace function public.rotate_ordinary_invitation(
  p_invitation_id uuid,
  p_expires_in_hours integer default 168
)
returns table (
  invitation_id uuid,
  invitation_role public.app_role,
  expires_at timestamptz,
  invitation_token text
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_actor_id uuid;
  v_existing public.invite_tokens%rowtype;
  v_token text;
  v_invitation_id uuid;
  v_expires_at timestamptz;
begin
  v_actor_id := private.assert_s10_invitation_manager();

  if p_expires_in_hours not between 1 and 720 then
    raise exception 'Invitation expiry is unavailable';
  end if;

  select * into v_existing
  from public.invite_tokens
  where id = p_invitation_id
  for update;

  if not found
    or v_existing.role not in ('client', 'operator')
    or v_existing.status <> 'pending'
    or v_existing.revoked_at is not null
    or v_existing.expires_at <= now() then
    raise exception 'Invitation is unavailable';
  end if;

  -- Revalidate retained context under current state before issuing a successor.
  perform 1
  from private.resolve_s10_ordinary_invitation(
    v_existing.role,
    v_existing.contact_id,
    case when v_existing.role = 'operator' then v_existing.email::text else null end,
    v_existing.project_id
  );

  update public.invite_tokens
  set status = 'revoked', revoked_at = now()
  where id = v_existing.id;

  v_token := private.new_s10_invitation_token();
  v_expires_at := now() + make_interval(hours => p_expires_in_hours);

  insert into public.invite_tokens (
    token_hash, email, role, project_id, client_id, contact_id,
    status, expires_at, created_by
  ) values (
    digest(v_token, 'sha256'), v_existing.email, v_existing.role,
    v_existing.project_id, v_existing.client_id, v_existing.contact_id,
    'pending', v_expires_at, v_actor_id
  ) returning id into v_invitation_id;

  insert into public.audit_logs (
    entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role
  ) values
  (
    'invite_token', v_existing.id, v_existing.project_id, 'invite_rotated',
    jsonb_build_object('replacement_invitation_id', v_invitation_id),
    v_actor_id, private.current_user_role()
  ),
  (
    'invite_token', v_invitation_id, v_existing.project_id, 'invite_created',
    jsonb_build_object(
      'role', v_existing.role,
      'contact_id', v_existing.contact_id,
      'client_id', v_existing.client_id,
      'project_id', v_existing.project_id,
      'expires_at', v_expires_at,
      'replaces_invitation_id', v_existing.id
    ),
    v_actor_id, private.current_user_role()
  );

  return query select v_invitation_id, v_existing.role, v_expires_at, v_token;
end;
$function$;

create or replace function public.revoke_ordinary_invitation(
  p_invitation_id uuid
)
returns table (
  invitation_id uuid,
  invitation_status public.invite_status,
  changed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_actor_id uuid;
  v_existing public.invite_tokens%rowtype;
begin
  v_actor_id := private.assert_s10_invitation_manager();

  select * into v_existing
  from public.invite_tokens
  where id = p_invitation_id
  for update;

  if not found or v_existing.role not in ('client', 'operator') then
    raise exception 'Invitation is unavailable';
  end if;

  if v_existing.status = 'pending'
    and v_existing.revoked_at is null
    and v_existing.expires_at > now() then
    update public.invite_tokens
    set status = 'revoked', revoked_at = now()
    where id = v_existing.id;

    insert into public.audit_logs (
      entity_type, entity_id, project_id, action, changed_fields, actor_id, actor_role
    ) values (
      'invite_token', v_existing.id, v_existing.project_id, 'invite_revoked',
      jsonb_build_object('outcome', 'revoked'),
      v_actor_id, private.current_user_role()
    );

    return query select v_existing.id, 'revoked'::public.invite_status, true;
    return;
  end if;

  if v_existing.status = 'pending' and v_existing.expires_at <= now() then
    update public.invite_tokens
    set status = 'expired'
    where id = v_existing.id;
    return query select v_existing.id, 'expired'::public.invite_status, true;
    return;
  end if;

  return query select v_existing.id, v_existing.status, false;
end;
$function$;

-- -----------------------------------------------------------------------------
-- Bounded management projection. IDs support actions only; UI must not render
-- them. Recipient email, token material, audit payloads, and profile metadata
-- are deliberately excluded.
-- -----------------------------------------------------------------------------
create or replace function public.list_ordinary_invitation_administration(
  p_before_created_at timestamptz default null,
  p_before_invitation_id uuid default null,
  p_limit integer default 50
)
returns table (
  invitation_id uuid,
  role public.app_role,
  status public.invite_status,
  recipient_label text,
  contact_id uuid,
  project_id uuid,
  project_name text,
  created_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  perform private.assert_s10_invitation_manager();

  if p_limit not between 1 and 100 then
    raise exception 'Invitation page limit is unavailable';
  end if;
  if (p_before_created_at is null) <> (p_before_invitation_id is null) then
    raise exception 'Invitation cursor is unavailable';
  end if;

  return query
  select
    i.id,
    i.role,
    case
      when i.status = 'pending' and i.revoked_at is not null then 'revoked'::public.invite_status
      when i.status = 'pending' and i.expires_at <= now() then 'expired'::public.invite_status
      else i.status
    end as status,
    case
      when i.role = 'client' and contact_row.id is not null then contact_row.full_name
      when i.role = 'operator' then 'Operator invitation'
      else 'Invitation'
    end as recipient_label,
    i.contact_id,
    i.project_id,
    project_row.name,
    i.created_at,
    i.expires_at,
    i.accepted_at,
    i.revoked_at
  from public.invite_tokens i
  left join public.client_contacts contact_row
    on contact_row.id = i.contact_id
    and contact_row.deleted_at is null
  left join public.projects project_row
    on project_row.id = i.project_id
    and project_row.deleted_at is null
  where i.role in ('client', 'operator')
    and (
      p_before_created_at is null
      or (i.created_at, i.id) < (p_before_created_at, p_before_invitation_id)
    )
  order by i.created_at desc, i.id desc
  limit p_limit;
end;
$function$;

alter function private.assert_s10_invitation_manager() owner to postgres;
alter function private.new_s10_invitation_token() owner to postgres;
alter function private.resolve_s10_ordinary_invitation(public.app_role, uuid, text, uuid) owner to postgres;
alter function public.create_ordinary_invitation(public.app_role, uuid, text, uuid, integer) owner to postgres;
alter function public.rotate_ordinary_invitation(uuid, integer) owner to postgres;
alter function public.revoke_ordinary_invitation(uuid) owner to postgres;
alter function public.list_ordinary_invitation_administration(timestamptz, uuid, integer) owner to postgres;

revoke all on function private.assert_s10_invitation_manager() from public, anon, authenticated, service_role;
revoke all on function private.new_s10_invitation_token() from public, anon, authenticated, service_role;
revoke all on function private.resolve_s10_ordinary_invitation(public.app_role, uuid, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.create_ordinary_invitation(public.app_role, uuid, text, uuid, integer) from public, anon, service_role;
revoke all on function public.rotate_ordinary_invitation(uuid, integer) from public, anon, service_role;
revoke all on function public.revoke_ordinary_invitation(uuid) from public, anon, service_role;
revoke all on function public.list_ordinary_invitation_administration(timestamptz, uuid, integer) from public, anon, service_role;

grant execute on function public.create_ordinary_invitation(public.app_role, uuid, text, uuid, integer) to authenticated;
grant execute on function public.rotate_ordinary_invitation(uuid, integer) to authenticated;
grant execute on function public.revoke_ordinary_invitation(uuid) to authenticated;
grant execute on function public.list_ordinary_invitation_administration(timestamptz, uuid, integer) to authenticated;

commit;
