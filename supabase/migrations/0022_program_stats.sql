-- 0022_program_stats.sql
-- Live donation stats synced from the WordPress donation site (donasiaja
-- campaigns) into public.programs. The Astro SSR read path still reads
-- Supabase (never WP per-request); these columns are refreshed by the
-- /api/programs/sync endpoint and the Cloudflare Cron Trigger.
--
-- All nullable: open-ended campaigns may have no target / deadline, and rows
-- created in the admin before any sync have no stats yet.

alter table public.programs
  add column if not exists target_amount  bigint       null,
  add column if not exists raised_amount  bigint       null default 0,
  add column if not exists donatur_count  integer      null default 0,
  add column if not exists days_left      integer      null,
  add column if not exists progress_pct   numeric(5,2) null default 0,
  add column if not exists wp_campaign_id bigint       null,
  add column if not exists last_synced_at timestamptz  null;

-- index for "sync stale / never synced" health checks
create index if not exists programs_sync_idx
  on public.programs (last_synced_at nulls first);
