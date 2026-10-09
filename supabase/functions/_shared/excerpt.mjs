import { plainText } from './content.mjs';
import { trustedUrl, trustedResponse, boundedText } from './sources.mjs';

function excerptText(html) {
  const text = plainText(html, 6001);
  if (text.length <= 6000) return text;
  const limited = text.slice(0, 6000);
  const ending = [...limited.matchAll(/[.!?。！？]["”’]?(?=\s|$)/g)].at(-1);
  // Avoid feeding the model a half-written claim when an article exceeds the excerpt limit.
  return ending && ending.index >= 4500
    ? limited.slice(0, ending.index + ending[0].length)
    : limited.slice(0, limited.lastIndexOf(' ') > 0 ? limited.lastIndexOf(' ') : 6000);
}

function container(html, marker, tag) {
  const clean = html;
  const match = marker.exec(clean);
  if (!match) return '';
  const tokens = new RegExp(`<${tag}\\b[^>]*>|<\\/${tag}\\s*>`, 'gi');
  const start = match.index + match[0].length;
  tokens.lastIndex = start;
  let depth = 1,
    end = start;
  for (let token; (token = tokens.exec(clean));) {
    depth += token[0].startsWith('</') ? -1 : 1;
    if (depth === 0) {
      end = token.index;
      break;
    }
  }
  if (end === start) return '';
  return clean.slice(start, end);
}

export function extractOfficialExcerpt(html, hostname) {
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  if (hostname === 'www.airbus.com') {
    // Airbus navigation contains article teasers before the actual full-view article.
    // Press releases use article; web stories use section. Both must be full-view nodes.
    const fullView = /<(article|section)\b[^>]*class=["'][^"']*\bview-mode-full\b[^"']*["'][^>]*>/i;
    const tag = fullView.exec(clean)?.[1]?.toLowerCase();
    const article = tag ? container(clean, fullView, tag) : '';
    const body = container(
      article,
      /<div\b[^>]*class=["'][^"']*\btext-content\b[^"']*\brte\b[^"']*["'][^>]*>/i,
      'div',
    );
    return excerptText(body);
  }
  if (hostname === 'www.af.mil') {
    const article = container(
      clean,
      /<article\b[^>]*class=["'][^"']*\barticle-detail\b[^"']*["'][^>]*>/i,
      'article',
    );
    return excerptText(
      container(
        article,
        /<section\b[^>]*class=["'][^"']*\barticle-detail-content\b[^"']*["'][^>]*>/i,
        'section',
      ),
    );
  }
  if (hostname === 'investors.lockheedmartin.com')
    return excerptText(
      container(
        clean,
        /<article\b[^>]*class=["'][^"']*\bnode--type-nir-news\b[^"']*["'][^>]*>/i,
        'article',
      ),
    );
  const marker =
    hostname === 'investors.boeing.com'
      ? /<div\b[^>]*class=["'][^"']*\bevergreen-news-body\b[^"']*["'][^>]*>/i
      : /<article\b[^>]*>/i;
  return excerptText(
    container(clean, marker, hostname === 'investors.boeing.com' ? 'div' : 'article'),
  );
}

export async function enrichExcerpt(item, fetcher = fetch) {
  if (item.kind !== 'article' || item.raw_text.length >= 1500) return item.raw_text;
  // These official feeds contain introductory summaries; read the story for engineering detail.
  const detailedFeed = ['www.af.mil', 'investors.lockheedmartin.com'].includes(
    new URL(item.original_url).hostname,
  );
  if (!detailedFeed && item.raw_text.length >= 250) return item.raw_text;
  const url = trustedUrl(item.original_url);
  const response = await trustedResponse(url.href, {
    fetcher,
    timeout: 6000,
    headers: { 'User-Agent': 'FlightLab/0.1 (aviation discovery)', Accept: 'text/html' },
  });
  if (!response.headers.get('content-type')?.includes('text/html')) return item.raw_text;
  const excerpt = extractOfficialExcerpt(await boundedText(response), url.hostname);
  return excerpt.length > item.raw_text.length ? excerpt : item.raw_text;
}
