import { validateClaim, validateImport, filterArchive, projectAsOf, materializeAsOf, revisionDay, todaySingapore, validDate } from './archive-domain.mjs';

const STORAGE_KEY = 'ai-time-capsule.archive.v1';
// The same validation and historical projection as the Node repository; no personal
// archive is sent to Cloudflare. Re-read inside a lock to preserve other tabs' edits.
export function createBrowserArchive({ seed, storage, lock = action => action() }) {
  const initial = { version: 1, claims: seed.claims.map(c => validateClaim(c, { origin: 'seed' })), revisions: [] };
  function load() {
    let raw;
    try { raw = storage.getItem(STORAGE_KEY); } catch { throw new Error('浏览器存储不可用，请允许本站保存数据后重试。'); }
    if (!raw) return structuredClone(initial);
    let value;
    try {
      value = JSON.parse(raw);
      if (value.version !== 1 || !Array.isArray(value.claims) || !Array.isArray(value.revisions)) throw new Error();
      value.claims = value.claims.map(c => validateClaim(c));
      value.revisions = value.revisions.map(r => {
        if (typeof r.savedAt !== 'string' || Number.isNaN(Date.parse(r.savedAt)) || !['create','edit','import'].includes(r.action)) throw new Error();
        return { ...r, previous: r.previous ? validateClaim(r.previous) : null, current: validateClaim(r.current) };
      });
      return value;
    } catch { throw new Error('浏览器档案数据无法读取，原始存储已保留；请从浏览器备份恢复。'); }
  }
  function commit(store) {
    const raw = JSON.stringify(store);
    if (new TextEncoder().encode(raw).length > 4_000_000) throw new Error('浏览器档案已接近存储上限，请先导出备份。此次修改未保存。');
    try { storage.setItem(STORAGE_KEY, raw); } catch { throw new Error('浏览器存储空间不足或被禁用。此次修改未保存，请先导出备份。'); }
  }
  function parseBody(options) {
    if (typeof options.body !== 'string' || new TextEncoder().encode(options.body).length > 2_000_000) throw new Error('导入或保存内容不能超过 2 MB');
    try { return JSON.parse(options.body); } catch { throw new Error('内容不是有效 JSON'); }
  }
  async function request(path, options = {}) {
    const url = new URL(path, 'https://timecapsule.invalid');
    const method = options.method || 'GET';
    const mutate = !['GET', 'HEAD'].includes(method);
    return lock(() => {
      const store = load();
      const asOf = url.searchParams.get('asOf') || todaySingapore();
      if (!validDate(asOf) || asOf > todaySingapore()) throw new Error('回看日期应为有效日期且不能晚于今天');
      const historical = materializeAsOf(store, asOf);
      if (url.pathname === '/api/claims' && method === 'GET') {
        const params = Object.fromEntries(url.searchParams); params.asOf = asOf; params.own = params.own === 'true';
        const claims = filterArchive(historical, params);
        return { asOf, claims, total: filterArchive(historical, { asOf }).length, evidenceCount: claims.reduce((n, c) => n + c.evidence.length, 0) };
      }
      if (url.pathname === '/api/export' && method === 'GET') return { version: 1, exportedAt: new Date().toISOString(), asOf, claims: filterArchive(historical, { asOf }) };
      if (url.pathname === '/api/import' && method === 'POST') {
        const records = validateImport(parseBody(options));
        for (const claim of records) {
          const index = store.claims.findIndex(c => c.id === claim.id);
          const previous = index >= 0 ? store.claims[index] : null;
          if (index >= 0) store.claims[index] = claim; else store.claims.push(claim);
          store.revisions.push({ id: crypto.randomUUID(), claimId: claim.id, savedAt: new Date().toISOString(), action: 'import', previous, current: claim });
        }
        commit(store); return { imported: records.length };
      }
      const match = url.pathname.match(/^\/api\/claims\/([^/]+)(\/history)?$/);
      const id = match && decodeURIComponent(match[1]);
      if ((url.pathname === '/api/claims' && method === 'POST') || (match && !match[2] && method === 'PUT')) {
        const input = parseBody(options);
        const previous = method === 'PUT' ? store.claims.find(c => c.id === id) : null;
        if (method === 'PUT' && !previous) throw new Error('找不到要编辑的档案');
        const claim = validateClaim({ ...input, id: previous?.id || input.id }, { origin: previous?.origin || 'custom' });
        if (!previous && store.claims.some(c => c.id === claim.id)) throw new Error('档案 ID 已存在');
        if (previous) store.claims[store.claims.findIndex(c => c.id === previous.id)] = claim; else store.claims.push(claim);
        store.revisions.push({ id: crypto.randomUUID(), claimId: claim.id, savedAt: new Date().toISOString(), action: previous ? 'edit' : 'create', previous, current: claim });
        commit(store); return { claim: projectAsOf(claim) };
      }
      if (match && method === 'GET') {
        const claim = historical.find(c => c.id === id);
        const projected = claim && projectAsOf(claim, asOf);
        if (!projected) throw new Error('该回看时点没有这条档案');
        if (match[2]) return { revisions: store.revisions.filter(r => r.claimId === id && revisionDay(r.savedAt) <= asOf).map(r => ({ ...r, previous: r.previous && projectAsOf(r.previous, asOf), current: projectAsOf(r.current, asOf) })) };
        return { claim: projected };
      }
      throw new Error(mutate ? '不支持的本地修改操作' : '档案路径不存在');
    });
  }
  return { request };
}
