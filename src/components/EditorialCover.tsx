import { ArrowRight } from 'lucide-react';
import type { Article, Category } from '../lib/types';
import { safeLink } from './ArticleCard';

function SourceLink({ article, className = '' }: { article: Article; className?: string }) {
  const href = safeLink(article.original_url);
  if (!href) return null;
  return (
    <a
      className={`editorial-link ${className}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {article.kind === 'video' ? '看原视频' : article.kind === 'project' ? '查看项目' : '阅读原文'}
      <ArrowRight size={21} strokeWidth={1.3} />
    </a>
  );
}

export default function EditorialCover({
  articles,
  preview,
  onTopic,
}: {
  articles: Article[];
  preview: boolean;
  onTopic: (category: Category) => void;
}) {
  const lead =
    articles.find((a) => a.featured && a.kind === 'video') ??
    articles.find((a) => a.featured) ??
    articles[0];
  const flow = articles.find((a) => a.id !== lead?.id && a.category === '空气动力学');
  const creation = articles.find((a) => a.id !== lead?.id && a.category === '模拟与游戏');
  if (!lead) return null;
  const demoLead = preview && lead.id === 'sample-1';
  return (
    <section className="editorial-cover" aria-label="本期精选">
      <article className="cover-lead">
        <a
          className="cover-photo"
          href={safeLink(lead.original_url) ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={-1}
          aria-hidden="true"
        >
          <img
            src={
              preview
                ? '/images/editorial-aircraft.webp'
                : (lead.image_url ?? '/images/editorial-aircraft.webp')
            }
            alt=""
            width="1429"
            height="1100"
          />
          <span className="cover-photo-note">
            AIRCRAFT
            <br />
            IDEAS
            <br />
            PEOPLE
            <br />A BRIGHTER
            <br />
            SKY
          </span>
        </a>
        <div className="cover-lead-copy">
          <span className="editorial-category">{lead.category}</span>
          <h1>
            <a
              href={safeLink(lead.original_url) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              {demoLead ? (
                <>
                  <span className="latin-title">X-59:</span> 长机鼻背后的设计逻辑
                </>
              ) : (
                lead.title
              )}
            </a>
          </h1>
          <p className="cover-deck">{demoLead ? '外形如何改变激波？' : lead.why_it_matters}</p>
          <div className="cover-meta">
            <span>
              {lead.source_name}
              {lead.kind === 'video' ? ' · YouTube' : ''}
            </span>
            <SourceLink article={lead} />
          </div>
        </div>
      </article>
      <div className="cover-side">
        {flow && (
          <article className="cover-flow">
            <a
              className="flow-photo"
              href={safeLink(flow.original_url) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={-1}
              aria-hidden="true"
            >
              <img
                src={
                  preview
                    ? '/images/editorial-airflow.webp'
                    : (flow.image_url ?? '/images/editorial-airflow.webp')
                }
                alt=""
                width="1600"
                height="820"
              />
            </a>
            <div className="flow-copy">
              <div>
                <span className="editorial-category">{flow.category}</span>
                <h2>
                  <a
                    href={safeLink(flow.original_url) ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {preview ? '看见机翼周围的空气' : flow.title}
                  </a>
                </h2>
                <p>{preview ? 'NASA · 压力可视化研究' : flow.source_name}</p>
              </div>
              <SourceLink article={flow} />
            </div>
          </article>
        )}
        <div className="editorial-manifesto">
          <div>
            <p className="manifesto-english">
              Ideas
              <br />
              take flight
            </p>
            <p className="manifesto-chinese">关于飞行的好奇与创造</p>
          </div>
          <span>
            EXPERIMENT
            <br />
            SIMULATE
            <br />
            BUILD
            <br />
            EXPLORE
            <br />
            FLY
          </span>
        </div>
        <article className="cover-creation">
          <a
            className="creation-photo"
            href="/categories"
            onClick={(e) => {
              e.preventDefault();
              onTopic('模拟与游戏');
            }}
            tabIndex={-1}
            aria-hidden="true"
          >
            <img src="/images/editorial-build.webp" alt="" width="1600" height="640" />
          </a>
          <span className="editorial-category">模拟与游戏</span>
          <h2>
            <a
              href="/categories"
              onClick={(e) => {
                e.preventDefault();
                onTopic('模拟与游戏');
              }}
            >
              {preview ? 'Besiege：让一个想法飞起来' : (creation?.title ?? '让一个想法飞起来')}
            </a>
          </h2>
          <div className="creation-meta">
            <p>
              {preview ? '从零件到蓝天，在创造中理解飞行的本质。' : '在设计与模拟中，继续探索。'}
            </p>
            <a
              className="editorial-link"
              href="/categories"
              aria-label="探索模拟与游戏专题"
              onClick={(e) => {
                e.preventDefault();
                onTopic('模拟与游戏');
              }}
            >
              <ArrowRight size={22} strokeWidth={1.3} />
            </a>
          </div>
        </article>
      </div>
    </section>
  );
}
