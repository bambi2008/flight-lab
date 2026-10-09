import { plainText } from './content.mjs';
import { trustedUrl, trustedResponse, boundedText } from './sources.mjs';

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
    return plainText(body, 6000);
  }
  const marker =
    hostname === 'investors.boeing.com'
      ? /<div\b[^>]*class=["'][^"']*\bevergreen-news-body\b[^"']*["'][^>]*>/i
      : /<article\b[^>]*>/i;
  return plainText(
    container(clean, marker, hostname === 'investors.boeing.com' ? 'div' : 'article'),
    6000,
  );
}

export async function enrichExcerpt(item, fetcher = fetch) {
  if (item.kind !== 'article' || item.raw_text.length >= 250) return item.raw_text;
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
