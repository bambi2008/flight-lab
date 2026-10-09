import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Search, Plane, SlidersHorizontal, X, Menu, RefreshCw } from 'lucide-react';
import { demoMode, localMode, getArticles } from './lib/db';
import { categories, type Article, type Category } from './lib/types';
import ArticleCard from './components/ArticleCard';
import EditorialCover from './components/EditorialCover';
import Admin from './components/Admin';
import { AircraftDossier, AircraftPreview, AircraftTracker } from './components/AircraftTracker';

type Page = 'home' | 'topics' | 'about' | 'admin' | 'aircraft' | 'aircraft-detail';
const initialPage = (): Page =>
  location.pathname.startsWith('/aircraft/')
    ? 'aircraft-detail'
    : (({ '/categories': 'topics', '/about': 'about', '/admin': 'admin' }[
        location.pathname
      ] as Page) ?? (location.pathname === '/aircraft' ? 'aircraft' : 'home'));
const initialAircraft = () => location.pathname.split('/')[2] ?? '';
const paths: Record<Page, string> = {
  home: '/',
  topics: '/categories',
  about: '/about',
  admin: '/admin',
  aircraft: '/aircraft',
  'aircraft-detail': '/aircraft',
};

export default function App() {
  const [page, setPage] = useState<Page>(initialPage);
  const [aircraftId, setAircraftId] = useState(initialAircraft);
  const [menu, setMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<Category>(() => {
    const value = new URLSearchParams(location.search).get('topic');
    return categories.includes(value as Category) ? (value as Category) : '全部';
  });
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('latest');
  const fetching = useRef(false);
  const reload = useCallback(async (quiet = false) => {
    if (fetching.current) return;
    fetching.current = true;
    if (!quiet) setLoading(true);
    try {
      setArticles(await getArticles());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      fetching.current = false;
      if (!quiet) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    if (demoMode || page === 'admin') return;
    const refresh = () => {
      if (document.visibilityState === 'visible') void reload(true);
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [page, reload]);
  useEffect(() => {
    const fn = () => {
      setPage(initialPage());
      setAircraftId(initialAircraft());
      const value = new URLSearchParams(location.search).get('topic');
      setCategory(categories.includes(value as Category) ? (value as Category) : '全部');
      setMenu(false);
      setSearchOpen(false);
    };
    window.addEventListener('popstate', fn);
    return () => window.removeEventListener('popstate', fn);
  }, []);
  function navigate(next: Page, topic?: Category, id?: string) {
    const url =
      paths[next] +
      (next === 'aircraft-detail' && id ? '/' + encodeURIComponent(id) : '') +
      (next === 'topics' && topic && topic !== '全部' ? '?topic=' + encodeURIComponent(topic) : '');
    history.pushState({}, '', url);
    setPage(next);
    setMenu(false);
    setSearchOpen(false);
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
  const showCover = page === 'home' && !query && category === '全部' && kind === 'all';
  const openTopic = (topic: Category) => {
    setCategory(topic);
    setKind('all');
    setQuery('');
    navigate('topics', topic);
  };
  const showSearch = () => {
    if (page !== 'home' && page !== 'topics') navigate('home');
    setSearchOpen(true);
    setMenu(false);
  };
  const openAircraft = (id: string) => {
    setAircraftId(id);
    navigate('aircraft-detail', undefined, id);
  };
  useEffect(() => {
    if (searchOpen) document.getElementById('header-search-input')?.focus();
  }, [searchOpen, page]);
  useEffect(() => {
    if (!menu && !searchOpen) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenu(false);
      setSearchOpen(false);
      document
        .querySelector<HTMLButtonElement>(searchOpen ? '.search-button' : '.menu-button')
        ?.focus();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [menu, searchOpen]);
  const githubUrl = import.meta.env.VITE_GITHUB_URL;
  const aircraftFeed = {
    articles,
    loading,
    error,
    preview: demoMode,
    onRefresh: () => void reload(),
  };
  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到内容
      </a>
      <header className="site-header">
        <div className="masthead">
          <button
            className="menu-button"
            aria-label={menu ? '关闭菜单' : '打开菜单'}
            aria-expanded={menu}
            aria-controls="site-menu"
            onClick={() => {
              setMenu(!menu);
              setSearchOpen(false);
            }}
          >
            {menu ? <X size={27} strokeWidth={1.5} /> : <Menu size={27} strokeWidth={1.5} />}
          </button>
          <a
            href="/"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              setCategory('全部');
              setQuery('');
              setKind('all');
              setSearchOpen(false);
              navigate('home');
            }}
          >
            <span>FLIGHT LAB</span>
            <small>飞行实验室</small>
          </a>
          <div className="masthead-right">
            <span>好奇，让飞行更近一点</span>
            <button
              className="search-button"
              aria-label={searchOpen ? '关闭搜索' : '打开搜索'}
              aria-expanded={searchOpen}
              onClick={() => (searchOpen ? setSearchOpen(false) : showSearch())}
            >
              {searchOpen ? (
                <X size={26} strokeWidth={1.5} />
              ) : (
                <Search size={27} strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>
        <nav className="editorial-nav" aria-label="内容分类">
          <a
            href="/"
            aria-current={page === 'home' && category === '全部' ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              setCategory('全部');
              setQuery('');
              setKind('all');
              navigate('home');
            }}
          >
            精选
          </a>
          <a
            href="/aircraft"
            aria-current={page === 'aircraft' || page === 'aircraft-detail' ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate('aircraft');
            }}
          >
            新机追踪
          </a>
          {(['飞机设计', '空气动力学', '实验飞行器', '模拟与游戏', '开源工具'] as Category[]).map(
            (topic) => (
              <a
                key={topic}
                href={`/categories?topic=${encodeURIComponent(topic)}`}
                aria-current={page === 'topics' && category === topic ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  openTopic(topic);
                }}
              >
                {topic}
              </a>
            ),
          )}
        </nav>
        {menu && (
          <nav
            id="site-menu"
            className="site-menu"
            aria-label="主导航"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setMenu(false);
                document.querySelector<HTMLButtonElement>('.menu-button')?.focus();
              }
            }}
          >
            {(
              [
                ['home', '首页精选'],
                ['aircraft', '新机追踪 · 技术档案'],
                ['topics', '探索全部'],
                ['about', '关于飞行实验室'],
              ] as [Page, string][]
            ).map(([p, label]) => (
              <a
                key={p}
                href={paths[p]}
                onClick={(e) => {
                  e.preventDefault();
                  if (p === 'topics') {
                    setCategory('全部');
                    setQuery('');
                  }
                  navigate(p);
                }}
              >
                {label}
                <ArrowUpRight size={18} />
              </a>
            ))}
          </nav>
        )}
        {searchOpen && (
          <div
            className="header-search"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchOpen(false);
                document.querySelector<HTMLButtonElement>('.search-button')?.focus();
              }
            }}
          >
            <label htmlFor="header-search-input">从一个问题开始</label>
            <div>
              <Search size={20} />
              <input
                id="header-search-input"
                type="search"
                placeholder="搜索飞机、气流、项目…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCategory('全部');
                  setKind('all');
                }}
              />
              <button
                className="editorial-link"
                onClick={() => {
                  setSearchOpen(false);
                  document.getElementById('feed')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                查看结果
                <ArrowUpRight size={18} />
              </button>
            </div>
          </div>
        )}
      </header>
      <main id="main-content">
        {page === 'admin' ? (
          <Admin onUpdated={() => reload()} />
        ) : page === 'aircraft' ? (
          <AircraftTracker onOpen={openAircraft} feed={aircraftFeed} />
        ) : page === 'aircraft-detail' ? (
          <AircraftDossier
            id={aircraftId}
            onBack={() => navigate('aircraft')}
            feed={aircraftFeed}
          />
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
                  机翼、结构、构型、实验飞行器，还有把想法变成作品的开源工具。新机追踪覆盖民用、军用与实验机型，按公开来源记录技术参数与研制进展。
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
            {showCover && !loading && (
              <EditorialCover articles={articles} preview={demoMode} onTopic={openTopic} />
            )}
            {page === 'topics' && (
              <section className="topics-heading">
                <span className="eyebrow">FOLLOW YOUR CURIOSITY</span>
                <h1>{category === '全部' ? '沿着一个问题，继续探索。' : category}</h1>
                <p>空气如何流动，飞机如何设计，想法如何变成会飞的作品。</p>
              </section>
            )}
            <p className="demo-notice">
              {demoMode
                ? '预览版 · 内容依据真实来源整理，配图为 AI 概念图。自动采集尚未启用。'
                : localMode
                  ? '本地试运行 · 资讯来自本机数据库，技术档案由编辑维护，专题配图为 AI 概念图。'
                  : '专题视觉配图为 AI 概念创作 · 内容保留原始来源。'}
            </p>
            {showCover && (
              <AircraftPreview
                onOpen={openAircraft}
                onAll={() => navigate('aircraft')}
                feed={aircraftFeed}
              />
            )}
            <section id="feed" className="feed">
              <div className="section-title">
                <div>
                  <h2>{query ? `搜索：${query}` : page === 'home' ? '继续探索' : '按兴趣发现'}</h2>
                  <span className="section-sub">KEEP EXPLORING</span>
                </div>
                <button className="icon-button" aria-label="刷新资讯" onClick={() => void reload()}>
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
                {error && articles.length > 0 && (
                  <p className="preview-note" role="status">
                    {error} 以下保留上次加载的内容。
                    <button className="editorial-link" onClick={() => void reload()}>
                      重试
                    </button>
                  </p>
                )}
                {error && articles.length === 0 ? (
                  <div className="empty">
                    <h3>{error}</h3>
                    <button onClick={() => void reload()}>重新加载</button>
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
                  本次加载 {articles.length} 条 · 当前显示 {filtered.length} 条 ·
                  好奇心没有终点{' '}
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
