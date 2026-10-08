import { createClient } from '@supabase/supabase-js';
import type { Article, Source } from './types';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const db = url && key ? createClient(url, key) : null;
export const demoMode = !db;

// Keep raw source payloads and moderation notes out of the public UI.
const publicFields =
  'id,title,original_title,summary,why_it_matters,category,tags,source_name,original_url,kind,featured,status,quality_score,published_at,created_at,image_url,summary_basis';

export async function getArticles(): Promise<Article[]> {
  if (!db) {
    try {
      return (await import('./seed')).seedArticles;
    } catch {
      throw new Error('预览内容暂时无法加载，请刷新页面。');
    }
  }
  const { data, error } = await db
    .from('articles')
    .select(publicFields)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(300);
  if (error) throw new Error('资讯暂时无法加载，请稍后再试。');
  return (data ?? []) as Article[];
}

export async function getAdminData(): Promise<{
  articles: Article[];
  sources: Source[];
  runs: Record<string, unknown>[];
}> {
  if (!db) return { articles: (await import('./seed')).seedArticles, sources: [], runs: [] };
  const result = await Promise.all([
    db.from('articles').select('*').order('created_at', { ascending: false }).limit(300),
    db.from('sources').select('*').order('created_at'),
    db
      .from('ingest_runs')
      .select('*')
      .gte('started_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .order('started_at', { ascending: false })
      .limit(300),
  ]);
  if (result.some((r) => r.error)) throw new Error('后台数据加载失败，请检查管理员权限。');
  return {
    articles: result[0].data as Article[],
    sources: result[1].data as Source[],
    runs: result[2].data ?? [],
  };
}
