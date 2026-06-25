// Sync core: pulls live stats from WordPress campaigns into public.programs.
// Takes the Supabase client as a param so it runs under EITHER the caller's
// RLS-scoped session (dashboard button) OR the service-role admin client
// (Cloudflare Cron). SSR read path never touches WP — it reads Supabase.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { fetchWpCampaigns } from './campaigns';

export interface SyncSummary {
  source: 'rest' | 'scrape';
  fetched: number;
  matched: number;
  updated: number;
  /** Campaigns found in WP that weren't in `programs` — now auto-created & published. */
  newWpCampaigns: { slug: string; title: string }[];
  /** Count of rows created this run (subset of newWpCampaigns that inserted OK). */
  created: number;
  errors: string[];
}

// New auto-created rows are published immediately in the broadest default
// category so a freshly-created WP campaign shows up on /program right away.
// An editor can refine the category / copy afterwards.
const DEFAULT_CATEGORY = 'Kemanusiaan';
const PLACEHOLDER_IMAGE = '/hero/hero-1.webp';

export async function syncProgramsFromWP(
  client: SupabaseClient<Database>,
  base: string,
): Promise<SyncSummary> {
  const errors: string[] = [];
  const nowIso = new Date().toISOString();

  // Load existing programs (slug → id) so we match WP rows to rows we own.
  const { data: existing, error: readErr } = await client
    .from('programs')
    .select('id, slug, title')
    .order('slug');
  if (readErr) {
    return { source: 'rest', fetched: 0, matched: 0, updated: 0, newWpCampaigns: [], created: 0, errors: [readErr.message] };
  }
  const owned = new Map((existing ?? []).map((p) => [p.slug, p.id]));

  const { source, campaigns } = await fetchWpCampaigns(base, [...owned.keys()]);

  let updated = 0;
  let created = 0;
  const newWpCampaigns: { slug: string; title: string }[] = [];

  for (const c of campaigns) {
    if (!c.slug) continue;
    const id = owned.get(c.slug);

    if (!id) {
      // New WP campaign: auto-create & publish so it appears on /program
      // immediately, with live stats. An editor can refine category / copy later.
      const link = c.link || `${base}/campaign/${c.slug}`;
      const row = {
        title: c.title || c.slug,
        slug: c.slug,
        category: DEFAULT_CATEGORY,
        tag: '',
        image: c.image || PLACEHOLDER_IMAGE,
        alt: c.title || c.slug,
        description: '', // editor fills this in
        donasi_url: link,
        is_published: true,
        target_amount: c.target,
        raised_amount: c.raised ?? 0,
        donatur_count: c.donatur,
        days_left: c.daysLeft,
        progress_pct: c.progressPct ?? 0,
        wp_campaign_id: c.wpId,
        last_synced_at: nowIso,
      };
      const { error } = await client.from('programs').insert(row as never);
      if (error) errors.push(`${c.slug} (create): ${error.message}`);
      else {
        created++;
        newWpCampaigns.push({ slug: c.slug, title: c.title || c.slug });
      }
      continue;
    }

    const row = {
      target_amount: c.target,
      raised_amount: c.raised ?? 0,
      donatur_count: c.donatur,
      days_left: c.daysLeft,
      progress_pct: c.progressPct ?? 0,
      wp_campaign_id: c.wpId,
      // Keep donasi_url fresh in case WP permalink changed.
      ...(c.link ? { donasi_url: c.link } : {}),
      last_synced_at: nowIso,
    };
    const { error } = await client.from('programs').update(row as never).eq('id', id);
    if (error) errors.push(`${c.slug}: ${error.message}`);
    else updated++;
  }

  return {
    source,
    fetched: campaigns.length,
    matched: campaigns.filter((c) => owned.has(c.slug)).length,
    updated,
    newWpCampaigns,
    created,
    errors,
  };
}
