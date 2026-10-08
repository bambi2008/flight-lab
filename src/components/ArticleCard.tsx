import { ArrowUpRight, Play, Code2, FileText } from 'lucide-react';
import type { Article } from '../lib/types';

const icons = { video: Play, project: Code2, article: FileText };
const kindNames = { video: '视频', project: '项目', article: '阅读' };
export function safeLink(value: string): string | null {
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

export default function ArticleCard({
  article,
  compact = false,
}: {
  article: Article;
  compact?: boolean;
}) {
  const Icon = icons[article.kind];
  const href = safeLink(article.original_url);
  const image =
    article.image_url && /^https:\/\/i\.ytimg\.com\//.test(article.image_url)
      ? article.image_url
      : null;
  return (
    <article className={`article-card ${compact ? 'compact' : ''}`}>
      {!compact && image && (
        <a
          className={`card-art art-${article.category}`}
          href={href ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={-1}
          aria-hidden="true"
        >
          <img
            src={image}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <span className="kind-pill">
            <Icon size={12} />
            {kindNames[article.kind]}
          </span>
        </a>
      )}
      <div className="card-body">
        <div className="card-eyebrow">
          <span>{article.category}</span>
          {article.featured && <span className="editor-pick">编辑精选</span>}
        </div>
        <h3>
          <a href={href ?? undefined} target="_blank" rel="noopener noreferrer">
            {article.title}
            <ArrowUpRight size={17} />
          </a>
        </h3>
        <p className="summary">{article.summary}</p>
        {article.why_it_matters && (
          <div className="why">
            <span>值得研究</span>
            <p>{article.why_it_matters}</p>
          </div>
        )}
        <div className="tags">
          {article.tags.slice(0, 3).map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
        <div className="card-foot">
          <span>{article.source_name}</span>
          <span>
            {new Date(article.published_at).toLocaleDateString('zh-CN', {
              month: 'short',
              day: 'numeric',
            })}{' '}
            ·{' '}
            {article.summary_basis === 'description'
              ? '根据视频简介整理'
              : article.summary_basis === 'manual'
                ? '人工整理'
                : '根据来源摘录整理'}
          </span>
        </div>
      </div>
    </article>
  );
}
