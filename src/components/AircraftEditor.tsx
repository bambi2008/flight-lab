import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Edit3, Plus, Save, X } from 'lucide-react';
import type { AircraftProfile } from '../lib/aircraft';
import { emptyAircraftProfile, evidenceTypes } from '../lib/aircraft-validation';
import {
  getAdminAircraftProfiles,
  saveAircraftProfile,
  type AircraftRecord,
} from '../lib/aircraft-store';
import { demoMode } from '../lib/db';

type Section = 'sources' | 'specs' | 'design' | 'timeline' | 'questions';

function Field({
  label,
  value,
  onChange,
  multiline = false,
  type = 'text',
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <label>
      {label}
      {multiline ? (
        <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input
          type={type}
          value={value}
          readOnly={readOnly}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

export default function AircraftEditor({ onUpdated }: { onUpdated: () => Promise<void> }) {
  const [records, setRecords] = useState<AircraftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<AircraftProfile | null>(null);
  const [current, setCurrent] = useState<AircraftRecord | null>(null);
  const [order, setOrder] = useState(100);
  const [aliases, setAliases] = useState('');
  const reload = useCallback(async () => {
    try {
      setRecords(await getAdminAircraftProfiles());
    } catch {
      setError('机型档案加载失败，请检查本地服务或管理员权限。');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  function open(record: AircraftRecord | null) {
    setCurrent(record);
    setDraft(record ? structuredClone(record.profile) : emptyAircraftProfile());
    setOrder(record?.display_order ?? 100);
    setAliases(record?.profile.aliases?.join('，') ?? '');
    setError('');
    setNotice('');
  }
  function update<K extends keyof AircraftProfile>(key: K, value: AircraftProfile[K]) {
    setDraft((previous) => (previous ? { ...previous, [key]: value } : previous));
  }
  function updateItem<K extends Exclude<Section, 'questions'>>(
    key: K,
    index: number,
    patch: Partial<AircraftProfile[K][number]>,
  ) {
    setDraft((previous) =>
      previous
        ? ({
            ...previous,
            [key]: previous[key].map((item, i) => (i === index ? { ...item, ...patch } : item)),
          } as AircraftProfile)
        : previous,
    );
  }
  function remove(key: Section, index: number) {
    setDraft((previous) =>
      previous
        ? ({ ...previous, [key]: previous[key].filter((_, i) => i !== index) } as AircraftProfile)
        : previous,
    );
  }
  async function save(status: AircraftRecord['status']) {
    if (!draft) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await saveAircraftProfile(
        {
          ...draft,
          aliases: aliases
            .split(/[,，\n]/)
            .map((v) => v.trim())
            .filter(Boolean),
        },
        status,
        order,
        current,
      );
      await reload();
      await onUpdated();
      setDraft(null);
      setNotice(
        status === 'published'
          ? '档案已保存并发布，前台已更新。'
          : '草稿已保存，普通读者看不到这份档案。',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const reference = (label: string, value: string, onChange: (value: string) => void) => (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">请选择来源</option>
        {draft?.sources.map((source, index) => (
          <option key={source.id} value={source.id}>
            {source.name || `来源 ${index + 1}`} · {source.title || '尚未填写标题'}
          </option>
        ))}
      </select>
    </label>
  );
  const removeButton = (key: Section, index: number, label: string) => (
    <button
      type="button"
      className="icon-button"
      aria-label={`删除${label}`}
      onClick={() => remove(key, index)}
    >
      <X size={16} />
    </button>
  );
  return (
    <div className="aircraft-editor">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {!draft ? (
        <>
          <div className="aircraft-editor-heading">
            <div>
              <h2>机型档案</h2>
              <p>先保存草稿，再核对来源与参数。已发布的档案会出现在新机追踪中。</p>
            </div>
            <button className="primary" onClick={() => open(null)}>
              <Plus size={15} />
              添加机型
            </button>
          </div>
          {loading ? (
            <p>正在读取档案…</p>
          ) : records.length ? (
            records.map((record) => (
              <article className="source-row" key={record.id}>
                <div>
                  <strong>{record.profile.name || record.id}</strong>
                  <p>
                    {record.profile.domain} · {record.profile.maker || '机构待填写'} ·{' '}
                    {record.profile.stage || '阶段待填写'}
                  </p>
                  <p>
                    {record.status === 'published' ? '已发布' : '草稿'} · 参数{' '}
                    {record.profile.specs.length} 项 · 资料核对{' '}
                    {record.profile.checkedAt || '待核对'}
                  </p>
                </div>
                <button className="secondary" onClick={() => open(record)}>
                  <Edit3 size={14} />
                  编辑 {record.profile.name || record.id}
                </button>
              </article>
            ))
          ) : (
            <p className="source-note">还没有机型档案，可以从一个有公开资料的型号开始。</p>
          )}
          {error && (
            <button className="secondary" onClick={() => void reload()}>
              重新加载档案
            </button>
          )}
        </>
      ) : (
        <form
          className="aircraft-profile-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save(current?.status ?? 'draft');
          }}
        >
          <div className="aircraft-editor-heading">
            <div>
              <h2>{current ? `编辑 ${current.profile.name || current.id}` : '添加机型档案'}</h2>
              <p>每项参数都要注明适用条件和来源，未知信息可以明确写“未公开”。</p>
            </div>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              <ArrowLeft size={15} />
              返回列表
            </button>
          </div>
          <fieldset disabled={busy} className="aircraft-editor-fields">
            <section>
              <h3>基础信息</h3>
              <div className="aircraft-form-grid">
                <Field
                  label="机型名称"
                  value={draft.name}
                  onChange={(value) => update('name', value)}
                />
                <Field
                  label="制造商或研究机构"
                  value={draft.maker}
                  onChange={(value) => update('maker', value)}
                />
                <label>
                  机型用途
                  <select
                    value={draft.domain}
                    onChange={(event) =>
                      update('domain', event.target.value as AircraftProfile['domain'])
                    }
                  >
                    {['民用', '军用', '实验'].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <Field
                  label="研制阶段"
                  value={draft.stage}
                  onChange={(value) => update('stage', value)}
                />
                <Field
                  label="资料核对日期"
                  type="date"
                  value={draft.checkedAt}
                  onChange={(value) => update('checkedAt', value)}
                />
                <label>
                  列表顺序（数字越小越靠前）
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={order}
                    onChange={(event) => setOrder(Number(event.target.value))}
                  />
                </label>
                <Field
                  label="网址名称（小写英文、数字或连字符）"
                  value={draft.id}
                  readOnly={!!current}
                  onChange={(value) => update('id', value)}
                />
                <Field
                  label="资讯匹配名称（可选，逗号分隔）"
                  value={aliases}
                  onChange={setAliases}
                />
              </div>
              <p className="source-note">
                机型名称会用于关联资讯；匹配名称最多 8
                个，填写型号或常见写法，避免只写制造商名称。档案的网址创建后保持不变。
              </p>
              <Field
                label="一句话介绍"
                value={draft.subtitle}
                onChange={(value) => update('subtitle', value)}
              />
              <Field
                label="档案介绍"
                multiline
                value={draft.summary}
                onChange={(value) => update('summary', value)}
              />
            </section>
            <section>
              <h3>原始来源</h3>
              <p className="source-note">
                先录入公开网页，再给参数与进展选择对应来源。没有发布日期的产品页可以留空。
              </p>
              {draft.sources.map((source, index) => (
                <fieldset className="aircraft-editor-card" key={source.id}>
                  <legend>来源 {index + 1}</legend>
                  {removeButton('sources', index, `来源 ${index + 1}`)}
                  <div className="aircraft-form-grid">
                    <Field
                      label="来源机构"
                      value={source.name}
                      onChange={(name) => updateItem('sources', index, { name })}
                    />
                    <Field
                      label="来源标题"
                      value={source.title}
                      onChange={(title) => updateItem('sources', index, { title })}
                    />
                    <Field
                      label="来源链接"
                      type="url"
                      value={source.url}
                      onChange={(url) => updateItem('sources', index, { url })}
                    />
                    <Field
                      label="来源发布日期（可选）"
                      type="date"
                      value={source.published ?? ''}
                      onChange={(published) => updateItem('sources', index, { published })}
                    />
                  </div>
                </fieldset>
              ))}
              <button
                type="button"
                className="secondary"
                disabled={draft.sources.length >= 20}
                onClick={() => {
                  const id = crypto.randomUUID();
                  update('sources', [...draft.sources, { id, name: '', title: '', url: '' }]);
                  if (!draft.latest.source) update('latest', { ...draft.latest, source: id });
                }}
              >
                <Plus size={14} />
                添加原始来源
              </button>
            </section>
            <section>
              <h3>参数与依据</h3>
              <p className="source-note">
                研制目标与厂家指标不等于试飞实测。发布前至少录入一项参数，并说明条件或资料限制。
              </p>
              {draft.specs.map((spec, index) => (
                <fieldset className="aircraft-editor-card" key={index}>
                  <legend>参数 {index + 1}</legend>
                  {removeButton('specs', index, `参数 ${index + 1}`)}
                  <div className="aircraft-form-grid">
                    <Field
                      label="参数项目"
                      value={spec.label}
                      onChange={(label) => updateItem('specs', index, { label })}
                    />
                    <Field
                      label="公开信息"
                      value={spec.value}
                      onChange={(value) => updateItem('specs', index, { value })}
                    />
                    <label>
                      参数依据
                      <select
                        value={spec.evidence}
                        onChange={(event) =>
                          updateItem('specs', index, {
                            evidence: event.target.value as typeof spec.evidence,
                          })
                        }
                      >
                        {evidenceTypes.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                    {reference('参数来源', spec.source, (source) =>
                      updateItem('specs', index, { source }),
                    )}
                  </div>
                  <Field
                    label="适用条件与说明"
                    multiline
                    value={spec.note}
                    onChange={(note) => updateItem('specs', index, { note })}
                  />
                </fieldset>
              ))}
              <button
                type="button"
                className="secondary"
                disabled={draft.specs.length >= 40}
                onClick={() =>
                  update('specs', [
                    ...draft.specs,
                    {
                      label: '',
                      value: '',
                      evidence: '官方公布',
                      note: '',
                      source: draft.sources[0]?.id ?? '',
                    },
                  ])
                }
              >
                <Plus size={14} />
                添加参数
              </button>
            </section>
            <section>
              <h3>最近一次档案进展</h3>
              <div className="aircraft-form-grid">
                <Field
                  label="进展标题"
                  value={draft.latest.title}
                  onChange={(title) => update('latest', { ...draft.latest, title })}
                />
                {reference('进展来源', draft.latest.source, (source) =>
                  update('latest', { ...draft.latest, source }),
                )}
                <Field
                  label="事件日期或时间范围"
                  value={draft.latest.eventDate}
                  onChange={(eventDate) => update('latest', { ...draft.latest, eventDate })}
                />
                <Field
                  label="消息发布日期"
                  type="date"
                  value={draft.latest.date}
                  onChange={(date) => update('latest', { ...draft.latest, date })}
                />
              </div>
              <Field
                label="进展说明"
                multiline
                value={draft.latest.summary}
                onChange={(summary) => update('latest', { ...draft.latest, summary })}
              />
            </section>
            <section>
              <h3>设计解读（可选）</h3>
              {draft.design.map((item, index) => (
                <fieldset className="aircraft-editor-card" key={index}>
                  <legend>解读 {index + 1}</legend>
                  {removeButton('design', index, `解读 ${index + 1}`)}
                  <Field
                    label="解读标题"
                    value={item.title}
                    onChange={(title) => updateItem('design', index, { title })}
                  />
                  <Field
                    label="解读说明"
                    multiline
                    value={item.text}
                    onChange={(text) => updateItem('design', index, { text })}
                  />
                  {reference('解读来源', item.source, (source) =>
                    updateItem('design', index, { source }),
                  )}
                </fieldset>
              ))}
              <button
                type="button"
                className="secondary"
                disabled={draft.design.length >= 20}
                onClick={() =>
                  update('design', [
                    ...draft.design,
                    { title: '', text: '', source: draft.sources[0]?.id ?? '' },
                  ])
                }
              >
                <Plus size={14} />
                添加设计解读
              </button>
            </section>
            <section>
              <h3>研制与试飞时间线（可选）</h3>
              {draft.timeline.map((item, index) => (
                <fieldset className="aircraft-editor-card" key={index}>
                  <legend>里程碑 {index + 1}</legend>
                  {removeButton('timeline', index, `里程碑 ${index + 1}`)}
                  <div className="aircraft-form-grid">
                    <Field
                      label="里程碑日期或时间范围"
                      value={item.date}
                      onChange={(date) => updateItem('timeline', index, { date })}
                    />
                    <Field
                      label="里程碑标题"
                      value={item.title}
                      onChange={(title) => updateItem('timeline', index, { title })}
                    />
                  </div>
                  <Field
                    label="里程碑说明"
                    multiline
                    value={item.text}
                    onChange={(text) => updateItem('timeline', index, { text })}
                  />
                  {reference('里程碑来源', item.source, (source) =>
                    updateItem('timeline', index, { source }),
                  )}
                </fieldset>
              ))}
              <button
                type="button"
                className="secondary"
                disabled={draft.timeline.length >= 40}
                onClick={() =>
                  update('timeline', [
                    ...draft.timeline,
                    { date: '', title: '', text: '', source: draft.sources[0]?.id ?? '' },
                  ])
                }
              >
                <Plus size={14} />
                添加里程碑
              </button>
            </section>
            <section>
              <h3>值得研究的问题（可选）</h3>
              {draft.questions.map((question, index) => (
                <fieldset className="aircraft-editor-card" key={index}>
                  <legend>问题 {index + 1}</legend>
                  {removeButton('questions', index, `问题 ${index + 1}`)}
                  <Field
                    label="研究问题"
                    multiline
                    value={question}
                    onChange={(value) =>
                      update(
                        'questions',
                        draft.questions.map((item, i) => (i === index ? value : item)),
                      )
                    }
                  />
                </fieldset>
              ))}
              <button
                type="button"
                className="secondary"
                disabled={draft.questions.length >= 12}
                onClick={() => update('questions', [...draft.questions, ''])}
              >
                <Plus size={14} />
                添加研究问题
              </button>
            </section>
          </fieldset>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="aircraft-editor-savebar">
            <span>
              {current?.status === 'published' ? '当前档案已发布' : '当前为草稿，普通读者不可见'}
              {demoMode ? ' · 预览不会保存' : ''}
            </span>
            <button type="submit" className="primary" disabled={busy}>
              <Save size={15} />
              {busy ? '正在保存…' : current?.status === 'published' ? '保存修改' : '保存草稿'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void save(current?.status === 'published' ? 'draft' : 'published')}
            >
              {current?.status === 'published' ? '转为草稿' : '发布档案'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
