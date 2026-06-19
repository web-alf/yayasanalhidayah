-- 0019_article_cover_size.sql
-- Cover size preset on the public article page. 'full' (default) = 100% wide,
-- 'medium' = max ~720px, 'small' = max ~480px. Height is also capped to
-- prevent hero images from dominating the fold.
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
