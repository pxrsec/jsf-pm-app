-- Migration: S02-E02 Public Table and View Access Grants
-- Timestamp: 20260818170000
-- Reference: dev-docs/specs/s02/s02-e02-authoritative-data-platform-and-access-controls-v1.0.md

begin;

-- 1. Schema Usage Grants
grant usage on schema public to postgres, anon, authenticated, service_role;
grant usage on schema private to postgres, service_role, authenticated;

-- 2. Service Role & Postgres Full Privileges
grant all on all tables in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;
grant all on all routines in schema public to postgres, service_role;

grant all on all routines in schema private to postgres, service_role;

-- 3. Authenticated Role Privileges (Governed by RLS Policies)
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all routines in schema public to authenticated;

-- 4. Default Privileges for Future Schema Objects
alter default privileges in schema public grant all on tables to postgres, service_role;
alter default privileges in schema public grant all on sequences to postgres, service_role;
alter default privileges in schema public grant all on routines to postgres, service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant execute on routines to authenticated;

alter default privileges in schema private grant all on routines to postgres, service_role;

-- 5. Strict Anon Revocation (Preserving Zero Public Table Access Boundary)
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all routines in schema public from anon;
revoke all on schema private from anon;

commit;
