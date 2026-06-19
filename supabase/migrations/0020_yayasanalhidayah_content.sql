-- 0020_yayasanalhidayah_content.sql
-- yayasanalhidayah-specific content tables. Same conventions as 0007_marketing.sql
-- (uuid PK, sort_order, is_published, created_at/updated_at + set_updated_at trigger,
-- audit_trigger). RLS mirrors 0012_rls.sql's testimonials pattern
-- (anon SELECT published; editor full CRUD via public.is_editor()).

-- programs — replaces the hardcoded src/data/programs.ts. Links OUT to the external
-- DonasiAja campaign platform via donasi_url; the CMS manages metadata only.
create table public.programs (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  category     text not null check (category in ('Kafarat','Fidyah','Kemanusiaan')),
  tag          text not null default '',
  slug         text not null unique,
  image        text not null,
  alt          text not null default '',
  description  text not null,
  donasi_url   text not null,
  sort_order   integer not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index programs_slug_idx   on public.programs(slug);
create index programs_pub_created_idx   on public.programs(is_published, created_at desc);
create trigger trg_programs_updated before update on public.programs
  for each row execute function public.set_updated_at();
create trigger trg_programs_audit
  after insert or update or delete on public.programs
  for each row execute function public.audit_trigger();

-- trust_logos — TrustMarquee section partner/lembaga logos.
create table public.trust_logos (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  src          text not null,
  url          text not null default '',
  sort_order   integer not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_trust_logos_updated before update on public.trust_logos
  for each row execute function public.set_updated_at();

-- why_us — WhyUs section value propositions.
create table public.why_us (
  id           uuid primary key default gen_random_uuid(),
  n            text not null,
  title        text not null,
  descr        text not null,
  sort_order   integer not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_why_us_updated before update on public.why_us
  for each row execute function public.set_updated_at();

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.programs    enable row level security;
alter table public.trust_logos enable row level security;
alter table public.why_us      enable row level security;

-- programs
create policy programs_public_read on public.programs
  for select using (is_published = true);
create policy programs_editor_all on public.programs
  for all using (public.is_editor()) with check (public.is_editor());
-- trust_logos
create policy trust_logos_public_read on public.trust_logos
  for select using (is_published = true);
create policy trust_logos_editor_all on public.trust_logos
  for all using (public.is_editor()) with check (public.is_editor());
-- why_us
create policy why_us_public_read on public.why_us
  for select using (is_published = true);
create policy why_us_editor_all on public.why_us
  for all using (public.is_editor()) with check (public.is_editor());
