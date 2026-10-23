-- Permanent change log. Saves by one person on one page within 30 minutes are
-- combined into one session row; rows are never pruned (revisions keep 100 per page).
create table public.website_editor_changes (
 id uuid primary key default gen_random_uuid(),
 namespace text not null, page text not null,
 actor uuid references auth.users(id) on delete set null, actor_email text not null,
 started_at timestamptz not null default now(), ended_at timestamptz not null default now(),
 version_from bigint not null, version_to bigint not null, saves integer not null default 1,
 changes jsonb not null default '[]'::jsonb, summary text[] not null default '{}',
 pr_number integer, pr_status text check(pr_status in ('in_pr','merged','closed'))
);
create index website_editor_changes_recent_idx on public.website_editor_changes(namespace,ended_at desc);
create index website_editor_changes_page_idx on public.website_editor_changes(namespace,page,ended_at desc);
create index website_editor_changes_pr_idx on public.website_editor_changes(pr_number) where pr_number is not null;
alter table public.website_editor_changes enable row level security;
revoke all on public.website_editor_changes from public,anon,authenticated;
grant select,insert,update,delete on public.website_editor_changes to service_role;

alter table public.website_editor_submissions add column submitted_email text;
alter table public.website_editor_submissions drop constraint website_editor_submissions_status_check;
alter table public.website_editor_submissions add constraint website_editor_submissions_status_check check(status in ('queued','in_pr','merged','closed','error','stale'));

-- Every save now joins the review queue, so saved changes reach the draft PR without
-- a separate submit step. An open PR's link is kept while newer changes wait to sync.
-- Version conflicts raise PT409 (HTTP 409): PostgREST retries 40001 serialization
-- failures, so the previous code could loop instead of reporting the conflict.
drop function public.website_editor_commit(text,text,bigint,jsonb,text,uuid,uuid,uuid);
create function public.website_editor_commit(p_namespace text,p_page text,p_expected bigint,p_document jsonb,p_action text,p_actor uuid,p_session uuid,p_revision uuid default null,p_change jsonb default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_page public.website_editor_pages; v_doc jsonb; v_email text; v_role text;
begin
 if p_namespace !~ '^[a-z0-9][a-z0-9_-]{0,59}$' or p_page not in ('v2','creators','brands','courses','events','network','site') or p_action not in ('save','publish','restore') then raise exception 'Invalid editor request' using errcode='22023'; end if;
 if p_change is not null and (jsonb_typeof(p_change->'changes') is distinct from 'array' or jsonb_typeof(p_change->'summary') is distinct from 'array') then raise exception 'Invalid change log' using errcode='22023'; end if;
 select m.role,m.email into v_role,v_email from public.website_editor_member(p_actor,p_session) m;
 if v_role is null or (p_action='publish' and v_role not in ('publisher','owner')) then raise exception 'Editor access required' using errcode='42501'; end if;
 insert into public.website_editor_pages(namespace,page) values(p_namespace,p_page) on conflict do nothing;
 select * into v_page from public.website_editor_pages where namespace=p_namespace and page=p_page for update;
 if v_page.version<>p_expected then raise exception 'Page changed. Reload the saved draft before saving again.' using errcode='PT409'; end if;
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
 if p_change ? 'id' then
  update public.website_editor_changes set changes=p_change->'changes',summary=array(select jsonb_array_elements_text(p_change->'summary')),ended_at=now(),version_to=v_page.version,saves=saves+1
  where id=(p_change->>'id')::uuid and namespace=p_namespace and page=p_page and actor=p_actor and version_to=p_expected;
  if not found then raise exception 'Page changed. Reload the saved draft before saving again.' using errcode='PT409'; end if;
 elsif p_change is not null then
  insert into public.website_editor_changes(namespace,page,actor,actor_email,version_from,version_to,changes,summary)
  values(p_namespace,p_page,p_actor,v_email,p_expected,v_page.version,p_change->'changes',array(select jsonb_array_elements_text(p_change->'summary')));
 end if;
 if p_action in ('save','restore') and p_page in ('network','creators','brands','courses','events','site') then
  insert into public.website_editor_submissions as s(namespace,page,version,document,submitted_by,submitted_email) values(p_namespace,p_page,v_page.version,v_doc,p_actor,v_email)
  on conflict(namespace,page) do update set id=gen_random_uuid(),version=excluded.version,document=excluded.document,submitted_by=excluded.submitted_by,submitted_email=excluded.submitted_email,submitted_at=now(),status='queued',error=null,commit_sha=null,
  pr_number=case when s.status in ('merged','closed') then null else s.pr_number end,pr_url=case when s.status in ('merged','closed') then null else s.pr_url end;
 end if;
 return to_jsonb(v_page);
end $$;
revoke all on function public.website_editor_commit(text,text,bigint,jsonb,text,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.website_editor_commit(text,text,bigint,jsonb,text,uuid,uuid,uuid,jsonb) to service_role;

create or replace function public.website_editor_submit(p_namespace text,p_page text,p_expected bigint,p_actor uuid,p_session uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_page public.website_editor_pages; v_submission public.website_editor_submissions; v_email text;
begin
 select m.email into v_email from public.website_editor_member(p_actor,p_session) m;
 if v_email is null then raise exception 'Editor access required' using errcode='42501'; end if;
 if p_page not in ('network','creators','brands','courses','events','site') then raise exception 'Page not found' using errcode='22023'; end if;
 select * into v_page from public.website_editor_pages where namespace=p_namespace and page=p_page for update;
 if v_page.version is null or v_page.version<>p_expected then raise exception 'Save the latest draft before sending it for review' using errcode='PT409'; end if;
 select * into v_submission from public.website_editor_submissions where namespace=p_namespace and page=p_page;
 if v_submission.version=v_page.version and v_submission.status in ('queued','in_pr') then return to_jsonb(v_submission); end if;
 insert into public.website_editor_submissions as s(namespace,page,version,document,submitted_by,submitted_email) values(p_namespace,p_page,v_page.version,v_page.draft,p_actor,v_email)
 on conflict(namespace,page) do update set id=gen_random_uuid(),version=excluded.version,document=excluded.document,submitted_by=excluded.submitted_by,submitted_email=excluded.submitted_email,submitted_at=now(),status='queued',error=null,commit_sha=null,
 pr_number=case when s.status in ('merged','closed') then null else s.pr_number end,pr_url=case when s.status in ('merged','closed') then null else s.pr_url end
 returning * into v_submission;
 return to_jsonb(v_submission);
end $$;
