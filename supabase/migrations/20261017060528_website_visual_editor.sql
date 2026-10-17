create table public.website_editor_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('editor','publisher','owner')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.website_editor_pages (
 namespace text not null,
 page text not null check(page in ('v2','creators','courses','network','site')),
 draft jsonb not null default '{}'::jsonb,
 published jsonb not null default '{}'::jsonb,
 version bigint not null default 0,
 published_version bigint not null default 0,
 updated_at timestamptz not null default now(),
 published_at timestamptz,
 updated_by uuid references auth.users(id) on delete set null,
 primary key(namespace,page)
);
create table public.website_editor_revisions (
 id uuid primary key default gen_random_uuid(),
 namespace text not null,
 page text not null,
 version bigint not null,
 action text not null check(action in ('save','publish','restore')),
 document jsonb not null,
 actor uuid references auth.users(id) on delete set null,
 actor_email text not null,
 created_at timestamptz not null default now()
);
create index website_editor_revision_page_idx on public.website_editor_revisions(namespace,page,created_at desc);
create table public.website_editor_media (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 path text not null unique,
 mime text not null,
 size_bytes integer not null check(size_bytes>0 and size_bytes<=26214400),
 status text not null default 'pending' check(status in ('pending','ready')),
 uploaded_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.website_editor_members enable row level security;
alter table public.website_editor_pages enable row level security;
alter table public.website_editor_revisions enable row level security;
alter table public.website_editor_media enable row level security;
revoke all on public.website_editor_members,public.website_editor_pages,public.website_editor_revisions,public.website_editor_media from public,anon,authenticated;
grant select,insert,update,delete on public.website_editor_members,public.website_editor_pages,public.website_editor_revisions,public.website_editor_media to service_role;

-- Only the authenticated Edge Function can call these functions. This check also
-- rejects revoked Auth sessions rather than trusting a still-valid access JWT.
create function public.website_editor_member(p_user uuid,p_session uuid)
returns table(user_id uuid,role text,email text)
language sql stable security definer set search_path=pg_catalog as $$
 select m.user_id,m.role,u.email::text from public.website_editor_members m
 join auth.users u on u.id=m.user_id
 where m.user_id=p_user and m.active and u.email_confirmed_at is not null
 and exists(select 1 from auth.sessions s where s.id=p_session and s.user_id=p_user)
$$;
revoke all on function public.website_editor_member(uuid,uuid) from public,anon,authenticated;
grant execute on function public.website_editor_member(uuid,uuid) to service_role;

create function public.website_editor_commit(p_namespace text,p_page text,p_expected bigint,p_document jsonb,p_action text,p_actor uuid,p_revision uuid default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_page public.website_editor_pages; v_doc jsonb; v_email text; v_role text;
begin
 if p_namespace !~ '^[a-z0-9][a-z0-9_-]{0,59}$' or p_page not in ('v2','creators','courses','network','site') or p_action not in ('save','publish','restore') then raise exception 'Invalid editor request' using errcode='22023'; end if;
 select m.role,u.email into v_role,v_email from public.website_editor_members m join auth.users u on u.id=m.user_id where m.user_id=p_actor and m.active and u.email_confirmed_at is not null;
 if v_role is null or (p_action='publish' and v_role not in ('publisher','owner')) then raise exception 'Editor access required' using errcode='42501'; end if;
 insert into public.website_editor_pages(namespace,page) values(p_namespace,p_page) on conflict do nothing;
 select * into v_page from public.website_editor_pages where namespace=p_namespace and page=p_page for update;
 if v_page.version<>p_expected then raise exception 'Page changed. Reload the saved draft before saving again.' using errcode='40001'; end if;
 if p_action='publish' then v_doc=v_page.draft;
 elsif p_action='restore' then select document into v_doc from public.website_editor_revisions where id=p_revision and namespace=p_namespace and page=p_page; if v_doc is null then raise exception 'Version not found' using errcode='22023'; end if;
 else v_doc=p_document; end if;
 if v_doc is null or jsonb_typeof(v_doc)<>'object' or octet_length(v_doc::text)>700000 then raise exception 'Invalid page document' using errcode='22023'; end if;
 update public.website_editor_pages set draft=v_doc,version=version+1,updated_at=now(),updated_by=p_actor,
 published=case when p_action='publish' then v_doc else published end,
 published_version=case when p_action='publish' then version+1 else published_version end,
 published_at=case when p_action='publish' then now() else published_at end
 where namespace=p_namespace and page=p_page returning * into v_page;
 insert into public.website_editor_revisions(namespace,page,version,action,document,actor,actor_email) values(p_namespace,p_page,v_page.version,p_action,v_doc,p_actor,v_email);
 delete from public.website_editor_revisions where id in (select id from public.website_editor_revisions where namespace=p_namespace and page=p_page order by created_at desc offset 100);
 return to_jsonb(v_page);
end $$;
revoke all on function public.website_editor_commit(text,text,bigint,jsonb,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.website_editor_commit(text,text,bigint,jsonb,text,uuid,uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('website-editor-media','website-editor-media',true,26214400,array['image/jpeg','image/png','image/webp','image/gif','image/avif','video/mp4','video/webm']) on conflict(id) do nothing;
-- No object write policies are granted to app users or anonymous visitors.
insert into public.website_editor_members(user_id,role)
select id,'publisher' from auth.users where lower(email)='piff@golfcreatoropen.com' and email_confirmed_at is not null
on conflict(user_id) do nothing;

