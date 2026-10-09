import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { openDatabase } from '../scripts/local/database.mjs';
import { createLocalServer } from '../scripts/local/server.mjs';

test('local HTTP service enforces browser boundaries and RLS, runs ingestion, publishes and preserves edits across restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flightlab-test-'));
  let database = await openDatabase(directory);
  const app = createLocalServer(database, async () => ({ key: '', batchSize: 2 }));
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const call = (path, body, cookie = '', extra = {}) =>
    fetch(base + '/api/local/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Origin: base, 'Content-Type': 'application/json', Cookie: cookie, ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const query = { table: 'articles', operation: 'select', fields: 'id,title,summary,status' };
  const originalFetch = globalThis.fetch;
  try {
    assert.equal((await call('login', {}, '', { Origin: 'https://attacker.example' })).status, 403);
    const badHostStatus = await new Promise((resolve, reject) => {
      const req = httpRequest(
        base + '/api/local/auth',
        { headers: { Host: 'attacker.example' } },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on('error', reject);
      req.end();
    });
    assert.equal(badHostStatus, 403);
    assert.equal(
      (await call('query', { ...query, operation: 'update', values: { featured: true } })).status,
      401,
    );
    assert.equal((await call('query', { ...query, fields: 'moderation_reason' })).status, 400);
    const login = await call('login', {});
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal(
      (
        await call('ingest', {
          action: 'check_source',
          source_id: '00000000-0000-4000-8000-000000000099',
        })
      ).status,
      401,
    );
    assert.equal((await call('ingest', { action: 'unsupported' }, cookie)).status, 400);
    assert((await (await call('auth', undefined, cookie)).json()).data.user);
    assert.equal(
      (await call('query', { ...query, table: 'articles;drop table articles' }, cookie)).status,
      400,
    );
    assert.equal(
      (
        await call(
          'query',
          {
            rpc: 'acquire_ingest_lease',
            args: { lease_owner: '00000000-0000-4000-8000-000000000001' },
          },
          cookie,
        )
      ).status,
      400,
    );
    await database.pg.exec(
      "update sources set enabled=false; update sources set enabled=true where name='NASA Aeronautics';",
    );
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith(base)) return originalFetch(url, init);
      return new Response(
        '<rss><channel><item><title>Local pipeline fixture aircraft</title><link>https://www.nasa.gov/local-test-fixture</link><pubDate>Thu, 08 Oct 2026 14:00:00 GMT</pubDate><description>Aircraft engineering description for an isolated local pipeline test.</description></item></channel></rss>',
      );
    };
    const source = (await database.pg.query("select * from sources where name='NASA Aeronautics'"))
      .rows[0];
    const diagnostic = await (
      await call('ingest', { action: 'check_source', source_id: source.id }, cookie)
    ).json();
    assert.equal(diagnostic.data.ok, true);
    assert.equal(diagnostic.data.count, 1);
    assert.deepEqual(
      (await database.pg.query('select * from sources where id=$1', [source.id])).rows[0],
      source,
    );
    assert.equal(
      Number((await database.pg.query('select count(*) from articles')).rows[0].count),
      0,
    );
    const ingestion = await (await call('ingest', {}, cookie)).json();
    assert.equal(ingestion.error, null);
    assert.equal(ingestion.data.inserted, 1);
    assert.equal(ingestion.data.model_configured, false);
    assert.equal(ingestion.data.published, 0);
    const adminRows = (await (await call('query', { ...query, fields: '*' }, cookie)).json()).data;
    assert.equal(adminRows.length, 1);
    assert.equal(adminRows[0].process_state, 'queued');
    assert.equal((await (await call('query', query)).json()).data.length, 0);
    const id = adminRows[0].id;
    const update = {
      ...query,
      operation: 'update',
      filters: [{ column: 'id', op: 'eq', value: id }],
      returning: true,
    };
    assert.equal(
      (await call('query', { ...update, values: { status: 'published' } }, cookie)).status,
      400,
    );
    const published = await call(
      'query',
      {
        ...update,
        values: {
          summary: "Test's saved summary",
          why_it_matters: 'Test engineering question',
          status: 'published',
          process_state: 'complete',
        },
      },
      cookie,
    );
    assert.equal(published.status, 200);
    assert.equal((await (await call('query', query)).json()).data.length, 1);
    const weekly = (await (await call('query', { rpc: 'weekly_ingest_summary' }, cookie)).json())
      .data;
    assert.equal(weekly.runs, 1);
    await call('logout', {}, cookie);
    assert.equal((await (await call('auth', undefined, cookie)).json()).data.user, null);
    assert.equal((await call('ingest', {}, cookie)).status, 401);
    await database.pg.close();
    database = await openDatabase(directory);
    assert.equal(
      (await database.pg.query('select summary from articles where id=$1', [id])).rows[0].summary,
      "Test's saved summary",
    );
    assert.equal(
      (await database.pg.query('select count(*) from sources where enabled')).rows[0].count,
      1,
    );
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise((resolve) => {
      app.server.close(resolve);
      app.server.closeIdleConnections();
    });
    await database.pg.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('isolated local pipeline logs model usage and separates publish, review and rejection', async () => {
  const database = await openDatabase();
  const originalFetch = globalThis.fetch;
  try {
    await database.pg.exec('update sources set enabled=false');
    for (const disposition of ['safe', 'review', 'reject']) {
      const result = await database.client.rpc('enqueue_article', {
        article_payload: {
          source_name: 'Isolated test',
          original_url: `https://example.org/${disposition}`,
          original_title: disposition,
          kind: 'article',
          published_at: new Date().toISOString(),
          published_precision: 'exact',
          summary_basis: 'excerpt',
        },
        input_text:
          'An isolated aircraft engineering test describes wing research and design. '.repeat(6),
      });
      assert.equal(result.error, null);
    }
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.deepseek.com/chat/completions');
      const disposition = JSON.parse(JSON.parse(options.body).messages[1].content).title;
      const analysis = {
        title: '隔离测试的机翼研究',
        summary: '测试用中文摘要。',
        why_it_matters: '观察机翼设计变量。',
        category: '飞机设计',
        tags: ['测试'],
        quality_score: 8,
        relevance: 0.9,
        confidence: 0.95,
        moderation: disposition,
        moderation_reason: disposition === 'safe' ? '' : '隔离测试审核理由',
      };
      return Response.json({
        choices: [{ message: { content: JSON.stringify(analysis) }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      });
    };
    const app = createLocalServer(database, async () => ({
      key: 'isolated-test-key',
      batchSize: 12,
      rates: { input: 0.3, output: 1.2 },
    }));
    const result = await app.collect();
    assert.equal(result.processed, 3);
    assert.equal(result.published, 1);
    assert.equal(result.pending, 1);
    assert.equal(result.rejected, 1);
    assert.equal(result.prompt_tokens, 300);
    assert.equal(result.failed, 0);
    assert.equal((await database.pg.query('select count(*) from ai_usage')).rows[0].count, 3);
    assert.equal(
      (await database.pg.query("select count(*) from articles where process_state='complete'"))
        .rows[0].count,
      3,
    );
    const publicRows = await database.execute(
      { table: 'articles', operation: 'select', fields: 'id,title' },
      'anon',
    );
    assert.equal(publicRows.data.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    await database.pg.close();
  }
});
