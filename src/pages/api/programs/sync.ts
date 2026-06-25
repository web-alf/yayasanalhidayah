export const prerender = false;
import type { APIRoute } from 'astro';
import { json, ok, unauthorized, forbidden, serverError } from '@/lib/api';
import { safeEqual } from '@/lib/security';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveEnv } from '@/lib/supabase/env';
import { workerEnv } from '@/lib/supabase/runtime-env';
import { syncProgramsFromWP } from '@/lib/wp/sync';
import { recordActivity } from '@/lib/activity';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

// Sync live WP donation stats into public.programs. Two callers:
//   1. Cloudflare Cron / external — must present X-Cron-Secret; uses the
//      service-role admin client (no user session).
//   2. The admin "Sync dari WP" button — an authenticated owner/admin; uses
//      their RLS-scoped client.
// Either way the public read path still reads Supabase — never WP.

function verifyCron(request: Request, env: { CRON_SECRET?: string }): boolean {
  const provided = request.headers.get('x-cron-secret') ?? '';
  return Boolean(env.CRON_SECRET && provided && safeEqual(provided, env.CRON_SECRET));
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = resolveEnv(workerEnv());
  const hasSecret = Boolean(request.headers.get('x-cron-secret'));

  let client: SupabaseClient<Database>;
  if (hasSecret) {
    if (!verifyCron(request, env)) return unauthorized('Bad cron secret');
    client = createSupabaseAdmin(workerEnv());
  } else {
    if (!locals.user || (locals.role !== 'owner' && locals.role !== 'admin')) return forbidden();
    client = locals.supabase as SupabaseClient<Database>;
  }

  try {
    const summary = await syncProgramsFromWP(client, env.WP_BASE_URL);

    await recordActivity(client, {
      action: 'update',
      entityType: 'programs',
      summary: `sync ${summary.source} dari WP: ${summary.updated}/${summary.matched} diperbarui` +
        (summary.created ? `, ${summary.created} campaign baru dipublikasikan` : '') +
        (summary.removed ? `, ${summary.removed} dihapus` : ''),
    });

    return ok({ summary });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : 'Sync gagal');
  }
};

// GET: cron-friendly (some schedulers only do GET). Secret via header only.
export const GET: APIRoute = async ({ request, locals }) => {
  const env = resolveEnv(workerEnv());
  if (!verifyCron(request, env)) return unauthorized('Bad cron secret');
  const client = createSupabaseAdmin(workerEnv());
  try {
    const summary = await syncProgramsFromWP(client, env.WP_BASE_URL);
    return json({ ok: true, summary });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : 'Sync gagal');
  }
};
