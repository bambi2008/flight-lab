import { canonicalUrl, plainText } from './content.mjs';

export const rssHosts = new Set([
  'www.nasa.gov',
  'nasa.gov',
  'www.airbus.com',
  'investors.boeing.com',
  'investors.lockheedmartin.com',
  'www.af.mil',
  'ir.jobyaviation.com',
]);
export function trustedUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    !rssHosts.has(url.hostname) ||
    url.port ||
    url.username ||
    url.password
  )
    throw new Error('该链接不属于已验证的官方来源');
  return url;
}

export async function trustedResponse(
  url,
  { fetcher = fetch, headers = {}, timeout = 12_000 } = {},
) {
  let current = trustedUrl(url);
  const origin = current.origin;
  const signal = AbortSignal.timeout(timeout);
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetcher(current.href, { headers, redirect: 'manual', signal });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      if (!response.ok) throw new Error(`来源返回 HTTP ${response.status}`);
      return response;
    }
    const location = response.headers.get('location');
    if (!location || attempt === 2) throw new Error('来源跳转过多或缺少地址');
    const next = trustedUrl(new URL(location, current).href);
    if (next.origin !== origin) throw new Error('不允许来源跳转到其他站点');
    await response.body?.cancel();
    current = next;
  }
  throw new Error('来源请求失败');
}

export async function boundedText(response, maxBytes = 2_000_000) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let text = '',
    bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new Error('来源内容过大');
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function officialArticleUrl(value) {
  const url = new URL(value);
  // Boeing's official RSS emits http links, while the actual articles use HTTPS.
  if (url.hostname === 'investors.boeing.com' && url.protocol === 'http:' && !url.port)
    url.protocol = 'https:';
  return canonicalUrl(url.href);
}

