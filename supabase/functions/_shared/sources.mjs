import { canonicalUrl, plainText } from './content.mjs';

export const rssHosts = new Set(['www.nasa.gov', 'nasa.gov']);
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
  // No redirects: even an approved host must not redirect into a private service.
  const response = await fetcher(url, {
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`来源返回 HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error('来源内容过大');
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
  return [].concat(xml.rss?.channel?.item ?? []).map((e) => ({
    original_title: plainText(e.title, 200),
    original_url: canonicalUrl(e.link),
    raw_text: plainText(e.description ?? e['content:encoded'] ?? ''),
    published_at: new Date(e.pubDate).toISOString(),
    kind: 'article',
    summary_basis: 'excerpt',
    image_url: null,
  }));
}
