import type { AircraftProfile } from './aircraft';
import type { Article } from './types';

// Match explicit model names, not a manufacturer's name or incidental mentions in a summary.
const modelNames: Record<string, RegExp> = {
  'x-59': /(?:^|[^a-z0-9])x[\s\-–—]?59(?![a-z0-9])/i,
  a350f: /(?:^|[^a-z0-9])a350[\s\-–—]?f(?![a-z0-9])/i,
  'fa-xx': /(?:^|[^a-z0-9])f[\s/\-]?a[\s\-–—]?xx(?![a-z0-9])/i,
};

export function aircraftNews(profile: AircraftProfile, articles: Article[]): Article[] {
  const pattern = modelNames[profile.id];
  if (!pattern) return [];
  const seen = new Set<string>();
  return articles
    .filter((article) => {
      if (article.status !== 'published' || !Number.isFinite(Date.parse(article.published_at)))
        return false;
      const text = `${article.original_title} ${article.title} ${article.tags.join(' ')}`.normalize(
        'NFKC',
      );
      if (!pattern.test(text)) return false;
      try {
        const url = new URL(article.original_url);
        if (url.protocol !== 'https:' || url.username || url.password) return false;
        url.hash = '';
        const key = url.href.replace(/\/$/, '');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      } catch {
        return false;
      }
    })
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
}

export function newsPublishedDate(article: Article): string {
  if (article.published_precision === 'date')
    return article.published_at.slice(0, 10).replaceAll('-', '.');
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date(article.published_at))
    .replaceAll('/', '.');
}