export function feedTimestamp(value) {
  const text = String(value ?? '').trim();
  const airbus = /^[A-Za-z]{3},\s*(\d{2})\/(\d{2})\/(\d{4})\s*-\s*\d{2}:\d{2}$/.exec(text);
  const day = airbus
    ? `${airbus[3]}-${airbus[1]}-${airbus[2]}`
    : /^\d{4}-\d{2}-\d{2}$/.test(text)
      ? text
      : null;
  if (day) {
    const published = new Date(`${day}T00:00:00Z`).toISOString();
    if (!published.startsWith(day)) throw new Error('来源日期无效');
    return { published_at: published, published_precision: 'date' };
  }
  if (!/(?:[+-]\d{2}:?\d{2}|GMT|UTC|Z)$/i.test(text)) throw new Error('来源缺少可识别的日期或时区');
  return { published_at: new Date(text).toISOString(), published_precision: 'exact' };
}
export function bilibiliSourceUrl(uid, rsshubBase) {
  if (!/^[1-9]\d{0,19}$/.test(uid)) throw new Error('请填写 B站 UP 主的数字 UID');
  if (!rsshubBase) throw new Error('尚未配置 RSSHub 服务；可先手动添加 B站链接');
  const base = new URL(rsshubBase);
  const local =
    base.protocol === 'http:' &&
    ['127.0.0.1', 'localhost'].includes(base.hostname) &&
    base.port === '1200';
  if (
    (!local && (base.protocol !== 'https:' || base.port)) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== '/'
  )
    throw new Error('RSSHub 地址需为 HTTPS 站点根地址，或本机 http://127.0.0.1:1200');
  return new URL(`/bilibili/user/video/${uid}/0`, base).href;
}
async function fetchBilibili(source, { parser, fetcher, rsshubBase, onTransport }) {
  const url = bilibiliSourceUrl(source.locator, rsshubBase);
  let response;
  try {
    response = await fetcher(url, {
      headers: { Accept: 'application/xml' },
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new Error('RSSHub 连接未完成，请检查服务是否运行');
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`RSSHub 返回 HTTP ${response.status}；请检查桥接服务或 B站连接`);
  }
  let xml;
  try {
    xml = parser.parse(await boundedText(response));
  } catch {
    throw new Error('RSSHub 未返回有效订阅');
  }
  const feed = xml.rss?.channel;
  if (
    !feed ||
    ![
      `https://space.bilibili.com/${source.locator}`,
      `https://space.bilibili.com/${source.locator}/`,
    ].includes(feed.link)
  )
    throw new Error('RSSHub 未返回该 UP 主的投稿订阅');
  const items = []
    .concat(feed.item ?? [])
    .slice(0, 30)
    .flatMap((e) => {
      try {
        const link = new URL(e.link);
        if (
          link.protocol !== 'https:' ||
          link.hostname !== 'www.bilibili.com' ||
          link.port ||
          link.username ||
          link.password ||
          !/^\/video\/(?:BV[a-zA-Z0-9]{10}|av\d+)\/?$/.test(link.pathname)
        )
          return [];
        const title = plainText(e.title, 200);
        if (!title) return [];
        return [
          {
            original_title: title,
            original_url: canonicalUrl(link.href),
            raw_text: plainText(e['content:encoded'] || e.description || ''),
            ...feedTimestamp(e.pubDate),
            kind: 'video',
            summary_basis: 'description',
            image_url: null,
          },
        ];
      } catch {
        return [];
      }
    });
  onTransport?.('B站投稿订阅 · RSSHub');
  return items;
}

export function sourceUrl(source) {
  if (source.kind === 'youtube') {
    if (!/^UC[a-zA-Z0-9_-]{22}$/.test(source.locator))
      throw new Error('请填写有效的 YouTube 频道 ID');
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${source.locator}`;
  }
  if (source.kind === 'github') {
    if (!/^[a-z0-9-]{2,40}$/.test(source.locator)) throw new Error('GitHub topic 无效');
    return `https://api.github.com/search/repositories?q=${encodeURIComponent(`topic:${source.locator}`)}&sort=updated&order=desc&per_page=20`;
  }
  if (source.kind === 'rss') {
    const u = new URL(source.locator);
    if (u.protocol !== 'https:' || !rssHosts.has(u.hostname) || u.port || u.username || u.password)
      throw new Error('该 RSS 域名尚未加入可信来源清单');
    return u.href;
  }
  throw new Error('此来源只支持手动添加');
}

// Upload playlists are public metadata; cache by transport and channel, never store keys in URLs.
const youtubeCaches = new WeakMap();
async function youtubeApi(channelId, key, fetcher, signal) {
  let cache = youtubeCaches.get(fetcher);
  if (!cache) {
    cache = { playlists: new Map() };
    youtubeCaches.set(fetcher, cache);
  }
  if (cache.blockedKey === key && cache.blockedUntil > Date.now())
    throw new Error('YouTube API 暂时不可用（稍后自动重试）');
  async function request(resource, params) {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    let response;
    try {
      response = await fetcher(url.href, {
        headers: { Accept: 'application/json', 'X-Goog-Api-Key': key },
        redirect: 'error',
        signal,
      });
    } catch {
      throw new Error('YouTube API 连接未完成');
    }
    if (!response.ok) {
      if ([403, 429].includes(response.status)) {
        cache.blockedKey = key;
        cache.blockedUntil = Date.now() + 15 * 60_000;
      }
      await response.body?.cancel();
      throw new Error(`YouTube API 返回 HTTP ${response.status}`);
    }
    let data;
    try {
      data = JSON.parse(await boundedText(response));
    } catch {
      throw new Error('YouTube API 返回格式异常');
    }
    if (!Array.isArray(data.items)) throw new Error('YouTube API 缺少条目列表');
    return data.items;
  }
  let playlist = cache.playlists.get(channelId);
  if (!playlist || playlist.expires < Date.now()) {
    const channels = await request('channels', { part: 'contentDetails', id: channelId });
    const id = channels.find((c) => c.id === channelId)?.contentDetails?.relatedPlaylists?.uploads;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{10,100}$/.test(id))
      throw new Error('YouTube API 未找到频道上传列表');
    playlist = { id, expires: Date.now() + 6 * 3600_000 };
    if (cache.playlists.size >= 128) cache.playlists.delete(cache.playlists.keys().next().value);
    cache.playlists.set(channelId, playlist);
  }
  const entries = await request('playlistItems', {
    part: 'contentDetails',
    playlistId: playlist.id,
    maxResults: '20',
  });
  const ids = [
    ...new Set(
      entries
        .map((e) => e.contentDetails?.videoId)
        .filter((id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id)),
    ),
  ].slice(0, 20);
  if (!ids.length) return [];
  const videos = await request('videos', { part: 'snippet,status', id: ids.join(',') });
  return videos.flatMap((v) => {
    try {
      if (
        !ids.includes(v.id) ||
        v.snippet?.channelId !== channelId ||
        v.status?.privacyStatus !== 'public'
      )
        return [];
      const title = plainText(v.snippet.title, 200);
      if (!title) return [];
      return [
        {
          original_title: title,
          original_url: `https://www.youtube.com/watch?v=${v.id}`,
          raw_text: plainText(v.snippet.description ?? ''),
          ...feedTimestamp(v.snippet.publishedAt),
          kind: 'video',
          summary_basis: 'description',
          image_url: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
        },
      ];
    } catch {
      return [];
    }
  });
}
async function fetchYoutube(source, { parser, fetcher, youtubeKey, onTransport }) {
  const url = sourceUrl(source); // Validate the channel before making any request.
  const overall = AbortSignal.timeout(12_000);
  let apiError;
  if (youtubeKey) {
    try {
      const items = await youtubeApi(
        source.locator,
        youtubeKey,
        fetcher,
        AbortSignal.any([overall, AbortSignal.timeout(6_000)]),
      );
      onTransport?.('YouTube Data API');
      return items;
    } catch (error) {
      apiError = error.message;
    }
  }
  let rssError;
  // One bounded retry of the actual channel feed; the /xml/ topic can be a static stub.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetcher(url, {
        headers: { 'User-Agent': 'FlightLab/0.1 (aviation discovery)', Accept: 'application/xml' },
        redirect: 'error',
        signal: AbortSignal.any([overall, AbortSignal.timeout(5_000)]),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`YouTube RSS 返回 HTTP ${response.status}`);
      }
      const xml = parser.parse(await boundedText(response));
      if (!xml.feed || xml.feed['yt:channelId'] !== source.locator)
        throw new Error('YouTube 未返回该频道的有效订阅');
      const items = [].concat(xml.feed.entry ?? []).flatMap((e) => {
        try {
          const id = e['yt:videoId'],
            title = plainText(e.title, 200);
          if (!/^[a-zA-Z0-9_-]{11}$/.test(id) || !title) return [];
          return [
            {
              original_title: title,
              original_url: `https://www.youtube.com/watch?v=${id}`,
              raw_text: plainText(e['media:group']?.['media:description'] ?? ''),
              ...feedTimestamp(e.published),
              kind: 'video',
              summary_basis: 'description',
              image_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            },
          ];
        } catch {
          return [];
        }
      });
      onTransport?.(youtubeKey ? `RSS 回退；${apiError}` : 'YouTube RSS（未配置 API Key）');
      return items;
    } catch (error) {
      rssError = /^(YouTube RSS 返回 HTTP \d{3}|YouTube 未返回该频道的有效订阅|来源内容过大)$/.test(
        error.message,
      )
        ? error.message
        : 'YouTube RSS 连接未完成';
      if (overall.aborted) break;
    }
  }
  throw new Error([apiError, rssError].filter(Boolean).join('；'));
}

