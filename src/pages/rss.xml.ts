export const prerender = false;
import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getAllPublishedForFeed } from '@/lib/supabase/queries/articles';

export const GET: APIRoute = async ({ locals, site }) => {
  const articles = await getAllPublishedForFeed(locals.supabase, 50);
  return rss({
    title: 'Yayasan Al Hidayah — Artikel',
    description: 'Artikel dan kegiatan Yayasan Al Hidayah.',
    site: site?.toString() ?? 'https://yayasanalhidayah.com',
    items: articles.map((a) => ({
      title: a.title,
      description: a.excerpt ?? '',
      link: `/artikel/${a.slug}`,
      pubDate: a.published_at ? new Date(a.published_at) : undefined,
    })),
    customData: '<language>id-ID</language>',
  });
};
