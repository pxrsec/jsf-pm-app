-- Sprint 07 M0-C: make notification alert evaluation server-only.
--
-- The public RPC remains the narrow PostgREST entry point for the application's
-- server-side service-role client. Browser/session roles lose direct EXECUTE.
-- The private evaluator is also restricted explicitly because the live catalog
-- currently grants it through PUBLIC while authenticated has private-schema USAGE.
--
-- This migration intentionally does not modify evaluator logic, notification
-- generation, external-delivery suppression, schedules, providers, or schemas.

begin;

-- Public RPC: callable only with the server-held Supabase service-role credential.
revoke all on function public.evaluate_notification_alerts(uuid) from public;
revoke all on function public.evaluate_notification_alerts(uuid) from anon;
revoke all on function public.evaluate_notification_alerts(uuid) from authenticated;
grant execute on function public.evaluate_notification_alerts(uuid) to service_role;

-- Internal evaluator: remove the inherited PUBLIC EXECUTE grant and retain only
-- the trusted service-role execution path used by the public service boundary.
revoke all on function private.evaluate_notification_alerts(uuid) from public;
revoke all on function private.evaluate_notification_alerts(uuid) from anon;
revoke all on function private.evaluate_notification_alerts(uuid) from authenticated;
grant execute on function private.evaluate_notification_alerts(uuid) to service_role;

commit;
