// WordPress campaign fetcher (Path B primary, Path A fallback).
//
// PRIMARY — REST: once the mu-plugin `yah-campaign-rest.php` is installed on the
// WP site, GET {WP_BASE_URL}/wp-json/wp/v2/campaigns returns the campaign CPT as
// JSON, including a `meta_all` object (all post_meta) and `donasi_url`. We read
// title/slug/link/image from the standard fields and scan `meta_all` heuristically
// for target / raised / donatur so we don't hardcode donasiaja's internal meta-key
// names (they can change between plugin versions).
//
// FALLBACK — scrape: if REST 404s (mu-plugin not yet installed), we parse the
// rendered /campaign/<slug> HTML for the same numbers. Fragile by nature; only
// used so the feature degrades instead of breaking before the WP side is wired.
//
// This module is import-safe on the server only (used by /api/programs/sync).
// It NEVER runs at SSR render time — the public pages read Supabase.

export interface WpCampaign {
  wpId: number | null;
  slug: string;
  title: string;
  link: string;
  image: string | null;
  target: number | null;
  raised: number | null;
  donatur: number | null;
  daysLeft: number | null;
  progressPct: number | null;
}

const REST_PATH = '/wp-json/wp/v2/campaigns';
const PER_PAGE = 100;
const FETCH_TIMEOUT_MS = 12_000;

async function fetchJson(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: 'application/json', 'user-agent': 'yayasanalhidayah-sync/1.0' },
    });
  } finally {
    clearTimeout(t);
  }
}

/** Strip Indonesian "Rp", thousands separators, and stray text → integer or null. */
export function parseRupiah(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw);
  const s = String(raw);
  const digits = s.replace(/[^\d]/g, ''); // "Rp 1.250.000" → "1250000"
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

/** Parse a small integer (donatur count, days). */
function parseInt0(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw);
  const m = s.match(/\d+/);
  return m ? Number.parseInt(m[0], 10) : null;
}

/** WP REST renders title/content as { rendered: string } objects. */
function rendered(v: unknown): string {
  if (v && typeof v === 'object' && 'rendered' in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>).rendered ?? '');
  }
  return v == null ? '' : String(v);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .trim();
}

/** Heuristically pull a numeric stat out of donasiaja's post_meta bag. */
function pickMeta(meta: Record<string, unknown>, needles: string[]): unknown {
  for (const key of Object.keys(meta)) {
    const k = key.toLowerCase();
    if (needles.some((n) => k.includes(n))) {
      const v = meta[key];
      if (v != null && v !== '') return v;
    }
  }
  return null;
}

function progress(target: number | null, raised: number | null): number | null {
  if (!target || target <= 0 || raised == null) return null;
  return Math.min(100, Math.round((raised / target) * 10000) / 100);
}

