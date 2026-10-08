export const CATEGORIES = ['空气动力学', '飞机设计', '实验飞行器', '模拟与游戏', '开源工具'];
const tracking = /^(utm_|fbclid$|gclid$|si$|spm_id_from$|vd_source$)/i;

export function canonicalUrl(value) {
  const u = new URL(value);
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password)
    throw new Error('只接受公开网页链接');
  u.hash = '';
  if (u.hostname === 'youtu.be')
    return canonicalUrl(`https://www.youtube.com/watch?v=${u.pathname.slice(1)}`);
  if (
    ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(u.hostname) &&
    u.pathname === '/watch'
  ) {
    const id = u.searchParams.get('v');
    if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) throw new Error('YouTube 视频链接无效');
    return `https://www.youtube.com/watch?v=${id}`;
  }
  for (const key of [...u.searchParams.keys()]) if (tracking.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  return u.href.replace(/\/$/, '');
}

export function plainText(value, limit = 6000) {
  return String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(?:\d+|x[0-9a-f]+);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function hash64(text) {
  let h = 14695981039346656037n;
  for (const ch of text) {
    h ^= BigInt(ch.codePointAt(0));
    h = BigInt.asUintN(64, h * 1099511628211n);
  }
  return h;
}

export function simhash(title) {
  const chars = Array.from(
    plainText(title)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, ''),
  );
  if (chars.length < 8) return null;
  const counts = new Array(64).fill(0);
  const grams = new Set(chars.slice(0, -2).map((_, i) => chars.slice(i, i + 3).join('')));
  for (const gram of grams) {
    const h = hash64(gram);
    for (let bit = 0; bit < 64; bit++) counts[bit] += h & (1n << BigInt(bit)) ? 1 : -1;
  }
  let result = 0n;
  counts.forEach((n, i) => {
    if (n > 0) result |= 1n << BigInt(i);
  });
  return result.toString(16).padStart(16, '0');
}

export function hamming(a, b) {
  if (!a || !b) return 64;
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`),
    count = 0;
  while (x) {
    count++;
    x &= x - 1n;
  }
  return count;
}

export function nearDuplicate(title, fingerprint, existing) {
  if (!fingerprint) return false;
  const length = Array.from(title).length;
  return existing.some(
    (a) =>
      a.title_simhash &&
      Math.min(length, a.original_title.length) / Math.max(length, a.original_title.length) > 0.8 &&
      hamming(fingerprint, a.title_simhash) <= 3,
  );
}

export function validateAnalysis(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('模型返回格式无效');
  for (const key of ['title', 'summary', 'why_it_matters', 'moderation_reason'])
    if (typeof raw[key] !== 'string') throw new Error('模型字段不完整');
  if (!CATEGORIES.includes(raw.category)) throw new Error('模型主题无效');
  for (const key of ['quality_score', 'relevance', 'confidence'])
    if (typeof raw[key] !== 'number' || !Number.isFinite(raw[key])) throw new Error('模型评分无效');
  if (
    raw.quality_score < 0 ||
    raw.quality_score > 10 ||
    raw.relevance < 0 ||
    raw.relevance > 1 ||
    raw.confidence < 0 ||
    raw.confidence > 1
  )
    throw new Error('模型评分越界');
  if (!['safe', 'review', 'reject'].includes(raw.moderation)) throw new Error('缺少内容审核结果');
  if (!raw.title.trim() || !raw.summary.trim() || !raw.why_it_matters.trim())
    throw new Error('摘要为空');
  if (!Array.isArray(raw.tags) || raw.tags.some((t) => typeof t !== 'string'))
    throw new Error('模型标签无效');
  return {
    title: raw.title.trim().slice(0, 160),
    summary: raw.summary.trim().slice(0, 1200),
    why_it_matters: raw.why_it_matters.trim().slice(0, 500),
    category: raw.category,
    tags: raw.tags.slice(0, 5).map((t) => t.slice(0, 24)),
    quality_score: raw.quality_score,
    relevance: raw.relevance,
    confidence: raw.confidence,
    moderation: raw.moderation,
    moderation_reason: raw.moderation_reason.slice(0, 500),
  };
}

export function publicationStatus(analysis, inputLength) {
  if (analysis.moderation === 'reject') return 'rejected';
  if (
    analysis.moderation !== 'safe' ||
    analysis.confidence < 0.85 ||
    analysis.relevance < 0.7 ||
    analysis.quality_score < 6 ||
    inputLength < 80
  )
    return 'pending';
  return 'published';
}

export function estimateCost(usage, rates) {
  return (
    (Number(usage?.prompt_tokens ?? 0) * rates.input +
      Number(usage?.completion_tokens ?? 0) * rates.output) /
    1_000_000
  );
}
