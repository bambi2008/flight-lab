-- A date-only RSS timestamp must not be treated as a precise publication time.
alter table public.articles add column published_precision text not null default 'exact'
  check (published_precision in ('exact','date'));
grant select(published_precision) on public.articles to anon;

create or replace function public.enqueue_article(article_payload jsonb, input_text text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare article_uuid uuid;
begin
  insert into public.articles (
    source_id,source_name,original_url,original_title,title,kind,published_at,published_precision,
    image_url,summary_basis,title_simhash,moderation_reason
  ) values (
    (article_payload->>'source_id')::uuid,article_payload->>'source_name',article_payload->>'original_url',
    article_payload->>'original_title',article_payload->>'original_title',article_payload->>'kind',
    (article_payload->>'published_at')::timestamptz,coalesce(article_payload->>'published_precision','exact'),
    article_payload->>'image_url',article_payload->>'summary_basis',article_payload->>'title_simhash','等待摘要与内容筛选'
  ) on conflict (original_url) do nothing returning id into article_uuid;
  if article_uuid is not null then
    insert into public.article_inputs(article_id,raw_text) values(article_uuid,input_text);
  end if;
  return article_uuid;
end;
$$;
revoke all on function public.enqueue_article(jsonb,text) from public,anon,authenticated;
grant execute on function public.enqueue_article(jsonb,text) to service_role;

create index ingest_runs_started_time on public.ingest_runs(started_at desc);

create function public.weekly_ingest_summary() returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('processed',coalesce(sum(processed),0),
    'estimated_usd',coalesce(sum(estimated_usd),0),'runs',count(*))
  from public.ingest_runs where started_at>=now()-interval '7 days';
$$;
revoke all on function public.weekly_ingest_summary() from public,anon;
grant execute on function public.weekly_ingest_summary() to authenticated,service_role;