export async function fetchSource(
  source,
  { parser, fetcher = fetch, githubToken, youtubeKey, rsshubBase, onTransport },
) {
  if (source.kind === 'bilibili')
    return fetchBilibili(source, { parser, fetcher, rsshubBase, onTransport });
  if (source.kind === 'youtube')
    return fetchYoutube(source, { parser, fetcher, youtubeKey, onTransport });
  const url = sourceUrl(source);
  const headers = {
    'User-Agent': 'FlightLab/0.1 (aviation discovery)',
    Accept: source.kind === 'github' ? 'application/vnd.github+json' : 'application/xml, text/xml',
  };
  if (source.kind === 'github' && githubToken) headers.Authorization = `Bearer ${githubToken}`;
  // Official RSS redirects may remain on the same approved HTTPS origin only.
  const response =
    source.kind === 'rss'
      ? await trustedResponse(url, { fetcher, headers })
      : await fetcher(url, {
          headers,
          redirect: 'error',
          signal: AbortSignal.timeout(12_000),
        });
  if (!response.ok) throw new Error(`来源返回 HTTP ${response.status}`);
  const text = await boundedText(response);
  if (source.kind === 'github')
    return (JSON.parse(text).items ?? [])
      .filter((r) => !r.fork && !r.archived && r.description)
      .map((r) => ({
        original_title: plainText(r.full_name, 200),
        original_url: canonicalUrl(r.html_url),
        raw_text: plainText(
          `${r.description}\nTopics: ${(r.topics ?? []).join(', ')}\nLanguage: ${r.language ?? ''}`,
        ),
        published_at: r.updated_at,
        kind: 'project',
        summary_basis: 'excerpt',
        image_url: null,
      }));
  const xml = parser.parse(text);
  const entries = [].concat(xml.rss?.channel?.item ?? []);
  if (!xml.rss?.channel) throw new Error('来源未返回可识别的 RSS，请稍后检查连接');
  return entries.flatMap((e) => {
    try {
      const title = plainText(e.title, 200);
      if (!title || !e.pubDate) return [];
      return [
        {
          original_title: title,
          original_url: officialArticleUrl(e.link),
          raw_text: plainText(e['content:encoded'] || e.description || ''),
          ...feedTimestamp(e.pubDate),
          kind: 'article',
          summary_basis: 'excerpt',
          image_url: null,
        },
      ];
    } catch {
      return [];
    }
  });
}
