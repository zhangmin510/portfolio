export const TOPICS = { models: '模型能力', search: 'AI 搜索', apps: 'AI 应用', agents: 'Agent' };
export const STATUSES = { supported: '有证据支持', partial: '部分支持', refuted: '被证据反驳', pending: '尚待观察' };
export const RELATIONS = { supports: '支持线索', context: '范围与条件', challenges: '反向线索' };
export function todaySingapore() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }); }
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function date(value, label) { if (!validDate(value)) throw new Error(`${label}必须是有效的 YYYY-MM-DD 日期`); return value; }
function text(value, label, max = 3000) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`${label}不能为空且不能超过 ${max} 字符`);
  return value.trim();
}
export function safeUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('来源链接必须是完整 HTTPS 地址'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('来源链接必须使用 HTTPS 且不能包含凭据');
  return url.href;
}
function source(value, fallbackDate, maxDate) {
  if (!value || typeof value !== 'object') throw new Error('请填写原始来源');
  const result = { title: text(value.title, '来源标题', 500), publisher: text(value.publisher, '发布者', 200), url: safeUrl(value.url), date: date(value.date || fallbackDate, '来源日期') };
  if (result.date > maxDate) throw new Error('来源日期不能晚于所记录的主张或证据日期');
  return result;
}
export function validateClaim(input, options = {}) {
  const now = options.today || todaySingapore();
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('档案格式不正确');
  const originalDate = date(input.date, '主张日期');
  const verifiedAt = date(input.verifiedAt || now, '核验日期');
  if (originalDate > now || verifiedAt > now || verifiedAt < originalDate) throw new Error('请检查主张日期与核验日期，不能引用未来资料');
  if (!Object.hasOwn(TOPICS, input.topic)) throw new Error('请选择有效领域');
  if (!Array.isArray(input.evidence) || input.evidence.length > 100) throw new Error('证据应为不超过 100 条的数组');
  if (!Array.isArray(input.assessments) || input.assessments.length > 100) throw new Error('人工判断应为不超过 100 条的数组');
  const seenEvidence = new Set();
  const evidence = input.evidence.map(e => {
    const id = text(e.id || crypto.randomUUID(), '证据 ID', 100);
    if (seenEvidence.has(id)) throw new Error('证据 ID 不能重复');
    seenEvidence.add(id);
    const evidenceDate = date(e.date, '证据日期');
    if (evidenceDate < originalDate || evidenceDate > verifiedAt) throw new Error('后续证据日期应在主张日期与核验日期之间');
    if (!Object.hasOwn(RELATIONS, e.relation)) throw new Error('证据关系无效');
    return { id, date: evidenceDate, relation: e.relation, title: text(e.title, '证据标题', 500), summary: text(e.summary, '证据摘要'), source: source(e.source, evidenceDate, evidenceDate) };
  });
  const seenAssessments = new Set();
  const assessments = input.assessments.map(a => {
    const id = text(a.id || crypto.randomUUID(), '判断 ID', 100);
    if (seenAssessments.has(id)) throw new Error('判断 ID 不能重复');
    seenAssessments.add(id);
    if (!Object.hasOwn(STATUSES, a.status)) throw new Error('人工判断状态无效');
    const assessmentDate = date(a.date, '判断日期');
    if (assessmentDate < originalDate || assessmentDate > verifiedAt) throw new Error('判断日期应在主张日期与核验日期之间');
    if (!Array.isArray(a.basisEvidenceIds) || a.basisEvidenceIds.some(id => !seenEvidence.has(id))) throw new Error('人工判断引用了不存在的证据');
    if (a.status !== 'pending' && !a.basisEvidenceIds.length) throw new Error('明确的判断至少需要一条证据');
    const basisEvidenceIds = [...new Set(a.basisEvidenceIds)];
    if (basisEvidenceIds.some(id => evidence.find(e => e.id === id).date > assessmentDate)) throw new Error('人工判断不能早于所依据的证据');
    return { id, date: assessmentDate, status: a.status, summary: text(a.summary, '判断说明'), caveat: typeof a.caveat === 'string' ? a.caveat.trim().slice(0, 3000) : '', basisEvidenceIds, author: text(a.author || '本地编辑', '判断作者', 100) };
  });
  return {
    id: text(input.id || crypto.randomUUID(), '档案 ID', 100), title: text(input.title, '标题', 300),
    topic: input.topic, organization: text(input.organization, '机构或作者', 200), date: originalDate,
    claim: text(input.claim, '原始主张摘要'), scope: typeof input.scope === 'string' ? input.scope.trim().slice(0, 3000) : '',
    source: source(input.source, originalDate, originalDate), verifiedAt,
    evidence: evidence.sort((a, b) => a.date.localeCompare(b.date)), assessments: assessments.sort((a, b) => a.date.localeCompare(b.date)),
    origin: options.origin || (input.origin === 'seed' ? 'seed' : 'custom')
  };
}
export function revisionDay(savedAt) {
  return new Date(savedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });
}
// Publication dates govern archive visibility; local edits must not rewrite older views.
export function materializeAsOf(store, asOf) {
  const records = new Map(store.claims.map(c => [c.id, c]));
  for (const revision of [...store.revisions].reverse()) {
    if (revisionDay(revision.savedAt) > asOf && revision.previous) records.set(revision.claimId, revision.previous);
  }
  return [...records.values()];
}
export function projectAsOf(claim, asOf = todaySingapore()) {
  date(asOf, '回看日期');
  if (claim.date > asOf) return null;
  const evidence = claim.evidence.filter(e => e.date <= asOf);
  const available = new Set(evidence.map(e => e.id));
  const assessments = claim.assessments.filter(a => a.date <= asOf && a.basisEvidenceIds.every(id => available.has(id)));
  const assessment = assessments.at(-1) || null;
  return { ...claim, evidence, assessments, assessment, status: assessment?.status || 'pending', asOf };
}
export function filterArchive(claims, { asOf = todaySingapore(), topic = '', status = '', q = '', own = false, sort = 'newest' } = {}) {
  if (!validDate(asOf)) throw new Error('回看日期无效');
  const query = String(q).trim().toLowerCase();
  return claims.map(c => projectAsOf(c, asOf)).filter(Boolean).filter(c =>
    (!topic || c.topic === topic) && (!status || c.status === status) && (!own || c.origin === 'custom') &&
    (!query || [c.title, c.claim, c.organization, TOPICS[c.topic], ...c.evidence.flatMap(e => [e.title, e.summary])].join(' ').toLowerCase().includes(query))
  ).sort((a, b) => (sort === 'oldest' ? 1 : -1) * a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
export function validateImport(payload, options = {}) {
  const records = Array.isArray(payload) ? payload : payload?.version === 1 ? payload.claims : null;
  if (!Array.isArray(records) || records.length > 1000 || !records.length) throw new Error('请导入包含 1–1000 条档案的数组或 version:1 导出文件');
  const claims = records.map(c => validateClaim(c, { ...options, origin: 'custom' }));
  if (new Set(claims.map(c => c.id)).size !== claims.length) throw new Error('导入文件存在重复档案 ID');
  return claims;
}
