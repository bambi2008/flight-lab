import type { Article } from './types';

export function publicationLatency(articles: Article[], now = Date.now()) {
  const sample = articles.filter(
    (article) =>
      article.source_id &&
      article.status === 'published' &&
      article.process_state === 'complete' &&
      article.published_precision !== 'date' &&
      now - Date.parse(article.published_at) <= 72 * 3600_000,
  );
  const timings = sample
    .flatMap((article) => {
      const published = Date.parse(article.published_at),
        discovered = Date.parse(article.created_at),
        processed = Date.parse(article.processed_at ?? '');
      if (
        ![published, discovered, processed].every(Number.isFinite) ||
        published > discovered ||
        discovered > processed ||
        processed > now
      )
        return [];
      return [(processed - published) / 60_000];
    })
    .sort((a, b) => a - b);
  const percentile = (ratio: number) =>
    timings.length ? timings[Math.ceil(timings.length * ratio) - 1] : null;
  return { count: timings.length, p50: percentile(0.5), p95: percentile(0.95) };
}
