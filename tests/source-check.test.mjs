import test from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser } from 'fast-xml-parser';
import { openDatabase } from '../scripts/local/database.mjs';
import { checkStoredSource } from '../supabase/functions/_shared/source-check.mjs';
import { createLocalClient } from '../src/lib/local-client.ts';

test('stored-source diagnostics only read approved saved URLs and preserve content, usage and polling state', async () => {
  const database = await openDatabase();
  const parser = new XMLParser({ ignoreAttributes: false, processEntities: false });
  const source = (await database.pg.query("select * from sources where name='NASA Aeronautics'"))
    .rows[0];
  let calls = 0;
  const fetcher = async (url) => {
    calls++;
    assert.equal(url, source.locator);
    return new Response(
      '<rss><channel><item><title>Wing research</title><link>https://www.nasa.gov/wing</link><pubDate>Thu, 08 Oct 2026 00:00:00 GMT</pubDate><description>Research details</description></item></channel></rss>',
    );
  };
  try {
    const result = await checkStoredSource({
      db: database.client,
      parser,
      sourceId: source.id,
      fetcher,
    });
    assert.equal(result.ok, true);
    assert.equal(result.count, 1);
    assert.equal(result.latest_title, 'Wing research');
    assert.equal(calls, 1);
    assert.deepEqual(
      (await database.pg.query('select * from sources where id=$1', [source.id])).rows[0],
      source,
    );
    for (const table of ['articles', 'ai_usage', 'ingest_runs'])
      assert.equal(
        Number((await database.pg.query(`select count(*) from ${table}`)).rows[0].count),
        0,
      );
    const failed = await checkStoredSource({
      db: database.client,
      parser,
      sourceId: source.id,
      fetcher: async () => new Response('', { status: 404 }),
    });
    assert.equal(failed.ok, false);
    assert.match(failed.message, /404/);
    const empty = await checkStoredSource({
      db: database.client,
      parser,
      sourceId: source.id,
      fetcher: async () => new Response('<html>Not a feed</html>'),
    });
    assert.equal(empty.ok, false);
    assert.match(empty.message, /未读到条目/);
    await assert.rejects(
      checkStoredSource({
        db: database.client,
        parser,
        sourceId: 'https://127.0.0.1/private',
        fetcher,
      }),
      /ID/,
    );
    await assert.rejects(
      checkStoredSource({
        db: database.client,
        parser,
        sourceId: '00000000-0000-4000-8000-000000000099',
        fetcher,
      }),
      /不存在/,
    );
    assert.equal(calls, 1);
    assert.deepEqual(
      (await database.pg.query('select * from sources where id=$1', [source.id])).rows[0],
      source,
    );
  } finally {
    await database.pg.close();
  }
});

test('local function adapter forwards diagnostic actions and rejects unknown function names', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ data: { ok: true }, error: null });
  };
  try {
    const client = createLocalClient();
    const body = { action: 'check_source', source_id: '00000000-0000-4000-8000-000000000099' };
    await client.functions.invoke('ingest', { body });
    assert.equal(calls[0].url, '/api/local/ingest');
    assert.deepEqual(JSON.parse(calls[0].options.body), body);
    assert.equal(calls[0].options.credentials, 'same-origin');
    assert((await client.functions.invoke('unknown')).error);
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = original;
  }
});
