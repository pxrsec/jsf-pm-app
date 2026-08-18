-- Migration: S02-E02 Drop Redundant Duplicate Unique Indexes
-- Timestamp: 20260818173000
-- Reference: Supabase Performance Advisor Lint 0009_duplicate_index

begin;

drop index if exists public.invite_tokens_hash_uidx;
drop index if exists public.notification_events_dedup_uidx;

commit;
