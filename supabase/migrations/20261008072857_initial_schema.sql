-- Dedicated Flight Lab schema. This migration never touches other projects.
create table public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  kind text not null check (kind in ('youtube','rss','github','manual')),
  locator text not null check (length(locator) between 1 and 1000),
  enabled boolean not null default false,
  last_fetched_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique(kind,locator)
);
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources(id) on delete set null,
  source_name text not null,
  original_url text not null unique check (original_url ~ '^https?://'),
  original_title text not null,
  title text not null check (length(title) between 1 and 200),
  summary text not null default '',
  why_it_matters text not null default '',
  category text not null default '飞机设计' check (category in ('空气动力学','飞机设计','实验飞行器','模拟与游戏','开源工具')),
  kind text not null check (kind in ('video','project','article')),
  tags text[] not null default '{}',
  quality_score numeric check (quality_score between 0 and 10),
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  featured boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  image_url text,
  summary_basis text not null default 'excerpt' check (summary_basis in ('description','excerpt','manual')),
  moderation_reason text not null default '',
  title_simhash text,
  process_state text not null default 'queued' check (process_state in ('queued','failed','complete')),
  process_attempts integer not null default 0,
  processed_at timestamptz,
  last_attempt_at timestamptz,
  check (not featured or status='published'),
  check (status<>'published' or (length(trim(summary))>0 and length(trim(why_it_matters))>0))
);
create index articles_published_time on public.articles (published_at desc) where status='published';
create index articles_queue on public.articles (created_at) where process_state in ('queued','failed');
create table public.article_inputs (
  article_id uuid primary key references public.articles(id) on delete cascade,
  raw_text text not null check (length(raw_text)<=6000)
);
create table public.ingest_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','complete','awaiting_key','failed')),
  fetched integer not null default 0, inserted integer not null default 0,
  processed integer not null default 0, published integer not null default 0,
  pending integer not null default 0, rejected integer not null default 0,
  duplicates integer not null default 0, failed integer not null default 0,
  prompt_tokens integer not null default 0, completion_tokens integer not null default 0,
  estimated_usd numeric(14,8) not null default 0,
  error text
);
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles(id) on delete set null,
  run_id uuid references public.ingest_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  model text not null, attempt integer not null, status text not null,
  prompt_tokens integer not null, completion_tokens integer not null,
  estimated_usd numeric(14,8) not null,
  usage_known boolean not null default false
);
create index ai_usage_month on public.ai_usage(created_at);
create table public.ingest_lease (
  id integer primary key check (id=1),
  owner uuid,
  expires_at timestamptz not null default '-infinity'
);
insert into public.ingest_lease (id) values (1);

alter table public.admin_roles enable row level security;
alter table public.sources enable row level security;
alter table public.articles enable row level security;
alter table public.article_inputs enable row level security;
alter table public.ingest_runs enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ingest_lease enable row level security;

revoke all on public.admin_roles,public.sources,public.articles,public.article_inputs,public.ingest_runs,public.ai_usage,public.ingest_lease from anon,authenticated;
grant select on public.admin_roles to authenticated;
grant select,insert,update,delete on public.articles,public.sources to authenticated;
grant select on public.article_inputs,public.ingest_runs,public.ai_usage to authenticated;
grant all on public.admin_roles,public.sources,public.articles,public.article_inputs,public.ingest_runs,public.ai_usage,public.ingest_lease to service_role;
grant select(id,title,original_title,summary,why_it_matters,category,tags,source_name,original_url,kind,featured,status,quality_score,published_at,created_at,image_url,summary_basis) on public.articles to anon;

create policy admin_can_read_own_role on public.admin_roles for select to authenticated using (user_id=(select auth.uid()));
create policy published_articles_are_public on public.articles for select to anon,authenticated using (status='published');
create policy admins_manage_articles on public.articles for all to authenticated
using (exists(select 1 from public.admin_roles where user_id=(select auth.uid())))
with check (exists(select 1 from public.admin_roles where user_id=(select auth.uid())));
create policy admins_manage_sources on public.sources for all to authenticated
using (exists(select 1 from public.admin_roles where user_id=(select auth.uid())))
with check (exists(select 1 from public.admin_roles where user_id=(select auth.uid())));
create policy admins_read_inputs on public.article_inputs for select to authenticated using (exists(select 1 from public.admin_roles where user_id=(select auth.uid())));
create policy admins_read_runs on public.ingest_runs for select to authenticated using (exists(select 1 from public.admin_roles where user_id=(select auth.uid())));
create policy admins_read_usage on public.ai_usage for select to authenticated using (exists(select 1 from public.admin_roles where user_id=(select auth.uid())));

create function public.acquire_ingest_lease(lease_owner uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare acquired boolean;
begin
  update public.ingest_lease set owner=lease_owner,expires_at=now()+interval '4 minutes' where id=1 and expires_at<now();
  acquired:=found;
  return acquired;
end;
$$;
create function public.release_ingest_lease(lease_owner uuid) returns void
language sql security invoker set search_path='' as $$
  update public.ingest_lease set owner=null,expires_at='-infinity' where id=1 and owner=lease_owner;
$$;
revoke all on function public.acquire_ingest_lease(uuid),public.release_ingest_lease(uuid) from public,anon,authenticated;
grant execute on function public.acquire_ingest_lease(uuid),public.release_ingest_lease(uuid) to service_role;

-- The queued article and its input are inserted together, or neither is stored.
create function public.enqueue_article(article_payload jsonb, input_text text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare article_uuid uuid;
begin
  insert into public.articles (
    source_id,source_name,original_url,original_title,title,kind,published_at,image_url,summary_basis,title_simhash,moderation_reason
  ) values (
    (article_payload->>'source_id')::uuid,article_payload->>'source_name',article_payload->>'original_url',
    article_payload->>'original_title',article_payload->>'original_title',article_payload->>'kind',
    (article_payload->>'published_at')::timestamptz,article_payload->>'image_url',article_payload->>'summary_basis',
    article_payload->>'title_simhash','等待摘要与内容筛选'
  ) on conflict (original_url) do nothing returning id into article_uuid;
  if article_uuid is not null then
    insert into public.article_inputs(article_id,raw_text) values(article_uuid,input_text);
  end if;
  return article_uuid;
end;
$$;
create function public.monthly_ai_estimate() returns numeric
language sql security invoker set search_path='' as $$
  select coalesce(sum(estimated_usd),0) from public.ai_usage
  where created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
$$;
revoke all on function public.enqueue_article(jsonb,text),public.monthly_ai_estimate() from public,anon,authenticated;
grant execute on function public.enqueue_article(jsonb,text),public.monthly_ai_estimate() to service_role;
