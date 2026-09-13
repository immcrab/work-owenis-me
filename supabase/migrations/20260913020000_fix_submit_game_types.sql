-- games.visits/likes/dislikes are bigint, not integer — the previous
-- migration's RETURNS TABLE declared integer, which PostgREST rejected
-- ("structure of query does not match function result type"). Changing
-- OUT-parameter types needs a drop first; create or replace alone refuses.
drop function if exists public.submit_game(text, text, text, text);

create or replace function public.submit_game(
  p_name text,
  p_url text,
  p_desc text default null,
  p_anon_id text default null
)
returns table (
  slug text,
  name text,
  description text,
  url text,
  category text,
  visits bigint,
  likes bigint,
  dislikes bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(both from coalesce(p_name, ''));
  v_url text := trim(both from coalesce(p_url, ''));
  v_desc text := nullif(trim(both from coalesce(p_desc, '')), '');
  v_anon text := trim(both from coalesce(p_anon_id, ''));
  v_base_slug text;
  v_slug text;
  v_i int := 2;
  v_count int;
begin
  if v_name = '' or length(v_name) > 60 then
    raise exception 'invalid_name';
  end if;

  if v_anon = '' then
    raise exception 'invalid_anon';
  end if;

  if v_url = '' or length(v_url) > 500 or v_url !~* '^https?://\S+$' then
    raise exception 'invalid_url';
  end if;

  if v_desc is not null and length(v_desc) > 140 then
    v_desc := left(v_desc, 140);
  end if;

  select count(*) into v_count
    from public.game_submission_log
    where anon_id = v_anon and created_at > now() - interval '1 day';

  if v_count >= 5 then
    raise exception 'rate_limited';
  end if;

  v_base_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_base_slug := trim(both '-' from v_base_slug);
  if v_base_slug = '' then
    v_base_slug := 'game';
  end if;
  v_base_slug := left(v_base_slug, 30);

  v_slug := v_base_slug;
  while exists (select 1 from public.games g where g.slug = v_slug) loop
    v_slug := v_base_slug || '-' || v_i;
    v_i := v_i + 1;
  end loop;

  insert into public.game_submission_log (anon_id, url, slug, verdict, reason)
  values (v_anon, v_url, v_slug, null, 'manual submission');

  return query
    insert into public.games (slug, name, description, url, category, status, submitted_by, visits, likes, dislikes)
    values (v_slug, v_name, v_desc, v_url, 'Unofficial', 'approved', v_anon, 0, 0, 0)
    returning games.slug, games.name, games.description, games.url, games.category, games.visits, games.likes, games.dislikes;
end;
$$;

grant execute on function public.submit_game(text, text, text, text) to anon, authenticated;