function mapRestItem(item: Record<string, unknown>): WpCampaign {
  const meta = (item.meta_all && typeof item.meta_all === 'object'
    ? (item.meta_all as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const target = parseRupiah(pickMeta(meta, ['target', 'goal']));
  const raised = parseRupiah(pickMeta(meta, ['raised', 'collect', 'terkumpul', 'current', 'donasi_total', 'total_donasi']));
  const donatur = parseInt0(pickMeta(meta, ['donatur', 'donor', 'backer', 'count_donasi', 'jumlah_donatur']));
  const daysLeft = parseInt0(pickMeta(meta, ['days_left', 'sisa_hari', 'remaining', 'deadline_days']));

  const featured = typeof item.featured_image_url === 'string' ? item.featured_image_url : '';

  return {
    wpId: typeof item.id === 'number' ? item.id : parseInt0(item.id),
    slug: String(item.slug ?? ''),
    title: decodeEntities(rendered(item.title)),
    link: String((item.donasi_url as string) || (item.link as string) || ''),
    image: featured || null,
    target,
    raised,
    donatur,
    daysLeft,
    progressPct: progress(target, raised),
  };
}

/** Try the REST endpoint (mu-plugin). Returns null if it isn't available. */
async function fetchViaRest(base: string): Promise<WpCampaign[] | null> {
  const all: WpCampaign[] = [];
  for (let page = 1; page <= 10; page++) {
    const url = `${base}${REST_PATH}?per_page=${PER_PAGE}&page=${page}&_embed=1`;
    let res: Response;
    try {
      res = await fetchJson(url);
    } catch {
      return all.length ? all : null;
    }
    if (res.status === 404) return null; // CPT not REST-exposed → caller falls back
    if (!res.ok) break;
    let body: unknown;
    try { body = await res.json(); } catch { break; }
    if (!Array.isArray(body) || body.length === 0) break;

    for (const item of body as Record<string, unknown>[]) {
      const c = mapRestItem(item);
      // Resolve featured image from _embedded if meta didn't carry one.
      if (!c.image) {
        const emb = (item as any)?._embedded?.['wp:featuredmedia']?.[0]?.source_url;
        if (typeof emb === 'string') c.image = emb;
      }
      if (c.slug) all.push(c);
    }
    const totalPages = Number(res.headers.get('x-wp-totalpages') ?? '1');
    if (page >= totalPages) break;
  }
  return all;
}

/** Fallback: scrape a single rendered campaign page for stats. */
async function scrapeOne(base: string, slug: string): Promise<WpCampaign | null> {
  const url = `${base}/campaign/${slug}`;
  let html: string;
  try {
    const res = await fetchJson(url);
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  const grab = (re: RegExp): string | null => {
    const m = html.match(re);
    return m ? m[1] : null;
  };

  const ogTitle = grab(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const ogImage = grab(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);

  // donasiaja v2.x class hooks. Capture the element's inner HTML (lazy, to its
  // closing </span>) instead of a single text node — the markup nests values:
  //   <span class="d_total">Rp 0</span>
  //   <span class="d_target"><span class="d_target_text">dan masih terus dikumpulkan</span></span>
  //   <span class="d_target_graph"><b>0</b> Donatur</span>
  //   <span class="d_date"><span>∞&nbsp;hari&nbsp;lagi</span></span>
  // Then parse the first number out of the blob; open-ended campaigns
  // ("dan masih terus dikumpulkan", "∞ hari lagi", "Rp 0") yield null/0.
  const innerBlob = (cls: string): string => {
    const m = html.match(new RegExp(`class=["'][^"']*${cls}[^"']*["'][^>]*>(.*?)</span>`, 'i'));
    return m ? m[1] : '';
  };

  const raised = parseRupiah(innerBlob('d_total'));
  // Target value lives in d_target_text; the outer d_target span holds only
  // whitespace before it. Open-ended campaigns put prose here → null.
  const target = parseRupiah(innerBlob('d_target_text'));
  const donatur = parseInt0(innerBlob('d_target_graph'));
  const daysLeft = parseInt0(innerBlob('d_date'));

  return {
    wpId: null,
    slug,
    title: ogTitle ? decodeEntities(ogTitle) : '',
    link: url,
    image: ogImage,
    target,
    raised,
    donatur,
    daysLeft,
    progressPct: progress(target, raised),
  };
}

export interface FetchResult {
  source: 'rest' | 'scrape';
  campaigns: WpCampaign[];
}

/**
 * Fetch campaigns from WP. Prefers REST (mu-plugin); if unavailable, scrapes the
 * given known slugs (the sync caller passes the slugs already in `programs`).
 */
export async function fetchWpCampaigns(base: string, knownSlugs: string[]): Promise<FetchResult> {
  const rest = await fetchViaRest(base);
  if (rest && rest.length > 0) return { source: 'rest', campaigns: rest };

  // Fallback: scrape known slugs (bounded concurrency).
  const out: WpCampaign[] = [];
  const CONCURRENCY = 4;
  for (let i = 0; i < knownSlugs.length; i += CONCURRENCY) {
    const batch = knownSlugs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((s) => scrapeOne(base, s)));
    for (const r of results) if (r) out.push(r);
  }
  return { source: 'scrape', campaigns: out };
}
