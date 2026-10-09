import test from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser } from 'fast-xml-parser';
import {
  trustedResponse,
  boundedText,
  feedTimestamp,
  fetchSource,
} from '../supabase/functions/_shared/sources.mjs';
import { sourceIsDue, pollIntervalMinutes } from '../supabase/functions/_shared/polling.mjs';
import { extractOfficialExcerpt, enrichExcerpt } from '../supabase/functions/_shared/excerpt.mjs';
import { publicationLatency } from '../src/lib/latency.ts';

test('RSS follows only bounded same-origin HTTPS redirects', async () => {
  let calls = 0;
  const response = await trustedResponse('https://www.airbus.com/en/feed', {
    fetcher: async (_url, options) => {
      assert.equal(options.redirect, 'manual');
      return ++calls === 1
        ? new Response(null, { status: 302, headers: { location: '/en/rss-all-feeds/15571' } })
        : new Response('ok');
    },
  });
  assert.equal(await response.text(), 'ok');
  for (const location of [
    'http://www.airbus.com/feed',
    'https://127.0.0.1/feed',
    'https://www.nasa.gov/feed',
    'https://www.airbus.com:1234/feed',
    'https://secret@www.airbus.com/feed',
  ]) {
    let requests = 0;
    await assert.rejects(
      trustedResponse('https://www.airbus.com/feed', {
        fetcher: async () => {
          requests++;
          return new Response(null, { status: 302, headers: { location } });
        },
      }),
    );
    assert.equal(requests, 1);
  }
  await assert.rejects(
    trustedResponse('https://www.airbus.com/feed', {
      fetcher: async () => new Response(null, { status: 302, headers: { location: '/loop' } }),
    }),
    /跳转过多/,
  );
});
test('response size is bounded while streaming', async () => {
  await assert.rejects(boundedText(new Response('x'.repeat(101)), 100), /过大/);
});
test('nonstandard Airbus dates retain day precision without inventing a timezone', () => {
  assert.deepEqual(feedTimestamp('Thu, 10/08/2026 - 09:39'), {
    published_at: '2026-10-08T00:00:00.000Z',
    published_precision: 'date',
  });
  assert.equal(
    feedTimestamp('Mon, 05 Oct 2026 14:00:00 -0400').published_at,
    '2026-10-05T18:00:00.000Z',
  );
  assert.throws(() => feedTimestamp('Tue, 02/31/2026 - 10:00'));
  assert.throws(() => feedTimestamp('2026-10-08T09:39:00'));
});
test('malformed RSS entries do not suppress valid items and Boeing links become HTTPS', async () => {
  const items = await fetchSource(
    { kind: 'rss', locator: 'https://investors.boeing.com/rss/pressrelease.aspx' },
    {
      parser: new XMLParser({ ignoreAttributes: false, processEntities: false }),
      fetcher: async () =>
        new Response(
          '<rss><channel><item><title>Invalid</title><link>bad</link><pubDate>bad</pubDate></item><item><title>F/A-XX</title><link>http://investors.boeing.com/release</link><pubDate>Tue, 29 Sep 2026 14:00:00 -0400</pubDate></item></channel></rss>',
        ),
    },
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].original_url, 'https://investors.boeing.com/release');
});
test('official excerpt excludes navigation, footer and executable content', async () => {
  const html =
    '<nav>Menus</nav><div class="evergreen-news-body"><p>Aircraft engineering.</p><div>Flight testing.</div><script>bad()</script></div><footer>Investor Sections</footer>';
  assert.equal(
    extractOfficialExcerpt(html, 'investors.boeing.com'),
    'Aircraft engineering. Flight testing.',
  );
  const airbus =
    '<article class="awx-node-push"><p>Navigation teaser</p></article><article class="node node--press-release view-mode-full"><nav>Breadcrumbs</nav><div class="text-content awx-belly--narrow rte"><p>Actual aircraft research.</p><div>Flight test details.</div><script>bad()</script></div><aside>Related stories</aside></article><footer>Footer</footer>';
  assert.equal(
    extractOfficialExcerpt(airbus, 'www.airbus.com'),
    'Actual aircraft research. Flight test details.',
  );
  assert.equal(
    extractOfficialExcerpt(
      '<article class="awx-node-push">Only a teaser</article>',
      'www.airbus.com',
    ),
    '',
  );
  let called = false;
  await assert.rejects(
    enrichExcerpt(
      { kind: 'article', raw_text: '', original_url: 'https://127.0.0.1/private' },
      async () => {
        called = true;
      },
    ),
  );
  assert.equal(called, false);
});
test('Airbus web stories read only the full-view section, including nested sections', async () => {
  const story =
    '<article class="awx-node-push"><div class="text-content rte">Navigation teaser.</div></article><section class="node node--web-story view-mode-full"><section><div>Hero artwork</div></section><div class="text-content awx-belly--narrow rte"><p>A350F flight control law testing.</p><div>MSN700 flight test telemetry.</div></div><section><article>Related articles.</article></section></section><footer>Footer.</footer>';
  assert.equal(
    extractOfficialExcerpt(story, 'www.airbus.com'),
    'A350F flight control law testing. MSN700 flight test telemetry.',
  );
  assert.equal(
    extractOfficialExcerpt(
      '<section class="node--web-story"><div class="text-content rte">Unverified section</div></section>',
      'www.airbus.com',
    ),
    '',
  );
  assert.equal(
    extractOfficialExcerpt(
      '<section class="view-mode-full"><article>Related articles only.</article></section>',
      'www.airbus.com',
    ),
    '',
  );
  const excerpt = await enrichExcerpt(
    {
      kind: 'article',
      raw_text: '',
      original_url: 'https://www.airbus.com/en/newsroom/stories/test',
    },
    async () => new Response(story, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  );
  assert.equal(excerpt, 'A350F flight control law testing. MSN700 flight test telemetry.');
});
test('frequent polling keeps slow feeds throttled and manual sources untouched', () => {
  const now = Date.parse('2026-10-08T10:00:00Z');
  const source = { enabled: true, kind: 'rss', last_fetched_at: '2026-10-08T09:50:00Z' };
  assert(sourceIsDue(source, now));
  assert(!sourceIsDue({ ...source, last_fetched_at: '2026-10-08T09:59:00Z' }, now));
  assert(!sourceIsDue({ ...source, enabled: false }, now));
  assert(!sourceIsDue({ ...source, kind: 'manual' }, now));
  assert.equal(pollIntervalMinutes({ kind: 'youtube' }), 30);
  assert.equal(pollIntervalMinutes({ kind: 'github' }), 360);
});
test('military official excerpts read source-specific story containers and enrich short introductions', async () => {
  const airForce =
    '<nav>Site navigation</nav><article class="article-detail"><h1>Title</h1><section class="article-detail-content"><p>B-21 remains in flight test.</p><div>Production capacity expansion is planned.</div><script>bad()</script></section><footer>Related news</footer></article>';
  const lockheed =
    '<nav>Investor menu</nav><article class="teaser">Wrong teaser</article><article class="node node--type-nir-news node--view-mode-full"><p>Aircraft prototype research.</p><div>Published manufacturer claims.</div></article><footer>Investor footer</footer>';
  assert.equal(
    extractOfficialExcerpt(airForce, 'www.af.mil'),
    'B-21 remains in flight test. Production capacity expansion is planned.',
  );
  assert.equal(
    extractOfficialExcerpt(lockheed, 'investors.lockheedmartin.com'),
    'Aircraft prototype research. Published manufacturer claims.',
  );
  assert.equal(extractOfficialExcerpt('<article>Unrecognized layout</article>', 'www.af.mil'), '');
  const item = {
    kind: 'article',
    original_url: 'https://www.af.mil/News/Article-Display/Article/123/test/',
    raw_text: 'Intro '.repeat(60),
  };
  const body = airForce.replace(
    'B-21 remains in flight test.',
    'B-21 remains in flight test. '.repeat(30),
  );
  let calls = 0;
  const enriched = await enrichExcerpt(item, async () => {
    calls++;
    return new Response(body, { headers: { 'Content-Type': 'text/html' } });
  });
  assert(enriched.length > item.raw_text.length);
  assert.equal(calls, 1);
  const fallback = await enrichExcerpt(
    item,
    async () => new Response('<nav>No story</nav>', { headers: { 'Content-Type': 'text/html' } }),
  );
  assert.equal(fallback, item.raw_text);
  await enrichExcerpt({ ...item, raw_text: 'x'.repeat(1600) }, async () => {
    throw Error('must not download complete content');
  });
});

test('new official feeds parse timezone-aware dates while rejecting non-feed responses', async () => {
  const parser = new XMLParser({ ignoreAttributes: false, processEntities: false });
  for (const [host, locator] of [
    ['www.af.mil', 'https://www.af.mil/DesktopModules/ArticleCS/RSS.ashx?max=20'],
    ['investors.lockheedmartin.com', 'https://investors.lockheedmartin.com/rss/news-releases.xml'],
  ]) {
    const source = { kind: 'rss', locator };
    const items = await fetchSource(source, {
      parser,
      fetcher: async () =>
        new Response(
          `<rss><channel><item><title>B-21 research</title><link>https://${host}/news/story</link><pubDate>Thu, 08 Oct 2026 13:00:00 GMT</pubDate><description>Public aircraft research.</description></item></channel></rss>`,
        ),
    });
    assert.equal(items.length, 1);
    assert.equal(items[0].published_precision, 'exact');
    assert.equal(items[0].published_at, '2026-10-08T13:00:00.000Z');
    await assert.rejects(
      fetchSource(source, {
        parser,
        fetcher: async () => new Response('<html>Access check</html>'),
      }),
      /可识别的 RSS/,
    );
  }
});
test('oversized official bodies stop at a complete sentence instead of a clipped claim', () => {
  const complete = 'Tested airflow. '.repeat(371);
  const incomplete = 'A further unverified claim '.repeat(20);
  const text = extractOfficialExcerpt(
    `<article>${complete}${incomplete}</article>`,
    'www.nasa.gov',
  );
  assert.equal(text, complete.trim());
  assert(text.length <= 6000);
  assert(!text.includes('unverified'));
});
test('Joby feeds preserve two-digit year and timezone; article scope excludes unrelated aircraft teasers', async () => {
  const source = {
    kind: 'rss',
    locator: 'https://ir.jobyaviation.com/news-events/press-releases/rss',
  };
  const fixture =
    '<rss><channel><item><title>Joby Launches eIPP Flights in Texas</title><link>https://ir.jobyaviation.com/news-events/press-releases/detail/191/joby-launches-eipp-flights-in-texas</link><pubDate>Thu, 10 Sep 26 12:02:00 -0400</pubDate><description></description></item></channel></rss>';
  const [item] = await fetchSource(source, {
    parser: new XMLParser(),
    fetcher: async () => new Response(fixture),
  });
  assert.equal(item.published_at, '2026-09-10T16:02:00.000Z');
  assert.equal(item.published_precision, 'exact');
  assert.equal(item.raw_text, '');
  const html =
    '<nav>Autonomous J208 cross-country tour</nav><article class="full-news-article"><h1>Joby electric air taxi</h1><div><p>Airspace integration testing at DFW.</p></div></article><article>Blade jet service</article>';
  assert.equal(
    extractOfficialExcerpt(html, 'ir.jobyaviation.com'),
    'Joby electric air taxi Airspace integration testing at DFW.',
  );
  assert.equal(
    extractOfficialExcerpt('<article>Related aircraft only</article>', 'ir.jobyaviation.com'),
    '',
  );
  const enriched = await enrichExcerpt(
    item,
    async () => new Response(html, { headers: { 'Content-Type': 'text/html' } }),
  );
  assert.equal(enriched, 'Joby electric air taxi Airspace integration testing at DFW.');
  await assert.rejects(trustedResponse('https://ir.jobyaviation.com.example.org/feed'));
});

test('latency excludes manual, unknown-clock and inconsistent timestamps', () => {
  const now = Date.parse('2026-10-08T10:00:00Z');
  const item = {
    source_id: 'source',
    status: 'published',
    process_state: 'complete',
    published_precision: 'exact',
    published_at: '2026-10-08T09:00:00Z',
    created_at: '2026-10-08T09:10:00Z',
    processed_at: '2026-10-08T09:15:00Z',
  };
  const items = [
    item,
    { ...item, processed_at: '2026-10-08T09:30:00Z' },
    { ...item, source_id: null },
    { ...item, summary_basis: 'manual' },
    { ...item, published_precision: 'date' },
    { ...item, created_at: 'bad' },
    { ...item, processed_at: '2026-10-08T08:00:00Z' },
  ];
  assert.deepEqual(publicationLatency(items, now), { count: 2, p50: 15, p95: 30 });
  assert.deepEqual(publicationLatency([], now), { count: 0, p50: null, p95: null });
});
