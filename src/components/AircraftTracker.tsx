import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, RefreshCw, Search, X } from 'lucide-react';
import type { Article } from '../lib/types';
import { aircraftNews, newsPublishedDate } from '../lib/aircraft-news';
import { sourceFor, type AircraftDomain, type AircraftProfile } from '../lib/aircraft';

const date = (value: string) => value.replaceAll('-', '.');

type AircraftFeed = {
  articles: Article[];
  profiles: AircraftProfile[];
  profileError: string;
  loading: boolean;
  error: string;
  preview: boolean;
  onRefresh: () => void;
};

function FeedStatus({ feed }: { feed: AircraftFeed }) {
  return (
    <div className="aircraft-feed-status" aria-live="polite">
      <p>
        {feed.profileError
          ? '机型档案暂时无法更新，已加载内容仍可阅读。'
          : feed.error
            ? '相关资讯暂时无法更新，已加载内容仍可阅读。'
            : feed.loading
              ? '正在读取相关资讯…'
              : feed.preview
                ? '资讯预览 · 参数与时间线由编辑整理'
                : '相关资讯随发布更新 · 参数与时间线由编辑核对'}
      </p>
      <button className="editorial-link" disabled={feed.loading} onClick={feed.onRefresh}>
        <RefreshCw size={13} /> {feed.loading ? '读取中' : '刷新资讯'}
      </button>
    </div>
  );
}

function RelatedNews({ profile, feed }: { profile: AircraftProfile; feed: AircraftFeed }) {
  const news = aircraftNews(profile, feed.articles);
  return (
    <section id="related-updates" className="dossier-section aircraft-related-news">
      <span className="eyebrow">FOLLOW THE AIRCRAFT</span>
      <h2>这架飞机的新消息</h2>
      <FeedStatus feed={feed} />
      {news.length ? (
        <ol className="aircraft-news-list">
          {news.slice(0, 8).map((article) => (
            <li key={article.id}>
              <p className="aircraft-date">
                {article.source_name} · 来源发布{' '}
                <time dateTime={article.published_at}>{newsPublishedDate(article)}</time>
                {article.published_precision === 'date' ? '（日期）' : '（北京时间）'}
              </p>
              <h3>
                <a href={article.original_url} target="_blank" rel="noopener noreferrer">
                  {article.title}
                  <ArrowUpRight size={16} />
                </a>
              </h3>
              <p>{article.summary}</p>
              <p className="aircraft-news-question">值得研究：{article.why_it_matters}</p>
              <span className="aircraft-snapshot-note">
                {article.summary_basis === 'manual'
                  ? '编辑整理'
                  : article.summary_basis === 'description'
                    ? '依据视频简介'
                    : '依据来源摘录'}
              </span>
            </li>
          ))}
        </ol>
      ) : !feed.loading && !feed.error ? (
        <p className="aircraft-news-empty">
          暂时没有已发布的相关资讯。先沿着下方的公开资料了解这款飞机。
        </p>
      ) : null}
    </section>
  );
}

function Citation({ profile, id }: { profile: AircraftProfile; id: string }) {
  const source = sourceFor(profile, id);
  if (!source) return null;
  return (
    <a
      className="aircraft-citation"
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`来源：${source.title}`}
    >
      {source.name} <ArrowUpRight size={12} />
    </a>
  );
}

