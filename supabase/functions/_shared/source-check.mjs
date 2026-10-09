import { fetchSource } from './sources.mjs';

// Read-only diagnostics: never enqueue content or move the ingestion clock.
export async function checkStoredSource({ db, parser, sourceId, githubToken, fetcher = fetch }) {
  if (
    typeof sourceId !== 'string' ||
    !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(sourceId)
  )
    throw new Error('来源 ID 无效');
  const { data: source, error } = await db
    .from('sources')
    .select('id,name,kind,locator')
    .eq('id', sourceId)
    .maybeSingle();
  if (error || !source) throw new Error('来源不存在或无法读取');
  const started = Date.now();
  try {
    const items = await fetchSource(source, { parser, githubToken, fetcher });
    if (!items.length) throw new Error('未读到条目，可能是空订阅或返回格式异常');
    return {
      source_id: source.id,
      ok: true,
      checked_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      count: items.length,
      latest_title: items[0].original_title,
      message: '连接正常',
    };
  } catch (error) {
    return {
      source_id: source.id,
      ok: false,
      checked_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      count: 0,
      latest_title: '',
      message:
        error.message === 'fetch failed'
          ? '连接未完成，请稍后重试'
          : String(error.message).slice(0, 300),
    };
  }
}
