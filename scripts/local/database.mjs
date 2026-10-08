import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { executeSpec, localDbClient } from './query.mjs';

export const adminId = '00000000-0000-4000-8000-000000000001';
export async function openDatabase(dataDir) {
  const pg = await PGlite.create(dataDir);
  const initialized = (await pg.query("select to_regclass('public.local_migrations') as name"))
    .rows[0].name;
  if (!initialized)
    await pg.transaction(async (tx) => {
      await tx.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      grant execute on function auth.uid() to authenticated;
      create table public.local_migrations(name text primary key);
      alter table public.local_migrations enable row level security;
      revoke all on public.local_migrations from public,anon,authenticated,service_role;`);
    });
  await pg.exec('alter table public.local_migrations enable row level security;');
  const migrations = new URL('../../supabase/migrations/', import.meta.url);
  for (const name of (await readdir(migrations)).filter((n) => n.endsWith('.sql')).sort()) {
    if ((await pg.query('select name from local_migrations where name=$1', [name])).rows.length)
      continue;
    await pg.transaction(async (tx) => {
      await tx.exec(await readFile(new URL(name, migrations), 'utf8'));
      await tx.query('insert into local_migrations(name) values($1)', [name]);
    });
  }
  await pg.exec(await readFile(new URL('../../supabase/seed.sql', import.meta.url), 'utf8'));
  await pg.query('insert into auth.users(id) values($1) on conflict do nothing', [adminId]);
  await pg.query('insert into public.admin_roles(user_id) values($1) on conflict do nothing', [
    adminId,
  ]);
  const schema = new Map();
  const tables = [
    'articles',
    'sources',
    'admin_roles',
    'article_inputs',
    'ingest_runs',
    'ai_usage',
  ];
  for (const table of tables) {
    const result = await pg.query(
      "select column_name from information_schema.columns where table_schema='public' and table_name=$1",
      [table],
    );
    schema.set(table, new Set(result.rows.map((r) => r.column_name)));
  }
  const execute = (spec, role = 'service_role', userId = '') =>
    executeSpec(pg, schema, spec, role, userId);
  return { pg, execute, client: localDbClient(execute) };
}
