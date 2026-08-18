-- Migration: S02-E02 Tighten RLS Auto Enable Execution
-- Timestamp: 20260818172000
-- Reference: Supabase Security Advisor

begin;

revoke all on function public.rls_auto_enable() from public, anon;

commit;
