-- Keep writes as SECURITY INVOKER; reuse the narrow verified-session lookup.
-- Do not grant service_role access to Auth account records.
drop function if exists public.website_editor_commit(text,text,bigint,jsonb,text,uuid,uuid);
create or replace function public.website_editor_commit(p_namespace text,p_page text,p_expected bigint,p_document jsonb,p_action text,p_actor uuid,p_session uuid,p_revision uuid default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_page public.website_editor_pages; v_doc jsonb; v_email text; v_role text;
begin
 if p_namespace !~ '^[a-z0-9][a-z0-9_-]{0,59}$' or p_page not in ('v2','creators','courses','network','site') or p_action not in ('save','publish','restore') then raise exception 'Invalid editor request' using errcode='22023'; end if;
 select m.role,m.email into v_role,v_email from public.website_editor_member(p_actor,p_session) m;
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
revoke all on function public.website_editor_commit(text,text,bigint,jsonb,text,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.website_editor_commit(text,text,bigint,jsonb,text,uuid,uuid,uuid) to service_role;

