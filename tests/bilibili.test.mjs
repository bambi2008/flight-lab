import test from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser } from 'fast-xml-parser';
import { bilibiliSourceUrl, fetchSource } from '../supabase/functions/_shared/sources.mjs';
import { pollIntervalMinutes } from '../supabase/functions/_shared/polling.mjs';
import { openDatabase } from '../scripts/local/database.mjs';
const parser = new XMLParser({ ignoreAttributes: false, processEntities: false });
const source = { kind: 'bilibili', locator: '525644756' };
test('Bilibili UID is not a URL and bridge address comes only from server configuration', () => {
  for (const uid of ['../admin', '0', '123?url=http://169.254.169.254', 'https://evil.test'])
    assert.throws(() => bilibiliSourceUrl(uid, 'https://bridge.example'));
  for (const base of [
    'http://169.254.169.254',
    'http://127.0.0.1:5174',
    'https://secret@bridge.example',
    'https://bridge.example?url=x',
    'https://bridge.example/other',
  ])
    assert.throws(() => bilibiliSourceUrl(source.locator, base));
  assert.throws(() => bilibiliSourceUrl(source.locator, ''), /尚未配置/);
  assert.equal(
    bilibiliSourceUrl(source.locator, 'http://127.0.0.1:1200'),
    'http://127.0.0.1:1200/bilibili/user/video/525644756/0',
  );
  assert.equal(pollIntervalMinutes(source), 60);
});
test('Bilibili bridge requires the saved UP identity and public video links, never follows redirects', async () => {
  const feed = `<rss><channel><link>https://space.bilibili.com/525644756</link><item><title>Wing research</title><link>https://www.bilibili.com/video/BV15P4zeZE7o/</link><pubDate>Thu, 08 Oct 2026 00:00:00 GMT</pubDate><description>&lt;p&gt;Aircraft design&lt;/p&gt;</description></item><item><title>Bad</title><link>https://www.bilibili.com.evil.test/video/BV15P4zeZE7o</link><pubDate>Thu, 08 Oct 2026 00:00:00 GMT</pubDate></item></channel></rss>`;
  const options = {
    parser,
    rsshubBase: 'http://127.0.0.1:1200',
    youtubeKey: 'secret-key',
    githubToken: 'secret-token',
    fetcher: async (url, opts) => {
      assert.equal(url, bilibiliSourceUrl(source.locator, options.rsshubBase));
      assert.equal(opts.redirect, 'error');
      assert(!opts.headers.Authorization);
      assert(!opts.headers['X-Goog-Api-Key']);
      return new Response(feed);
    },
  };
  const items = await fetchSource(source, options);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'video');
  assert.equal(items[0].summary_basis, 'description');
  assert.equal(items[0].raw_text, 'Aircraft design');
  await assert.rejects(
    fetchSource(source, {
      ...options,
      fetcher: async () =>
        new Response(feed.replace('space.bilibili.com/525644756', 'space.bilibili.com/123')),
    }),
    /该 UP 主/,
  );
  await assert.rejects(
    fetchSource(source, {
      ...options,
      fetcher: async () => new Response('<html>challenge</html>'),
    }),
    /投稿订阅/,
  );
  await assert.rejects(
    fetchSource(source, {
      ...options,
      fetcher: async () => new Response('private-cookie', { status: 403 }),
    }),
    (e) => e.message.includes('403') && !e.message.includes('private-cookie'),
  );
});
test('Bilibili migration seeds a disabled trial, rejects malformed UID and keeps source admin permissions', async () => {
  const db = await openDatabase();
  try {
    const saved = (await db.pg.query("select * from sources where kind='bilibili'")).rows;
    assert.equal(saved.length, 1);
    assert.equal(saved[0].enabled, false);
    const invalid = await db.execute({
      table: 'sources',
      operation: 'insert',
      values: { name: 'bad', kind: 'bilibili', locator: '../invalid' },
    });
    assert(invalid.error);
    const anon = await db.execute({ table: 'sources', operation: 'select', fields: '*' }, 'anon');
    assert(anon.error);
  } finally {
    await db.pg.close();
  }
});
