import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  Search,
  Plane,
  SlidersHorizontal,
  X,
  Menu,
  RefreshCw,
} from 'lucide-react';
import { demoMode, getArticles } from './lib/db';
import { categories, type Article, type Category } from './lib/types';
import ArticleCard from './components/ArticleCard';
import WingLab from './components/WingLab';
import Admin from './components/Admin';

type Page = 'home' | 'topics' | 'about' | 'admin';
const initialPage = (): Page =>
  (({ '/categories': 'topics', '/about': 'about', '/admin': 'admin' })[
    location.pathname
  ] as Page) ?? 'home';
const paths = { home: '/', topics: '/categories', about: '/about', admin: '/admin' };

export default function App() {
  const [page, setPage] = useState<Page>(initialPage);
  const [menu, setMenu] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<Category>('全部');
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('latest');
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setArticles(await getArticles());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    const fn = () => setPage(initialPage());
    window.addEventListener('popstate', fn);
    return () => window.removeEventListener('popstate', fn);
  }, []);
  function navigate(next: Page) {
    history.pushState({}, '', paths[next]);
    setPage(next);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const filtered = useMemo(
    () =>
      articles
        .filter(
          (a) =>
            (category === '全部' || a.category === category) &&
            (kind === 'all' || a.kind === kind) &&
            `${a.title} ${a.summary} ${a.tags.join(' ')} ${a.source_name}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'quality'
            ? (b.quality_score ?? 0) - (a.quality_score ?? 0)
            : Date.parse(b.published_at) - Date.parse(a.published_at),
        ),
    [articles, category, kind, query, sort],
  );
  const picks = articles.filter((a) => a.featured).slice(0, 3);
  const githubUrl = import.meta.env.VITE_GITHUB_URL;
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('home');
            }}
            className="brand"
          >
            <span className="brand-icon">
              <Plane size={22} />
            </span>
            <span>
              飞行实验室<small>FLIGHT LAB</small>
            </span>
            <span className="beta">BETA</span>
          </a>
          <nav className={menu ? 'open' : ''} aria-label="主导航">
            {(
              [
                ['home', '发现'],
                ['topics', '探索主题'],
                ['about', '关于这里'],
              ] as [Page, string][]
            ).map(([p, label]) => (
              <a
                key={p}
                href={paths[p]}
                aria-current={page === p ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(p);
                }}
              >
                {label}
              </a>
            ))}
          </nav>
          <button
            className="mobile-menu"
            aria-label={menu ? '关闭菜单' : '打开菜单'}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
          <span className="header-note">
            给每一个想弄懂飞行的人 <ArrowUpRight size={14} />
          </span>
        </div>
      </header>
      <main>
        {page === 'admin' ? (
          <Admin onUpdated={reload} />
        ) : page === 'about' ? (
          <section className="about-page">
            <span className="eyebrow">A SHARED CURIOSITY</span>
            <h1>
              从“这能飞吗？”
              <br />
              开始的好奇心。
            </h1>
            <p className="lead">
              一个专业又有趣的航空探索站。献给喜欢研究飞机设计、空气动力学，也愿意在模拟游戏里反复试验的年轻人。
            </p>
            <div className="about-grid">
              <div>
                <h2>我们关注什么</h2>
                <p>
                  机翼、结构、构型、实验飞行器，还有把想法变成作品的开源工具。发现值得看的视频，也发现值得动手研究的项目。
                </p>
              </div>
              <div>
                <h2>内容怎样来到这里</h2>
                <p>
                  从公开订阅和项目接口收集内容，辅助生成中文摘要，编辑挑选值得研究的作品。所有卡片保留原始链接，摘要会标明依据。
                </p>
              </div>
              <div>
                <h2>保持一点认真</h2>
                <p>
                  介绍不等于验证，模型评分也不是专业结论。来源不足或存在争议的内容先交给编辑；技术细节请回到原作核对。
                </p>
              </div>
              <div>
                <h2>一起慢慢把它做好</h2>
                <p>
                  第一版从精选内容开始。评论、投票与投稿留给下一阶段，也期待更多同样好奇的人加入。
                </p>
                {githubUrl && (
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link"
                  >
                    在 GitHub 看项目 <ArrowUpRight size={15} />
                  </a>
                )}
              </div>
            </div>
            <button className="primary" onClick={() => navigate('home')}>
              回去发现好内容 <ArrowUpRight size={16} />
            </button>
          </section>
        ) : (
          <>
            {page === 'home' ? (
              <section className="hero">
                <div className="hero-copy">
                  <span className="eyebrow">
                    <span className="tiny-dot" /> THE WORLD IS A WIND TUNNEL
                  </span>
                  <h1>
                    让好奇心，
                    <br />
                    飞得<span className="highlight">更远。</span>
                  </h1>
                  <p>
                    从一片机翼到一架奇妙的飞行器。
                    <br />
                    发现好视频、酷设计，以及值得研究的航空灵感。
                  </p>
                  <button
                    className="primary"
                    onClick={() =>
                      document.getElementById('feed')?.scrollIntoView({ behavior: 'smooth' })
                    }
                  >
                    开始探索 <ArrowDown size={16} />
                  </button>
                  <div className="hero-motto">
                    <span>专业一点。</span>有趣很多。
                  </div>
                </div>
                <WingLab />
              </section>
            ) : (
              <section className="topics-heading">
                <span className="eyebrow">FOLLOW YOUR CURIOSITY</span>
                <h1>沿着一个问题，继续探索。</h1>
                <p>空气如何流动，飞机如何设计，想法如何变成会飞的作品。</p>
              </section>
            )}
            {demoMode && (
              <div className="demo-notice">
                <span className="tiny-dot" /> 预览版 · 展示内容依据真实来源整理，自动采集尚未启用。
              </div>
            )}
            {page === 'home' &&
              !query &&
              category === '全部' &&
              kind === 'all' &&
              picks.length > 0 && (
                <section className="picks">
                  <div className="section-title">
                    <div>
                      <span className="section-number">01 /</span>
                      <h2>值得多看一眼</h2>
                      <span className="section-sub">EDITOR'S PICKS</span>
                    </div>
                    <span className="muted">从有趣，到想弄懂。</span>
                  </div>
                  <div className="pick-grid">
                    {picks.map((a) => (
                      <ArticleCard key={a.id} article={a} />
                    ))}
                  </div>
                </section>
              )}
            <section id="feed" className="feed">
              <div className="section-title">
                <div>
                  <span className="section-number">{page === 'home' ? '02' : '01'} /</span>
                  <h2>{page === 'home' ? '探索信息流' : '按兴趣发现'}</h2>
                  <span className="section-sub">KEEP EXPLORING</span>
                </div>
                <button className="icon-button" aria-label="刷新资讯" onClick={reload}>
                  <RefreshCw size={16} className={loading ? 'spin' : ''} />
                </button>
              </div>
              <div className="feed-toolbar">
                <div className="category-tabs" role="group" aria-label="内容主题">
                  {categories.map((c) => (
                    <button
                      key={c}
                      aria-pressed={category === c}
                      className={category === c ? 'active' : ''}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <label className="search">
                  <Search size={16} />
                  <input
                    aria-label="搜索资讯"
                    placeholder="搜索一个问题、项目…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button aria-label="清空搜索" onClick={() => setQuery('')}>
                      <X size={14} />
                    </button>
                  )}
                </label>
              </div>
              <div className="feed-options">
                <div className="kind-tabs">
                  {[
                    ['all', '所有内容'],
                    ['video', '视频'],
                    ['project', '项目'],
                    ['article', '阅读'],
                  ].map(([v, label]) => (
                    <button
                      key={v}
                      aria-pressed={kind === v}
                      className={kind === v ? 'active' : ''}
                      onClick={() => setKind(v)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="sort">
                  <SlidersHorizontal size={13} />
                  <select
                    aria-label="排序方式"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="latest">最近发布</option>
                    <option value="quality">参考评分</option>
                  </select>
                </label>
              </div>
              <div aria-live="polite">
                {error ? (
                  <div className="empty">
                    <h3>{error}</h3>
                    <button onClick={reload}>重新加载</button>
                  </div>
                ) : loading ? (
                  <div className="skeleton-grid">
                    {[1, 2, 3].map((i) => (
                      <div className="skeleton" key={i} />
                    ))}
                  </div>
                ) : filtered.length ? (
                  <div className="feed-grid">
                    {filtered.map((a) => (
                      <ArticleCard key={a.id} article={a} compact />
                    ))}
                  </div>
                ) : (
                  <div className="empty">
                    <Plane size={30} />
                    <h3>{query ? '暂时没有找到相关内容' : '好内容正在路上'}</h3>
                    <p>
                      {query
                        ? '换一个关键词，或者试试其他主题。'
                        : '编辑发布内容后，会在这里出现。'}
                    </p>
                    {(query || category !== '全部' || kind !== 'all') && (
                      <button
                        onClick={() => {
                          setQuery('');
                          setCategory('全部');
                          setKind('all');
                        }}
                      >
                        查看所有内容
                      </button>
                    )}
                  </div>
                )}
              </div>
              {!loading && filtered.length > 0 && (
                <p className="feed-end">
                  本次加载 {articles.length} 条 · 当前显示 {filtered.length} 条 · 好奇心没有终点{' '}
                  <span>✦</span>
                </p>
              )}
            </section>
            <aside className="closing">
              <Plane size={28} />
              <div>
                <h2>有些问题，值得一直追下去。</h2>
                <p>飞行实验室，给喜欢航空、喜欢琢磨的你。</p>
              </div>
              <button className="text-link" onClick={() => navigate('about')}>
                认识这个小站 <ArrowUpRight size={17} />
              </button>
            </aside>
          </>
        )}
      </main>
      <footer>
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('home');
          }}
          className="footer-brand"
        >
          飞行实验室 <span>FLIGHT LAB</span>
        </a>
        <span>保持好奇 · 尊重来源 · 认真探索</span>
        <div>
          {githubUrl && (
            <a href={githubUrl} target="_blank" rel="noopener noreferrer">
              GitHub <ArrowUpRight size={12} />
            </a>
          )}
          <a
            href="/admin"
            onClick={(e) => {
              e.preventDefault();
              navigate('admin');
            }}
          >
            编辑入口
          </a>
        </div>
      </footer>
    </>
  );
}
