import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Star,
  Plus,
  LogOut,
  RefreshCw,
  Ban,
  Eye,
  Radio,
  Activity,
  Edit3,
  X,
  Plane,
} from 'lucide-react';
import { db, demoMode, localMode, getAdminData } from '../lib/db';
import { categories, type Article, type Source } from '../lib/types';
import { safeLink } from './ArticleCard';
import { publicationLatency } from '../lib/latency';
import AircraftEditor from './AircraftEditor';

type Draft = {
  title: string;
  original_url: string;
  summary: string;
  why_it_matters: string;
  category: string;
  kind: string;
  source_name: string;
  tags: string;
};
const emptyDraft: Draft = {
  title: '',
  original_url: '',
  summary: '',
  why_it_matters: '',
  category: '飞机设计',
  kind: 'video',
  source_name: '哔哩哔哩',
  tags: '',
};
const runStatus: Record<string, string> = {
  running: '正在采集',
  complete: '已完成',
  awaiting_key: '等待模型密钥',
  failed: '未完成',
};
type SourceCheck = {
  ok: boolean;
  checked_at: string;
  count: number;
  latest_title: string;
  message: string;
};

export default function Admin({ onUpdated }: { onUpdated: () => Promise<void> }) {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(!demoMode);
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [articles, setArticles] = useState<Article[]>([]),
    [sources, setSources] = useState<Source[]>([]),
    [runs, setRuns] = useState<Record<string, unknown>[]>([]);
  const [weekly, setWeekly] = useState({ processed: 0, estimated_usd: 0, runs: 0 });
  const [tab, setTab] = useState(() =>
      ['aircraft', 'sources', 'runs'].includes(
        new URLSearchParams(location.search).get('section') ?? '',
      )
        ? new URLSearchParams(location.search).get('section')!
        : 'pending',
    ),
    [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false),
    [editId, setEditId] = useState<string | null>(null),
    [draft, setDraft] = useState<Draft>(emptyDraft);
  const [showSourceForm, setShowSourceForm] = useState(false),
    [sourceDraft, setSourceDraft] = useState({ name: '', kind: 'youtube', locator: '' });
  const [sourceChecks, setSourceChecks] = useState<Record<string, SourceCheck>>({});
  const [checkingSource, setCheckingSource] = useState<string | null>(null);
  const modalRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!showForm && !showSourceForm) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function keys(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowForm(false);
        setShowSourceForm(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const elements = Array.from(
        modalRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, textarea, select, a[href]',
        ) ?? [],
      );
      const first = elements[0],
        last = elements.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', keys);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keys);
      previous?.focus();
    };
  }, [showForm, showSourceForm]);
  const reload = useCallback(async () => {
    try {
      const data = await getAdminData();
      setArticles(data.articles);
      setSources(data.sources);
      setRuns(data.runs);
      setWeekly(data.weekly);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (!db) return;
    let alive = true;
    const client = db;
    async function check(userId?: string) {
      let ok = false;
      if (userId) {
        const { data } = await client
          .from('admin_roles')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();
        ok = !!data;
      }
      if (alive) {
        setAuthorized(ok);
        setChecking(false);
        if (userId && !ok) setError('该账号没有编辑权限，请联系项目管理员。');
      }
    }
    void client.auth
      .getUser()
      .then(({ data }) => check(data.user?.id))
      .catch(() => {
        if (alive) {
          setChecking(false);
          setError('身份检查失败，请稍后重新登录。');
        }
      });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        if (alive) void check(session?.user?.id);
      }, 0);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (authorized) void reload();
  }, [authorized, reload]);

  async function login(e?: React.FormEvent) {
    e?.preventDefault();
    if (!db) return;
    setBusy(true);
    setError('');
    const { error: err } = await db.auth.signInWithPassword({ email, password });
    setPassword('');
    if (err) setError('登录失败，请检查邮箱和密码。');
    setBusy(false);
  }
  async function action(id: string, patch: Record<string, unknown>) {
    if (!db) {
      setNotice('当前是后台预览，修改不会保存。');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error: err } = await db
        .from('articles')
        .update(patch)
        .eq('id', id)
        .select('id');
      if (err || !data?.length) throw new Error('修改失败，请检查权限后重试。');
      await reload();
      await onUpdated();
      setNotice('已保存');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(a: Article) {
    setEditId(a.id);
    setDraft({
      title: a.title,
      original_url: a.original_url,
      summary: a.summary,
      why_it_matters: a.why_it_matters,
      category: a.category,
      kind: a.kind,
      source_name: a.source_name,
      tags: a.tags.join('，'),
    });
    setShowForm(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!db) {
      setNotice('当前是后台预览，修改不会保存。');
      return;
    }
    if (!safeLink(draft.original_url)) {
      setError('请输入有效的网页链接。');
      return;
    }
    setBusy(true);
    setError('');
    const fields = {
      ...draft,
      tags: draft.tags
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 5),
      summary_basis: 'manual',
      process_state: 'complete',
      moderation_reason: '由编辑整理，等待人工发布',
    };
    try {
      const result = editId
        ? await db.from('articles').update(fields).eq('id', editId).select('id')
        : await db
            .from('articles')
            .insert({
              ...fields,
              original_title: draft.title,
              status: 'pending',
              published_at: new Date().toISOString(),
            })
            .select('id');
      if (result.error?.code === '23505') throw new Error('这条链接已经收录，请编辑已有内容。');
      if (result.error || !result.data?.length) throw new Error('内容保存失败，请稍后重试。');
      setShowForm(false);
      setEditId(null);
      setDraft(emptyDraft);
      await reload();
      await onUpdated();
      setNotice('已保存。新添加的内容在待审列表中。');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function collect() {
    if (!db) {
      setNotice('连接数据库并配置模型后，才能运行自动采集。');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error: err } = await db.functions.invoke('ingest', { body: {} });
      if (err) throw new Error('采集未完成，请查看运行记录或检查函数配置。');
      setNotice(
        data.skipped
          ? data.reason
          : `采集完成：收集 ${data.fetched} 条，发布 ${data.published} 条，待审 ${data.pending} 条${data.model_configured ? '' : '；模型尚未配置'}`,
      );
      await reload();
      await onUpdated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggleSource(source: Source) {
    if (!db) return;
    setBusy(true);
    const { error: err } = await db
      .from('sources')
      .update({ enabled: !source.enabled })
      .eq('id', source.id);
    if (err) setError('来源状态修改失败');
    else await reload();
    setBusy(false);
  }
  async function checkSource(source: Source) {
    if (!db) return;
    setBusy(true);
    setCheckingSource(source.id);
    setError('');
    setSourceChecks((previous) => {
      const next = { ...previous };
      delete next[source.id];
      return next;
    });
    try {
      const { data, error: err } = await db.functions.invoke('ingest', {
        body: { action: 'check_source', source_id: source.id },
      });
      if (err || !data || typeof data.ok !== 'boolean')
        throw new Error('连接检查未完成，请确认本地服务或函数已更新后重试。');
      setSourceChecks((previous) => ({ ...previous, [source.id]: data as SourceCheck }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCheckingSource(null);
      setBusy(false);
    }
  }
  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;
    setBusy(true);
    setError('');
    const { error: err } = await db.from('sources').insert({ ...sourceDraft, enabled: true });
    if (err) setError('来源保存失败。请检查频道 ID、UP 主 UID、RSS 地址或 GitHub topic。');
    else {
      setShowSourceForm(false);
      setSourceDraft({ name: '', kind: 'youtube', locator: '' });
      await reload();
      setNotice('来源已添加，下一次采集会检查连接。');
    }
    setBusy(false);
  }
  if (checking)
    return (
      <div className="admin-login">
        <p>正在检查管理员身份…</p>
      </div>
    );
  if (!authorized)
    return (
      <section className="admin-login">
        <span className="eyebrow">EDITOR'S DESK</span>
        <h1>
          好内容，
          <br />
          从这里起飞。
        </h1>
        <p>仅供管理员使用。读者无需注册或登录。</p>
        {demoMode ? (
          <>
            <div className="demo-notice">数据库尚未连接，可以查看后台布局。</div>
            <button className="primary" onClick={() => setAuthorized(true)}>
              查看后台预览 <ArrowUpRight size={16} />
            </button>
          </>
        ) : localMode ? (
          <>
            <div className="demo-notice">本地试运行 · 仅本机可用，修改会保存。</div>
            <button className="primary" disabled={busy} onClick={() => login()}>
              {busy ? '正在进入…' : '进入本地编辑台'} <ArrowUpRight size={16} />
            </button>
          </>
        ) : (
          <form onSubmit={login}>
            <label>
              管理员邮箱
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              密码
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? '正在登录…' : '登录编辑台'}
            </button>
          </form>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    );
  const visible = articles.filter((a) =>
    tab === 'featured' ? a.featured && a.status === 'published' : a.status === tab,
  );
  const latency = publicationLatency(articles);
  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <span className="eyebrow">EDITOR'S DESK</span>
          <h1>编辑台</h1>
          <p>让好内容被看见，让拿不准的内容先停一停。</p>
        </div>
        <div className="admin-actions">
          <button className="secondary" disabled={busy} onClick={collect}>
            <RefreshCw size={15} />
            运行采集
          </button>
          <button
            className="primary"
            onClick={() => {
              setEditId(null);
              setDraft(emptyDraft);
              setShowForm(true);
            }}
          >
            <Plus size={15} />
            添加链接
          </button>
          <button
            className="icon-button"
            aria-label="退出后台"
            onClick={async () => {
              if (db) await db.auth.signOut();
              setAuthorized(false);
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
      {demoMode && <div className="demo-notice">后台预览 · 这里的操作不会保存，采集尚未启用。</div>}
      {localMode && (
        <div className="demo-notice">
          本地试运行 · 修改会保存。服务运行期间每 10 分钟检查来源；未配置模型时只收录待处理内容。
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      <div className="admin-stats">
        <div>
          <span>等待审核</span>
          <strong>{articles.filter((a) => a.status === 'pending').length}</strong>
        </div>
        <div>
          <span>已发布 / 当前加载</span>
          <strong>{articles.filter((a) => a.status === 'published').length}</strong>
        </div>
        <div>
          <span>近 7 天处理</span>
          <strong>
            {weekly.processed}
            <small> 条</small>
          </strong>
        </div>
        <div>
          <span>近 7 天模型估算费用</span>
          <strong>${Number(weekly.estimated_usd).toFixed(4)}</strong>
          <small>实际账单以模型平台为准</small>
        </div>
      </div>
      <p className="source-note">
        发布延迟（来源发布时间至处理完成）：
        {latency.count
          ? `P50 ${latency.p50!.toFixed(1)} 分钟 / P95 ${latency.p95!.toFixed(1)} 分钟`
          : '尚无可测量的自动发布样本'}
        。 样本 {latency.count} 条，来自当前加载内容中近 72
        小时发布的自动资讯；仅有日期的来源与人工收录不计入。
      </p>
      <div className="admin-tabs">
        {[
          ['pending', '待审核', Eye],
          ['published', '已发布', Check],
          ['featured', '精选', Star],
          ['rejected', '已下架', Ban],
          ['sources', '来源', Radio],
          ['runs', '运行记录', Activity],
          ['aircraft', '机型档案', Plane],
        ].map(([v, label, Icon]) => {
          const I = Icon as typeof Eye;
          return (
            <button
              key={String(v)}
              className={tab === v ? 'active' : ''}
              onClick={() => setTab(String(v))}
            >
              <I size={15} />
              {String(label)}
            </button>
          );
        })}
      </div>
      <div hidden={tab !== 'aircraft'}>
        <AircraftEditor onUpdated={onUpdated} />
      </div>
      {tab === 'aircraft' ? null : tab === 'sources' ? (
        <div className="source-list">
          <div className="source-note">
            YouTube 填频道 ID，配置 API Key 后优先走官方 API，异常时回退订阅；RSS 支持
            NASA、Airbus、Boeing、Lockheed Martin、Joby 和美国空军已验证的官方域名；GitHub 填
            topic。B站填 UP 主数字 UID，需要服务端配置 RSSHub，也可通过“添加链接”收录。
            <br />
            检查连接只读取来源，不生成摘要或发布内容，不影响下次采集。检查结果仅保留在当前页面。
          </div>
          <button className="secondary" onClick={() => setShowSourceForm(true)}>
            <Plus size={14} />
            添加来源
          </button>
          {sources.map((s) => (
            <div className="source-row" key={s.id}>
              <div>
                <strong>{s.name}</strong>
                <span className="source-status">{s.enabled ? '已启用' : '已暂停'}</span>
                <p>
                  {s.kind} · {s.locator}
                </p>
                <p>
                  检查频率：
                  {s.kind === 'rss'
                    ? '10 分钟'
                    : s.kind === 'youtube'
                      ? '30 分钟'
                      : s.kind === 'bilibili'
                        ? '1 小时'
                        : s.kind === 'github'
                          ? '6 小时'
                          : '手动'}{' '}
                  · 最近采集检查：
                  {s.last_fetched_at
                    ? new Date(s.last_fetched_at).toLocaleString('zh-CN')
                    : '尚未运行'}
                </p>
                {s.last_error && <span className="error">最近采集异常：{s.last_error}</span>}
                {sourceChecks[s.id] && (
                  <div
                    className={`source-check-result ${sourceChecks[s.id].ok ? 'success' : 'error'}`}
                    role="status"
                  >
                    <strong>{sourceChecks[s.id].ok ? '本次连接正常' : '本次连接异常'}</strong>
                    <p>
                      {new Date(sourceChecks[s.id].checked_at).toLocaleString('zh-CN')}
                      {' · '}
                      {sourceChecks[s.id].ok
                        ? `读取 ${sourceChecks[s.id].count} 条`
                        : sourceChecks[s.id].message}
                    </p>
                    {sourceChecks[s.id].ok && (
                      <>
                        <p>{sourceChecks[s.id].message}</p>
                        <p>最新条目：{sourceChecks[s.id].latest_title}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="source-actions">
                {s.kind !== 'manual' && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => checkSource(s)}
                    aria-label={`检查 ${s.name} 连接`}
                  >
                    <RefreshCw size={14} className={checkingSource === s.id ? 'spinning' : ''} />
                    {checkingSource === s.id ? '检查中…' : '检查连接'}
                  </button>
                )}
                <button className="secondary" disabled={busy} onClick={() => toggleSource(s)}>
                  {s.enabled ? '暂停' : '启用'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : tab === 'runs' ? (
        <div className="run-list">
          <p className="source-note">
            费用按 token 数和配置单价估算；缓存折扣、时段折扣及连接超时造成的未知用量，需要与
            DeepSeek 账单核对。
          </p>
          {runs.length ? (
            runs.map((r) => (
              <div className="run-row" key={String(r.id)}>
                <div>
                  <strong>{new Date(String(r.started_at)).toLocaleString('zh-CN')}</strong>
                  <p>
                    {runStatus[String(r.status)] ?? String(r.status)} · 抓取 {String(r.fetched)} ·
                    发布 {String(r.published)} · 待审 {String(r.pending)} · 失败 {String(r.failed)}
                  </p>
                  {!!r.error && <p className="error">{String(r.error)}</p>}
                </div>
                <span>${Number(r.estimated_usd ?? 0).toFixed(4)}</span>
              </div>
            ))
          ) : (
            <div className="empty">首次采集后，运行记录会出现在这里。</div>
          )}
        </div>
      ) : (
        <div className="review-list">
          {visible.length ? (
            visible.map((a) => (
              <article className="review-row" key={a.id}>
                <div className="review-content">
                  <div className="card-eyebrow">
                    <span>{a.source_name}</span>
                    <span>{a.category}</span>
                    {a.quality_score !== null && <span>参考评分 {a.quality_score}/10</span>}
                  </div>
                  <h3>
                    <a
                      href={safeLink(a.original_url) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {a.title}
                      <ArrowUpRight size={15} />
                    </a>
                  </h3>
                  <p>{a.summary || '尚未生成中文摘要。可以编辑内容，或等待下一次重试。'}</p>
                  {a.moderation_reason && (
                    <div className="review-reason">{a.moderation_reason}</div>
                  )}
                </div>
                <div className="review-actions">
                  <button className="secondary" disabled={busy} onClick={() => edit(a)}>
                    <Edit3 size={14} />
                    编辑
                  </button>
                  {a.status !== 'published' && (
                    <button
                      className="secondary"
                      disabled={busy || !a.summary || !a.why_it_matters}
                      onClick={() =>
                        action(a.id, {
                          status: 'published',
                          process_state: 'complete',
                          moderation_reason: '经编辑人工审核',
                        })
                      }
                    >
                      <Check size={14} />
                      发布
                    </button>
                  )}
                  {a.status === 'published' && (
                    <button
                      className={a.featured ? 'primary' : 'secondary'}
                      disabled={busy}
                      onClick={() => action(a.id, { featured: !a.featured })}
                    >
                      <Star size={14} />
                      {a.featured ? '取消精选' : '精选'}
                    </button>
                  )}
                  {a.status !== 'rejected' && (
                    <button
                      className="secondary danger"
                      disabled={busy}
                      onClick={() =>
                        action(a.id, {
                          status: 'rejected',
                          featured: false,
                          process_state: 'complete',
                          moderation_reason: '编辑下架',
                        })
                      }
                    >
                      <Ban size={14} />
                      下架
                    </button>
                  )}
                </div>
              </article>
            ))
          ) : (
            <div className="empty">这个列表目前没有内容。</div>
          )}
        </div>
      )}
      {showForm && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
        >
          <section
            ref={modalRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="draft-title"
          >
            <div className="modal-heading">
              <h2 id="draft-title">{editId ? '编辑内容' : '添加一个好内容'}</h2>
              <button aria-label="关闭表单" onClick={() => setShowForm(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={save}>
              <label>
                原始链接
                <input
                  autoFocus
                  type="url"
                  required
                  value={draft.original_url}
                  onChange={(e) => setDraft({ ...draft, original_url: e.target.value })}
                />
              </label>
              <label>
                中文标题
                <input
                  required
                  maxLength={160}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </label>
              <div className="form-grid">
                <label>
                  类型
                  <select
                    value={draft.kind}
                    onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
                  >
                    <option value="video">视频</option>
                    <option value="project">项目</option>
                    <option value="article">阅读</option>
                  </select>
                </label>
                <label>
                  主题
                  <select
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  >
                    {categories.slice(1).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                来源名称
                <input
                  required
                  value={draft.source_name}
                  onChange={(e) => setDraft({ ...draft, source_name: e.target.value })}
                />
              </label>
              <label>
                中文介绍
                <textarea
                  required
                  rows={3}
                  maxLength={1200}
                  value={draft.summary}
                  onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                />
              </label>
              <label>
                有什么值得研究
                <textarea
                  required
                  rows={2}
                  maxLength={500}
                  value={draft.why_it_matters}
                  onChange={(e) => setDraft({ ...draft, why_it_matters: e.target.value })}
                />
              </label>
              <label>
                标签（用逗号分隔）
                <input
                  value={draft.tags}
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? '保存中…' : '保存内容'}
              </button>
            </form>
          </section>
        </div>
      )}
      {showSourceForm && (
        <div className="modal-backdrop">
          <section
            ref={modalRef}
            className="modal small"
            role="dialog"
            aria-modal="true"
            aria-labelledby="source-title"
          >
            <div className="modal-heading">
              <h2 id="source-title">添加来源</h2>
              <button aria-label="关闭来源表单" onClick={() => setShowSourceForm(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={addSource}>
              <label>
                名称
                <input
                  autoFocus
                  required
                  value={sourceDraft.name}
                  onChange={(e) => setSourceDraft({ ...sourceDraft, name: e.target.value })}
                />
              </label>
              <label>
                类型
                <select
                  value={sourceDraft.kind}
                  onChange={(e) => setSourceDraft({ ...sourceDraft, kind: e.target.value })}
                >
                  <option value="youtube">YouTube 频道</option>
                  <option value="bilibili">B站 UP 主（RSSHub）</option>
                  <option value="rss">官方 RSS</option>
                  <option value="github">GitHub topic</option>
                </select>
              </label>
              <label>
                {sourceDraft.kind === 'youtube'
                  ? '频道 ID（以 UC 开头）'
                  : sourceDraft.kind === 'bilibili'
                    ? 'UP 主数字 UID（主页地址中的数字）'
                    : sourceDraft.kind === 'rss'
                      ? '官方 RSS 地址'
                      : 'Topic，例如 aerodynamics'}
                <input
                  required
                  value={sourceDraft.locator}
                  onChange={(e) => setSourceDraft({ ...sourceDraft, locator: e.target.value })}
                />
              </label>
              <button className="primary" disabled={busy}>
                保存来源
              </button>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