function AircraftRow({
  profile,
  onOpen,
  news,
}: {
  profile: AircraftProfile;
  onOpen: (id: string) => void;
  news: Article[];
}) {
  // A source with date-only precision can predate the editor's event record.
  const latestNews = news.find(
    (article) => article.published_at.slice(0, 10) >= profile.latest.date,
  );
  return (
    <article className="aircraft-row">
      <div className="aircraft-identity">
        <span className="editorial-category">
          {profile.domain} / {profile.stage}
        </span>
        <h2>
          <a
            href={`/aircraft/${profile.id}`}
            onClick={(event) => {
              event.preventDefault();
              onOpen(profile.id);
            }}
          >
            {profile.name}
          </a>
        </h2>
        <p>{profile.maker}</p>
      </div>
      <div className="aircraft-update">
        <p className="aircraft-date">
          {latestNews ? '来源发布 ' : '档案消息发布 '}
          <time dateTime={latestNews?.published_at ?? profile.latest.date}>
            {latestNews ? newsPublishedDate(latestNews) : date(profile.latest.date)}
          </time>
          {latestNews && latestNews.published_precision !== 'date' ? '（北京时间）' : ''}
        </p>
        <h3>{latestNews?.title ?? profile.latest.title}</h3>
        <p>{latestNews?.summary ?? profile.latest.summary}</p>
        {latestNews ? (
          <a
            className="aircraft-citation"
            href={latestNews.original_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {latestNews.source_name} <ArrowUpRight size={12} />
          </a>
        ) : (
          <Citation profile={profile} id={profile.latest.source} />
        )}
        {news.length > 0 && (
          <p className="aircraft-news-count">已发布相关资讯 {news.length} 条 · 在档案内阅读</p>
        )}
      </div>
      <a
        className="editorial-link aircraft-open"
        href={`/aircraft/${profile.id}`}
        onClick={(event) => {
          event.preventDefault();
          onOpen(profile.id);
        }}
        aria-label={`打开 ${profile.name} 技术档案`}
      >
        技术档案 <ArrowRight size={18} />
      </a>
    </article>
  );
}

export function AircraftPreview({
  onOpen,
  onAll,
  feed,
}: {
  onOpen: (id: string) => void;
  onAll: () => void;
  feed: AircraftFeed;
}) {
  return (
    <section className="aircraft-preview" aria-labelledby="aircraft-preview-title">
      <div className="section-title">
        <div>
          <h2 id="aircraft-preview-title">新机追踪</h2>
          <span className="section-sub">THE NEXT THING TO FLY</span>
        </div>
        <a
          className="editorial-link"
          href="/aircraft"
          onClick={(event) => {
            event.preventDefault();
            onAll();
          }}
        >
          全部机型 <ArrowRight size={18} />
        </a>
      </div>
      <p className="aircraft-intro">
        民用、军用与实验飞行器。先看新进展，再沿着参数与设计往下研究。
      </p>
      {feed.profiles.map((profile) => (
        <AircraftRow
          key={profile.id}
          profile={profile}
          onOpen={onOpen}
          news={aircraftNews(profile, feed.articles)}
        />
      ))}
      <FeedStatus feed={feed} />
    </section>
  );
}

export function AircraftTracker({
  onOpen,
  feed,
}: {
  onOpen: (id: string) => void;
  feed: AircraftFeed;
}) {
  const [domain, setDomain] = useState<AircraftDomain | '全部'>('全部');
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () =>
      feed.profiles.filter(
        (profile) =>
          (domain === '全部' || domain === profile.domain) &&
          `${profile.name} ${profile.maker} ${profile.subtitle} ${profile.latest.title}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [domain, query, feed.profiles],
  );
  return (
    <section className="aircraft-page">
      <div className="aircraft-page-heading">
        <span className="eyebrow">AIRCRAFT / IN DEVELOPMENT</span>
        <h1>新机追踪</h1>
        <p>追踪一次亮相、一场首飞，也研究它为什么长成这样。</p>
      </div>
      <div className="aircraft-toolbar">
        <div className="category-tabs" role="group" aria-label="机型用途">
          {(['全部', '民用', '军用', '实验'] as const).map((value) => (
            <button
              key={value}
              aria-pressed={domain === value}
              className={domain === value ? 'active' : ''}
              onClick={() => setDomain(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={16} />
          <input
            aria-label="搜索机型"
            placeholder="搜索机型或制造商…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button aria-label="清空机型搜索" onClick={() => setQuery('')}>
              <X size={14} />
            </button>
          )}
        </label>
      </div>
      <FeedStatus feed={feed} />
      <div aria-live="polite">
        {feed.loading && !feed.profiles.length ? (
          <p className="aircraft-snapshot-note">正在读取机型档案…</p>
        ) : filtered.length ? (
          filtered.map((profile) => (
            <AircraftRow
              key={profile.id}
              profile={profile}
              onOpen={onOpen}
              news={aircraftNews(profile, feed.articles)}
            />
          ))
        ) : (
          <div className="empty">
            <h2>暂时没有匹配的机型</h2>
            <p>换一个名称，或看看其他用途。</p>
            <button
              onClick={() => {
                setQuery('');
                setDomain('全部');
              }}
            >
              查看全部机型
            </button>
          </div>
        )}
        <p className="feed-end">当前显示 {filtered.length} 款 · 每份档案都保留公开来源</p>
      </div>
    </section>
  );
}

export function AircraftDossier({
  id,
  onBack,
  feed,
}: {
  id: string;
  onBack: () => void;
  feed: AircraftFeed;
}) {
  const profile = feed.profiles.find((item) => item.id === id);
  if (!profile && feed.loading)
    return (
      <section className="empty">
        <p>正在读取机型档案…</p>
      </section>
    );
  if (!profile && feed.profileError)
    return (
      <section className="empty">
        <p role="alert">{feed.profileError}</p>
        <button onClick={feed.onRefresh}>重新加载档案</button>
      </section>
    );
  if (!profile)
    return (
      <section className="empty">
        <h1>这份机型档案还没有收录</h1>
        <button onClick={onBack}>返回新机追踪</button>
      </section>
    );
  return (
    <article className="aircraft-dossier">
      <a
        className="aircraft-back"
        href="/aircraft"
        onClick={(event) => {
          event.preventDefault();
          onBack();
        }}
      >
        <ArrowLeft size={16} />
        新机追踪
      </a>
      <header className="dossier-heading">
        <div>
          <span className="editorial-category">
            {profile.domain} / {profile.stage}
          </span>
          <h1>{profile.name}</h1>
          <h2>{profile.subtitle}</h2>
          <p>{profile.summary}</p>
        </div>
        <div className="dossier-stamp">
          <span>PUBLIC SOURCE FILE</span>
          <strong>{profile.maker}</strong>
          <p>
            资料核对 <time dateTime={profile.checkedAt}>{date(profile.checkedAt)}</time>
          </p>
          <small>参数与时间线由编辑核对 · 相关资讯随发布更新</small>
        </div>
      </header>
      <nav className="dossier-nav" aria-label="档案章节">
        <a href="#related-updates">相关资讯</a>
        <a href="#latest-update">档案进展</a>
        <a href="#specifications">参数与依据</a>
        <a href="#design-notes">设计解读</a>
        <a href="#flight-timeline">时间线</a>
        <a href="#public-sources">原始资料</a>
      </nav>
      <div className="dossier-layout">
        <div className="dossier-content">
          <RelatedNews profile={profile} feed={feed} />
          <section id="latest-update" className="dossier-section">
            <span className="eyebrow">01 / THE UPDATE</span>
            <h2>{profile.latest.title}</h2>
            <p className="dossier-event-date">
              事件：{profile.latest.eventDate} <span>消息发布：{date(profile.latest.date)}</span>
            </p>
            <p>{profile.latest.summary}</p>
            <Citation profile={profile} id={profile.latest.source} />
          </section>
          <section id="specifications" className="dossier-section">
            <span className="eyebrow">02 / THE NUMBERS</span>
            <h2>参数，要和依据一起看。</h2>
            <p>试飞实测、厂家指标、研制目标与未公开信息分别标注。数值适用条件见每一项说明。</p>
            <div className="spec-table-wrap">
              <table className="aircraft-spec-table">
                <caption className="sr-only">{profile.name} 参数及其来源</caption>
                <thead>
                  <tr>
                    <th scope="col">项目</th>
                    <th scope="col">公开信息</th>
                    <th scope="col">依据与说明</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.specs.map((spec) => (
                    <tr key={spec.label}>
                      <th scope="row">{spec.label}</th>
                      <td>
                        {spec.value}
                        <span
                          className={`evidence-label ${spec.evidence === '未公开' ? 'evidence-unknown' : ''}`}
                        >
                          {spec.evidence}
                        </span>
                      </td>
                      <td>
                        <p>{spec.note}</p>
                        <Citation profile={profile} id={spec.source} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section id="design-notes" className="dossier-section">
            <span className="eyebrow">03 / INSIDE THE DESIGN</span>
            <h2>设计解读</h2>
            {!profile.design.length && <p>暂未收录设计解读。</p>}
            {profile.design.map((item) => (
              <div className="dossier-design-note" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <Citation profile={profile} id={item.source} />
              </div>
            ))}
          </section>
          <section id="flight-timeline" className="dossier-section">
            <span className="eyebrow">04 / MILESTONES</span>
            <h2>沿着时间线研究</h2>
            {!profile.timeline.length && <p>暂未收录可核对的里程碑。</p>}
            <ol className="aircraft-timeline">
              {profile.timeline.map((item) => (
                <li key={item.date}>
                  <span>{item.date}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                    <Citation profile={profile} id={item.source} />
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section id="public-sources" className="dossier-section">
            <span className="eyebrow">05 / GO TO THE SOURCE</span>
            <h2>回到原始资料</h2>
            <ol className="aircraft-source-list">
              {profile.sources.map((source) => (
                <li key={source.id}>
                  <span>
                    {source.name}
                    {source.published ? ` · ${date(source.published)}` : ' · 产品 / 项目页'}
                  </span>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.title}
                    <ArrowUpRight size={17} />
                  </a>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="dossier-research">
          <span className="eyebrow">YOUR NEXT QUESTION</span>
          <h2>值得再琢磨一下</h2>
          <p className="research-label">研究线索</p>
          {!profile.questions.length && (
            <p className="research-note">可以从参数的适用条件与原始资料开始研究。</p>
          )}
          {profile.questions.map((question, index) => (
            <p className="research-question" key={question}>
              <span>0{index + 1}</span>
              {question}
            </p>
          ))}
          <p className="research-note">
            这些问题是继续学习的入口。技术结论与数据请结合原始资料核对。
          </p>
        </aside>
      </div>
      <a
        className="editorial-link"
        href="/aircraft"
        onClick={(event) => {
          event.preventDefault();
          onBack();
        }}
      >
        继续看其他机型 <ArrowRight size={18} />
      </a>
    </article>
  );
}
