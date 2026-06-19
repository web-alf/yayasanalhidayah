-- 0018_article_cover_meta.sql
-- Cover/sampul adjustable sizing: aspect ratio + focal point (crop position).
-- cover_ratio  : '16:9' | '4:3' | '1:1' | 'original' (default '16:9')
-- cover_focal  : 'x,y' percentages 0-100 (e.g. '50,50') for object-position
alter table public.articles
  add column if not exists cover_ratio text default '16:9';
alter table public.articles
  add column if not exists cover_focal text default '50,50';
