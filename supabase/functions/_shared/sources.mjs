import { canonicalUrl, plainText } from './content.mjs';

export const rssHosts = new Set([
  'www.nasa.gov',
  'nasa.gov',
  'www.airbus.com',
  'investors.boeing.com',
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

export async function fetchSource(source, { parser, fetcher = fetch, githubToken }) {
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
  if (source.kind === 'youtube')
    return [].concat(xml.feed?.entry ?? []).map((e) => ({
      original_title: plainText(e.title, 200),
      original_url: canonicalUrl(
        e.link?.['@_href'] ?? `https://www.youtube.com/watch?v=${e['yt:videoId']}`,
      ),
      raw_text: plainText(e['media:group']?.['media:description'] ?? ''),
      published_at: e.published,
      kind: 'video',
      summary_basis: 'description',
      image_url: `https://i.ytimg.com/vi/${e['yt:videoId']}/hqdefault.jpg`,
    }));
  const entries = [].concat(xml.rss?.channel?.item ?? []);
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
