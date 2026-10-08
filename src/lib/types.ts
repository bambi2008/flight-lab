export const categories = [
  '全部',
  '空气动力学',
  '飞机设计',
  '实验飞行器',
  '模拟与游戏',
  '开源工具',
] as const;
export type Category = (typeof categories)[number];
export type Article = {
  id: string;
  title: string;
  original_title: string;
  summary: string;
  why_it_matters: string;
  category: Exclude<Category, '全部'>;
  tags: string[];
  source_name: string;
  original_url: string;
  kind: 'video' | 'project' | 'article';
  featured: boolean;
  status: 'published' | 'pending' | 'rejected';
  quality_score: number | null;
  published_at: string;
  published_precision?: 'exact' | 'date';
  source_id?: string | null;
  processed_at?: string | null;
  process_state?: string;
  created_at: string;
  image_url: string | null;
  summary_basis: 'description' | 'excerpt' | 'manual';
  moderation_reason?: string;
};
export type Source = {
  id: string;
  name: string;
  kind: 'youtube' | 'rss' | 'github' | 'manual';
  locator: string;
  enabled: boolean;
  last_error: string | null;
  last_fetched_at: string | null;
};
