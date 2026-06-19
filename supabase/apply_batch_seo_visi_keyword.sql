-- ============================================================
-- BATCH: visi settings + focus_keyword + Rank Math SEO + cover_meta + cover_size
-- Paste seluruh isi file ini di Supabase Dashboard → SQL Editor → Run.
-- Idempoten (aman dijalankan berulang): IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- Sumber: migrasi 0015, 0016, 0017, 0018, 0019.
-- ============================================================

-- ── 0015: key "about" (Visi editable di Pengaturan → Visi) ──────────────────
insert into public.settings (key, value) values
  ('about', jsonb_build_object(
    'visi','Menjadi gerakan Sedekah Air Minum terbesar dan paling tepercaya di Indonesia, hadir untuk umat di mana pun mereka berada.'))
on conflict (key) do nothing;

-- ── 0016: kolom articles.focus_keyword (SEO Focus Keyword persist) ─────────
alter table public.articles
  add column if not exists focus_keyword text;

-- ── 0017: tabel seo_settings (Rank Math SEO global) ─────────────────────────
create table if not exists public.seo_settings (
  key        text primary key default 'site',
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- trigger updated_at (idempoten: drop dulu kalau sudah ada)
drop trigger if exists trg_seo_settings_updated on public.seo_settings;
create trigger trg_seo_settings_updated
  before update on public.seo_settings
  for each row execute function public.set_updated_at();

-- RLS: public read (di-render ke <head>), admin write. Idempoten.
alter table public.seo_settings enable row level security;
drop policy if exists seo_settings_public_read on public.seo_settings;
drop policy if exists seo_settings_admin_write on public.seo_settings;
create policy seo_settings_public_read on public.seo_settings
  for select using (true);
create policy seo_settings_admin_write on public.seo_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Seed default.
insert into public.seo_settings (key, value) values
  ('site', jsonb_build_object(
    'title_separator', '|',
    'homepage_title', 'Sedekah Air Minum — Gerakan Wakaf Air Bersih untuk Indonesia',
    'homepage_description', 'Wakaf air bersih untuk masjid, pesantren, dan lembaga pendidikan Islam di seluruh Indonesia. Sedekah jariyah yang terus mengalir.',
    'default_og_image', '',
    'twitter_handle', '',
    'facebook_app_id', '',
    'gsc_verification', '',
    'bing_verification', '',
    'ga4_id', '',
    'sitemap_enabled', true,
    'robots_index', true
  ))
on conflict (key) do nothing;

-- ── 0018: kolom cover_ratio + cover_focal (sampul adjustable) ──────────────
alter table public.articles
  add column if not exists cover_ratio text default '16:9';
alter table public.articles
  add column if not exists cover_focal text default '50,50';

-- ── 0019: kolom cover_size (Penuh / Sedang / Kecil) ──────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'articles' and column_name = 'cover_size'
  ) then
    alter table public.articles
      add column cover_size text default 'full' check (cover_size in ('full', 'medium', 'small'));
  end if;
end $$;

