import test from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser } from 'fast-xml-parser';
import { fetchSource } from '../supabase/functions/_shared/sources.mjs';
const channel = 'UCR1IuLEqb6UEA_zQ81kwXfg';
const source = { kind: 'youtube', locator: channel };
const parser = new XMLParser({ ignoreAttributes: false, processEntities: false });
const feed = `<feed><yt:channelId>${channel}</yt:channelId><entry><yt:videoId>abcdefghijk</yt:videoId><title>Wing design</title><published>2026-10-08T10:00:00Z</published><media:group><media:description>Aircraft engineering</media:description></media:group></entry></feed>`;
test('YouTube API uses uploads cache, public videos and video publication clocks; credentials stay off URLs', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    const u = new URL(url);
    calls.push(u.pathname);
    assert.equal(u.origin, 'https://www.googleapis.com');
    assert(!u.searchParams.has('key'));
    assert.equal(options.headers['X-Goog-Api-Key'], 'private-key');
    assert.equal(options.redirect, 'error');
    if (u.pathname.endsWith('/channels'))
      return Response.json({
        items: [
          { id: channel, contentDetails: { relatedPlaylists: { uploads: 'UUactualPlaylist' } } },
        ],
      });
    if (u.pathname.endsWith('/playlistItems')) {
      assert.equal(u.searchParams.get('playlistId'), 'UUactualPlaylist');
      return Response.json({
        items: [
          {
            contentDetails: { videoId: 'abcdefghijk' },
            snippet: { publishedAt: '2026-10-09T00:00:00Z' },
          },
        ],
      });
    }
    return Response.json({
      items: [
        {
          id: 'abcdefghijk',
          snippet: {
            channelId: channel,
            title: 'Wing design',
            description: 'A description',
            publishedAt: '2026-10-08T10:00:00Z',
          },
          status: { privacyStatus: 'public' },
        },
        {
          id: 'private0000',
          snippet: { channelId: channel },
          status: { privacyStatus: 'private' },
        },
      ],
    });
  };
  const messages = [];
  const options = {
    parser,
    fetcher,
    youtubeKey: 'private-key',
    onTransport: (x) => messages.push(x),
  };
  const first = await fetchSource(source, options);
  await fetchSource(source, options);
  assert.equal(first.length, 1);
  assert.equal(first[0].published_at, '2026-10-08T10:00:00.000Z');
  assert.equal(first[0].summary_basis, 'description');
  assert.equal(first[0].original_url, 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(calls.length, 5);
  assert.equal(calls.filter((x) => x.endsWith('/channels')).length, 1);
  assert.deepEqual(messages, ['YouTube Data API', 'YouTube Data API']);
});
test('YouTube API quota errors fall back without leaking response content and cool down repeated API calls', async () => {
  let apiCalls = 0;
  const messages = [];
  const fetcher = async (url) => {
    if (url.includes('googleapis.com')) {
      apiCalls++;
      return new Response('private-key sensitive error', { status: 403 });
    }
    return new Response(feed);
  };
  const options = {
    parser,
    fetcher,
    youtubeKey: 'private-key',
    onTransport: (x) => messages.push(x),
  };
  assert.equal((await fetchSource(source, options)).length, 1);
  assert.equal((await fetchSource(source, options)).length, 1);
  assert.equal(apiCalls, 1);
  assert.match(messages[0], /RSS 回退.*403/);
  assert(!messages.join().includes('private-key'));
});
test('YouTube RSS validates channel and entries, tries only two official endpoints and rejects HTML', async () => {
  const urls = [];
  const items = await fetchSource(source, {
    parser,
    fetcher: async (url) => {
      urls.push(url);
      return urls.length === 1 ? new Response('', { status: 404 }) : new Response(feed);
    },
  });
  assert.equal(items.length, 1);
  assert.equal(urls.length, 2);
  assert.equal(urls[0], urls[1]);
  assert.match(urls[0], /\/feeds\/videos.xml/);
  let calls = 0;
  await assert.rejects(
    fetchSource(source, {
      parser,
      fetcher: async () => {
        calls++;
        return new Response('<html>Not a feed</html>');
      },
    }),
    /有效订阅/,
  );
  assert.equal(calls, 2);
  await assert.rejects(
    fetchSource(source, {
      parser,
      fetcher: async () => new Response(feed.replace(channel, 'UCwrongChannel00000000000')),
    }),
    /有效订阅/,
  );
  let called = false;
  await assert.rejects(
    fetchSource(
      { ...source, locator: 'bad' },
      {
        parser,
        youtubeKey: 'private-key',
        fetcher: async () => {
          called = true;
        },
      },
    ),
    /频道 ID/,
  );
  assert.equal(called, false);
});
test('YouTube connection failures redact key-bearing transport exceptions', async () => {
  await assert.rejects(
    fetchSource(source, {
      parser,
      youtubeKey: 'private-key',
      fetcher: async () => {
        throw new Error('private-key');
      },
    }),
    (error) => !error.message.includes('private-key'),
  );
});
