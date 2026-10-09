import type { AircraftProfile, Evidence } from './aircraft';

export const evidenceTypes: Evidence[] = ['试飞实测', '官方公布', '厂家指标', '研制目标', '未公开'];

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('档案格式不完整。');
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number, required = false): string {
  if (value === undefined) value = '';
  if (typeof value !== 'string') throw new Error(`${label}格式不正确。`);
  const result = value.trim();
  if (required && !result) throw new Error(`请填写${label}。`);
  if (result.length > max) throw new Error(`${label}过长，请缩短。`);
  return result;
}

function list(value: unknown, max: number): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) throw new Error('档案条目过多或格式不正确。');
  return value;
}

function day(value: unknown, label: string, required = false) {
  const result = text(value, label, 10, required);
  if (
    result &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(result) ||
      !Number.isFinite(Date.parse(result)) ||
      new Date(result).toISOString().slice(0, 10) !== result)
  )
    throw new Error(`${label}不是有效日期。`);
  return result;
}

export function parseAircraftProfile(value: unknown, published = true): AircraftProfile {
  const input = object(value);
  const id = text(input.id, '网址名称', 64, true);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
    throw new Error('网址名称请使用小写英文、数字和连字符。');
  if (!['民用', '军用', '实验'].includes(String(input.domain))) throw new Error('请选择机型用途。');
  const sources = list(input.sources, 20).map((value) => {
    const source = object(value);
    const url = text(source.url, '来源链接', 1000, published);
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error();
      } catch {
        throw new Error('来源必须是有效的 HTTPS 网页链接，不能包含登录凭据。');
      }
    }
    return {
      id: text(source.id, '来源编号', 80, true),
      name: text(source.name, '来源机构', 120, published),
      title: text(source.title, '来源标题', 240, published),
      url,
      ...(source.published ? { published: day(source.published, '来源发布日期') } : {}),
    };
  });
  const refs = new Set(sources.map((source) => source.id));
  if (refs.size !== sources.length) throw new Error('来源重复，请检查。');
  const reference = (value: unknown) => {
    const result = text(value, '对应来源', 80);
    if (published && !refs.has(result))
      throw new Error('每项参数、设计解读和进展都需要选择一个有效来源。');
    return result;
  };
  const latest = object(input.latest);
  const specs = list(input.specs, 40).map((value) => {
    const spec = object(value);
    if (!evidenceTypes.includes(spec.evidence as Evidence))
      throw new Error('请选择有效的参数依据。');
    return {
      label: text(spec.label, '参数项目', 120, published),
      value: text(spec.value, '参数信息', 240, published),
      evidence: spec.evidence as Evidence,
      note: text(spec.note, '参数说明', 1200, published),
      source: reference(spec.source),
    };
  });
  if (published && (!sources.length || !specs.length))
    throw new Error('发布前至少添加一个来源和一项有依据的参数。');
  const result: AircraftProfile = {
    id,
    name: text(input.name, '机型名称', 120, published),
    subtitle: text(input.subtitle, '一句话介绍', 240, published),
    domain: input.domain as AircraftProfile['domain'],
    maker: text(input.maker, '制造商或研究机构', 160, published),
    stage: text(input.stage, '研制阶段', 120, published),
    checkedAt: day(input.checkedAt, '资料核对日期', published),
    aliases: list(input.aliases, 8).map((value) => text(value, '资讯匹配名称', 80, true)),
    summary: text(input.summary, '档案介绍', 2000, published),
    latest: {
      title: text(latest.title, '进展标题', 240, published),
      date: day(latest.date, '消息发布日期', published),
      eventDate: text(latest.eventDate, '事件日期或时间范围', 80, published),
      summary: text(latest.summary, '进展说明', 2000, published),
      source: reference(latest.source),
    },
    specs,
    design: list(input.design, 20).map((value) => {
      const item = object(value);
      return {
        title: text(item.title, '设计解读标题', 240, published),
        text: text(item.text, '设计解读', 2000, published),
        source: reference(item.source),
      };
    }),
    questions: list(input.questions, 12).map((value) => text(value, '研究问题', 400, published)),
    timeline: list(input.timeline, 40).map((value) => {
      const item = object(value);
      return {
        date: text(item.date, '里程碑日期或时间范围', 80, published),
        title: text(item.title, '里程碑标题', 240, published),
        text: text(item.text, '里程碑说明', 2000, published),
        source: reference(item.source),
      };
    }),
    sources,
  };
  if (new TextEncoder().encode(JSON.stringify(result)).length > 54_000)
    throw new Error('档案内容过长，请缩短说明。');
  return result;
}

export function emptyAircraftProfile(): AircraftProfile {
  return {
    id: '',
    name: '',
    subtitle: '',
    domain: '实验',
    maker: '',
    stage: '',
    checkedAt: new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
    summary: '',
    aliases: [],
    latest: { title: '', date: '', eventDate: '', summary: '', source: '' },
    specs: [],
    design: [],
    questions: [],
    timeline: [],
    sources: [],
  };
}
