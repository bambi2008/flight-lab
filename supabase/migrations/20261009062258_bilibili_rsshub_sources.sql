-- Add a dedicated bridge type. URLs remain server configured, never supplied in the source locator.
alter table public.sources drop constraint sources_kind_check;
alter table public.sources add constraint sources_kind_check
  check (kind in ('youtube','bilibili','rss','github','manual'));
alter table public.sources add constraint sources_bilibili_uid_check
  check (kind <> 'bilibili' or locator ~ '^[1-9][0-9]{0,19}$');
-- Connectivity sample only; activate after a successful bridge check.
insert into public.sources(name,kind,locator,enabled)
values ('无人机工坊 · B站试接入','bilibili','525644756',false)
on conflict(kind,locator) do nothing;
