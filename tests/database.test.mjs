import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('PostgreSQL schema enforces public read-only access, admin authorization, publication rules and task locking', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to authenticated;`,
    );
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/20261008072857_initial_schema.sql', import.meta.url),
        'utf8',
      ),
    );
    await db.exec(await readFile(new URL('../supabase/seed.sql', import.meta.url), 'utf8'));
    const admin = '00000000-0000-4000-8000-000000000001',
      visitor = '00000000-0000-4000-8000-000000000002';
    await db.query('insert into auth.users(id) values($1),($2)', [admin, visitor]);
    await db.query('insert into public.admin_roles(user_id) values($1)', [admin]);
    const insert = `insert into articles(source_name,original_url,original_title,title,summary,why_it_matters,kind,status) values('NASA',$1,'Original','标题','中文摘要','研究问题','article',$2) returning id`;
    const pub = (await db.query(insert, ['https://www.nasa.gov/public', 'published'])).rows[0].id;
    await db.query(insert, ['https://www.nasa.gov/pending', 'pending']);
    await db.exec('set role anon');
    assert.equal((await db.query('select id,title from articles')).rows.length, 1);
    await assert.rejects(db.query('select moderation_reason from articles'), /permission denied/);
    await assert.rejects(db.query('select * from article_inputs'), /permission denied/);
    await assert.rejects(db.query('select * from sources'), /permission denied/);
    await assert.rejects(db.query('update articles set featured=true'), /permission denied/);
    await assert.rejects(db.query('select acquire_ingest_lease($1)', [admin]), /permission denied/);
    await db.exec('reset role;set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [visitor]);
    assert.equal((await db.query('select id from articles')).rows.length, 1);
    assert.equal((await db.query('update articles set featured=true returning id')).rows.length, 0);
    await assert.rejects(
      db.query('insert into admin_roles(user_id) values($1)', [visitor]),
      /permission denied/,
    );
    await assert.rejects(
      db.query(insert, ['https://www.nasa.gov/unauthorized', 'pending']),
      /row-level security/,
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
    assert.equal((await db.query('select id from articles')).rows.length, 2);
    assert.equal(
      (await db.query('update articles set featured=true where id=$1 returning id', [pub])).rows
        .length,
      1,
    );
    await assert.rejects(
      db.query(
        "insert into articles(source_name,original_url,original_title,title,kind,status) values('NASA','https://www.nasa.gov/empty','t','t','article','published')",
      ),
      /check constraint/,
    );
    await db.exec('reset role;set role service_role');
    assert.equal(
      (await db.query('select acquire_ingest_lease($1) as ok', [admin])).rows[0].ok,
      true,
    );
    assert.equal(
      (await db.query('select acquire_ingest_lease($1) as ok', [visitor])).rows[0].ok,
      false,
    );
    await db.query('select release_ingest_lease($1)', [visitor]);
    assert.equal(
      (await db.query('select acquire_ingest_lease($1) as ok', [visitor])).rows[0].ok,
      false,
    );
    await db.query('select release_ingest_lease($1)', [admin]);
    assert.equal(
      (await db.query('select acquire_ingest_lease($1) as ok', [visitor])).rows[0].ok,
      true,
    );
    const payload = {
      source_name: 'YouTube',
      original_url: 'https://www.youtube.com/watch?v=6B96xetwrqI',
      original_title: 'Original aircraft video',
      kind: 'video',
      published_at: new Date().toISOString(),
      summary_basis: 'description',
    };
    await assert.rejects(
      db.query('select enqueue_article($1,$2)', [payload, 'x'.repeat(6001)]),
      /check constraint/,
    );
    assert.equal(
      (await db.query('select id from articles where original_url=$1', [payload.original_url])).rows
        .length,
      0,
    );
    const enqueued = (
      await db.query('select enqueue_article($1,$2) as id', [
        payload,
        'A useful aircraft description',
      ])
    ).rows[0].id;
    assert(enqueued);
    assert.equal(
      (await db.query('select raw_text from article_inputs where article_id=$1', [enqueued]))
        .rows[0].raw_text,
      'A useful aircraft description',
    );
    assert.equal(
      (await db.query('select enqueue_article($1,$2) as id', [payload, 'A duplicate'])).rows[0].id,
      null,
    );
    assert.equal(Number((await db.query('select monthly_ai_estimate() as cost')).rows[0].cost), 0);
  } finally {
    await db.close();
  }
});
