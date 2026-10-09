export function pollIntervalMinutes(source) {
  if (source.kind === 'bilibili') return 60;
  return source.kind === 'rss' ? 10 : source.kind === 'youtube' ? 30 : 360;
}

export function sourceIsDue(source, now = Date.now()) {
  if (!source.enabled || source.kind === 'manual') return false;
  const previous = Date.parse(source.last_fetched_at ?? '');
  return !Number.isFinite(previous) || now - previous >= pollIntervalMinutes(source) * 60_000;
}

export function dueSources(sources, now = Date.now()) {
  return sources
    .filter((source) => sourceIsDue(source, now))
    .sort(
      (a, b) =>
        (Date.parse(a.last_fetched_at ?? '') || 0) - (Date.parse(b.last_fetched_at ?? '') || 0),
    );
}
