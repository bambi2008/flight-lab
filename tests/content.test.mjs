import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalUrl,
  plainText,
  simhash,
  hamming,
  nearDuplicate,
  validateAnalysis,
  publicationStatus,
} from '../supabase/functions/_shared/content.mjs';
import { sourceUrl, fetchSource } from '../supabase/functions/_shared/sources.mjs';
import { analyze } from '../supabase/functions/_shared/deepseek.mjs';
import { XMLParser } from 'fast-xml-parser';

const good = {
  title: '机翼设计',
  summary: '这项研究讨论机翼参数。',
  why_it_matters: '观察参数怎样改变气流。',
  category: '飞机设计',
  tags: ['机翼'],
  quality_score: 8,
  relevance: 0.9,
  confidence: 0.95,
  moderation: 'safe',
  moderation_reason: '',
};
test('deduplication keeps content identity while removing tracking', () => {
  assert.equal(
    canonicalUrl('https://youtu.be/6B96xetwrqI?si=tracking'),
    canonicalUrl('https://www.youtube.com/watch?v=6B96xetwrqI&list=playlist'),
  );
  assert.equal(
    canonicalUrl('https://example.org/path?utm_source=x&id=5#section'),
    'https://example.org/path?id=5',
  );
  assert.throws(() => canonicalUrl('javascript:alert(1)'));
  assert.throws(() => canonicalUrl('https://password:secret@example.org/'));
});
test('title similarity handles punctuation without merging unrelated engineering stories', () => {
  const title = 'Understanding Aircraft Wing Design and Aerodynamics';
  assert.equal(hamming(simhash(title), simhash(title + '!')), 0);
  assert(
    nearDuplicate(title, simhash(title), [
      { original_title: title + '!', title_simhash: simhash(title + '!') },
    ]),
  );
  assert(
    !nearDuplicate('Flight Simulation with JSBSim', simhash('Flight Simulation with JSBSim'), [
      { original_title: title, title_simhash: simhash(title) },
    ]),
  );
  assert.equal(simhash('翼型'), null);
});
test('safe, sufficient analysis can publish; uncertainty stays pending and rejection stays rejected', () => {
  assert.equal(publicationStatus(validateAnalysis(good), 200), 'published');
  for (const patch of [
    { moderation: 'review' },
    { confidence: 0.4 },
    { quality_score: 3 },
    { relevance: 0.1 },
  ])
    assert.equal(publicationStatus(validateAnalysis({ ...good, ...patch }), 200), 'pending');
  assert.equal(publicationStatus(good, 20), 'pending');
  assert.equal(publicationStatus({ ...good, moderation: 'reject' }, 200), 'rejected');
});
test('missing, invalid, or coerced safety scores never pass validation', () => {
  for (const patch of [
    { moderation: undefined },
    { confidence: '1' },
    { quality_score: 11 },
    { tags: 'tag' },
    { category: 'other' },
    { summary: '' },
    { relevance: NaN },
  ])
    assert.throws(() => validateAnalysis({ ...good, ...patch }));
});
test('source requests cannot target local networks or arbitrary hosts', () => {
  for (const locator of [
    'http://127.0.0.1/feed',
    'https://169.254.169.254/feed',
    'https://nasa.gov.evil.test/feed',
    'https://www.nasa.gov:1234/feed',
  ])
    assert.throws(() => sourceUrl({ kind: 'rss', locator }));
  assert.throws(() => sourceUrl({ kind: 'youtube', locator: 'bad&id=x' }));
  assert.throws(() => sourceUrl({ kind: 'github', locator: 'aerodynamics&sort=stars' }));
  assert.equal(
    sourceUrl({ kind: 'rss', locator: 'https://www.nasa.gov/aeronautics/feed/' }),
    'https://www.nasa.gov/aeronautics/feed/',
  );
});
test('a single-item RSS feed parses and strips markup safely', async () => {
  const xml =
    '<rss><channel><item><title>Wing research</title><link>https://www.nasa.gov/wing</link><pubDate>Thu, 08 Oct 2026 00:00:00 GMT</pubDate><description>&lt;p&gt;A test&lt;/p&gt;</description></item></channel></rss>';
  const items = await fetchSource(
    { kind: 'rss', locator: 'https://www.nasa.gov/aeronautics/feed/' },
    {
      parser: new XMLParser({ ignoreAttributes: false }),
      fetcher: async (_url, options) => {
        assert.equal(options.redirect, 'manual');
        return new Response(xml);
      },
    },
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].raw_text, 'A test');
  assert.equal(plainText('<script>bad()</script><p>good</p>'), 'good');
});
test('paid malformed model responses still log usage and remain failures', async () => {
  const logs = [];
  await assert.rejects(() =>
    analyze(
      { original_title: 'test', raw_text: 'test' },
      { key: 'test-key', rates: { input: 0.3, output: 1.2 } },
      async (x) => logs.push(x),
      async () =>
        Response.json({
          usage: { prompt_tokens: 1000, completion_tokens: 100 },
          choices: [{ message: { content: '{}' }, finish_reason: 'stop' }],
        }),
    ),
  );
  assert.equal(logs.length, 1);
  assert.equal(logs[0].prompt_tokens, 1000);
  assert.equal(logs[0].estimated_usd, 0.00042);
});
test('retryable HTTP failures are bounded; successful calls validate structured output', async () => {
  const logs = [];
  let calls = 0;
  const result = await analyze(
    { original_title: 'test', raw_text: 'test' },
    { key: 'test-key', rates: { input: 0.3, output: 1.2 } },
    async (x) => logs.push(x),
    async () => {
      calls++;
      return calls === 1
        ? new Response('', { status: 503 })
        : Response.json({
            usage: { prompt_tokens: 30, completion_tokens: 100 },
            choices: [{ message: { content: JSON.stringify(good) }, finish_reason: 'stop' }],
          });
    },
  );
  assert.equal(calls, 2);
  assert.equal(result.title, '机翼设计');
  assert.equal(logs[0].usage_known, false);
  assert.equal(logs[1].status, 'success');
});
test('missing keys do not make requests', async () => {
  let called = false;
  await assert.rejects(() =>
    analyze(
      {},
      { rates: { input: 0, output: 0 } },
      async () => {},
      async () => {
        called = true;
      },
    ),
  );
  assert.equal(called, false);
});
