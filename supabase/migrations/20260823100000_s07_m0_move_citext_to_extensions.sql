-- Sprint 07 M0-B: relocate citext out of the exposed public schema.
--
-- This preserves the citext type OID and existing data while moving the
-- extension-owned objects to extensions. The accept_invite local type reference
-- is qualified so future function replacement remains valid with its hardened
-- search_path (pg_catalog, public).

begin;

create schema if not exists extensions;
grant usage on schema extensions to postgres, anon, authenticated, service_role;

alter extension citext set schema extensions;

create or replace function public.accept_invite(p_token_hash bytea)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_invite record;
  v_user_email extensions.citext;
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
    raise exception 'User email % does not match invitation recipient email %',
      v_user_email,
      v_invite.email;
  end if;

  update public.invite_tokens
  set status = 'accepted',
      accepted_at = now(),
      accepted_by = v_user_id
  where id = v_invite.id;

  insert into public.profiles (
    id,
    role,
    full_name,
    is_active
  ) values (
    v_user_id,
    v_invite.role,
    coalesce(
      (select raw_user_meta_data->>'full_name' from auth.users where id = v_user_id),
      split_part(v_user_email::text, '@', 1)
    ),
    true
  )
  on conflict (id) do update
  set role = v_invite.role,
      is_active = true,
      deleted_at = null,
      updated_at = now();

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

  if v_invite.client_id is not null and v_invite.role = 'client' then
    update public.client_contacts
    set profile_id = v_user_id,
        updated_at = now()
    where client_id = v_invite.client_id
      and email = v_invite.email
      and profile_id is null;
  end if;

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
$function$;

commit;
