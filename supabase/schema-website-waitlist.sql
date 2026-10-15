create table public.website_season_waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254 and email = lower(btrim(email))),
  audience text not null check (audience in ('creator', 'brand')),
  profile_or_company text check (char_length(profile_or_company) <= 200),
  season integer not null default 2027 check (season = 2027),
  consent_at timestamptz not null default now(),
  consent_version text not null default 'season-2027-waitlist-v1',
  consent_text text not null,
  source text not null default 'golfcreatortour.com/season-waitlist',
  created_at timestamptz not null default now(),
  unique (email, audience, season)
);
comment on table public.website_season_waitlist is '2027 season opening November 1, 2026. No public table access.';
alter table public.website_season_waitlist enable row level security;
revoke all on table public.website_season_waitlist from public, anon, authenticated;
grant select, insert, update, delete on table public.website_season_waitlist to service_role;

create table public.website_waitlist_rate_limits (
  key_hash text not null,
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0),
  expires_at timestamptz not null,
  primary key (key_hash, window_start)
);
create index website_waitlist_rate_limits_expiry_idx on public.website_waitlist_rate_limits (expires_at);
alter table public.website_waitlist_rate_limits enable row level security;
revoke all on table public.website_waitlist_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.website_waitlist_rate_limits to service_role;

create function public.submit_website_season_waitlist(
  p_name text, p_email text, p_audience text, p_profile text,
  p_email_hash text, p_ip_hash text
) returns boolean
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_bucket record;
  v_start timestamptz;
  v_attempts integer;
begin
  if p_name is null or char_length(p_name) not between 1 and 100
     or p_email is null or char_length(p_email) not between 3 and 254
     or p_email <> lower(btrim(p_email))
     or p_audience is null or p_audience not in ('creator', 'brand')
     or char_length(p_profile) > 200
     or p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$'
     or (p_ip_hash is not null and p_ip_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'Invalid waitlist submission' using errcode = '22023';
  end if;
  delete from public.website_waitlist_rate_limits where expires_at < v_now;
  for v_bucket in
    select * from (values
      (1, 'global:minute', 60, 100),
      (2, 'global:day', 86400, 2000),
      (3, 'email:day:' || p_email_hash, 86400, 5),
      (4, case when p_ip_hash is not null then 'ip:10min:' || p_ip_hash end, 600, 10),
      (5, case when p_ip_hash is not null then 'ip:day:' || p_ip_hash end, 86400, 50)
    ) as limits(position, bucket_key, seconds, maximum)
    where bucket_key is not null order by position
  loop
    v_start := to_timestamp(floor(extract(epoch from v_now) / v_bucket.seconds) * v_bucket.seconds);
    insert into public.website_waitlist_rate_limits as existing
      (key_hash, window_start, attempts, expires_at)
    values (v_bucket.bucket_key, v_start, 1, v_start + make_interval(secs => v_bucket.seconds) + interval '1 day')
    on conflict (key_hash, window_start) do update
      set attempts = existing.attempts + 1
      where existing.attempts < v_bucket.maximum
    returning attempts into v_attempts;
    if not found then return false; end if;
  end loop;
  insert into public.website_season_waitlist
    (name, email, audience, profile_or_company, consent_text)
  values
    (p_name, p_email, p_audience, nullif(p_profile, ''),
     'Email me about the new GCT season and opportunities for ' ||
     case p_audience when 'creator' then 'creators.' else 'brands.' end)
  on conflict (email, audience, season) do nothing;
  return true;
end;
$$;
revoke all on function public.submit_website_season_waitlist(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_website_season_waitlist(text,text,text,text,text,text) to service_role;
