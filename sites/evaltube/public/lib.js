export const topicNames = {
  evaluation: '模型评测', 'ai-search': 'AI 搜索', 'app-evaluation': '应用评测', 'agent-evaluation': 'Agent 评测',
  llm: '大模型入门', architecture: '架构原理', training: '训练与对齐', inference: '推理与使用', agents: 'Agent 技术', multimodal: '多模态'
};
export const topicDescriptions = {
  llm: '语言模型从哪里来，又是如何工作的。', architecture: '理解 Transformer、注意力与模型内部机制。',
  training: '从神经网络基础、预训练到对齐与强化学习。', inference: '模型采样、提示、使用与输出检测。',
  evaluation: '通过实验和能力分析，看清模型能做什么、还做不好什么。', agents: '工具调用、编码助手与 Agent 的实际表现。',
  'ai-search': 'AI 搜索、检索增强生成 RAG，以及检索与回答质量评估。',
  'app-evaluation': 'AI 应用和产品在真实任务中的体验、效果、效率与失败案例。',
  'agent-evaluation': '通过任务完成、代码验证和可复现实验，评估 Agent 的可靠性。',
  multimodal: '大模型对图像、语音与跨模态信息的理解。'
};
const aliases = { '大模型': 'llm language model gpt', '语言模型': 'language model llm', '评测': 'evaluation benchmark capabilities limitations', '测评': 'evaluation benchmark capabilities', '搜索': 'search retrieval rag', '检索': 'retrieval rag', 'ai搜索': 'ai-search', '应用评测': 'app-evaluation', 'agent评测': 'agent-evaluation', '智能体评测': 'agent-evaluation', '检索增强': 'rag retrieval', '训练': 'training pretraining', '微调': 'fine tuning finetuning', '推理': 'inference reasoning', '注意力': 'attention', '分词': 'tokenizer tokenization', '蒸馏': 'distillation', '幻觉': 'hallucination', '智能体': 'agent', '提示词': 'prompt', '多模态': 'multimodal', '开源': 'open source', '神经网络': 'neural network', '强化学习': 'reinforcement learning rlhf', '卡帕西': 'karpathy' };
export const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function searchable(v) { return [v.title, v.channel, v.summary, v.primary_topic, ...(v.tags || []), ...(v.topics || []).flatMap(t => [t, topicNames[t], topicDescriptions[t]]), v.selection_reason].join(' ').toLowerCase(); }
export function matchesSearch(v, query) {
  const haystack = searchable(v);
  const normalized = query.trim().toLowerCase().replace(/ai\s*搜索/g,'ai搜索').replace(/agent\s*评测/g,'agent评测');
  return normalized.split(/\s+/).filter(Boolean).every(term => {
    const terms = [term, ...(aliases[term]?.split(' ') || [])];
    return terms.some(token => /^[a-z0-9]{1,3}$/.test(token) ? new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`).test(haystack) : haystack.includes(token));
  });
}
export function filterVideos(videos, params = {}, prefs = {}) {
  const seen = new Set(prefs.history || []);
  const disliked = new Set(prefs.disliked || []);
  return videos.filter(v => {
    if (params.topic && !v.topics?.includes(params.topic)) return false;
    if (params.q && !matchesSearch(v, params.q)) return false;
    if (params.type && v.content_type !== params.type) return false;
    if (params.level && v.level !== params.level) return false;
    if (params.evergreen && v.shelf_life !== 'evergreen') return false;
    if (params.hideSeen && seen.has(v.vid)) return false;
    if (params.hideDisliked && disliked.has(v.vid)) return false;
    if (params.duration) {
      if (!Number.isFinite(v.duration_s) || v.duration_s <= 0) return false;
      if (params.duration === 'short' && v.duration_s >= 1200) return false;
      if (params.duration === 'medium' && (v.duration_s < 1200 || v.duration_s >= 3600)) return false;
      if (params.duration === 'long' && v.duration_s < 3600) return false;
    }
    return true;
  });
}
export function sortVideos(videos, sort = 'recommended', prefs = {}, allVideos = videos) {
  const liked = new Set(prefs.liked || []);
  const weights = {};
  allVideos.filter(v => liked.has(v.vid)).forEach(v => v.topics?.forEach(t => weights[t] = (weights[t] || 0) + 1));
  const recommendation = v => (Number(v.score) || 0) + Math.min(3, (v.topics || []).reduce((sum,t) => sum + (weights[t] || 0), 0) * .4);
  return videos.slice().sort((a,b) => {
    if (sort === 'published') return (Date.parse(b.published) || 0) - (Date.parse(a.published) || 0) || recommendation(b)-recommendation(a);
    if (sort === 'recent') return (Number(b.hn?.last_year) || 0) - (Number(a.hn?.last_year) || 0) || recommendation(b)-recommendation(a);
    if (sort === 'duration') return (b.duration_s || 0) - (a.duration_s || 0) || recommendation(b)-recommendation(a);
    return recommendation(b)-recommendation(a) || (b.hn?.recommenders || 0)-(a.hn?.recommenders || 0) || a.vid.localeCompare(b.vid);
  });
}
export function relatedVideos(video, videos, limit = 10) {
  const tags = new Set(video.tags || []);
  const relevance = v => (v.topics || []).filter(t => video.topics?.includes(t)).length * 4 + (v.tags || []).filter(t => tags.has(t)).length * 2 + (v.channel === video.channel ? 1 : 0) + (Number(v.score) || 0) / 50;
  return videos.filter(v => v.vid !== video.vid).sort((a,b) => relevance(b)-relevance(a)).slice(0,limit);
}
export function formatDuration(s) {
  if (!Number.isFinite(s) || s <= 0) return '';
  s = Math.floor(s);
  const hours = Math.floor(s/3600), mins = Math.floor(s%3600/60), secs = String(s%60).padStart(2,'0');
  return hours ? `${hours}:${String(mins).padStart(2,'0')}:${secs}` : `${mins}:${secs}`;
}
export function formatDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  return new Date(value).toLocaleDateString('zh-CN', { timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit' }).replaceAll('/','.');
}
export function formatViews(n) { if (n == null || !Number.isFinite(n)) return ''; return n >= 1e8 ? `${(n/1e8).toFixed(1)} 亿次播放` : n >= 1e4 ? `${(n/1e4).toFixed(1)} 万次播放` : `${n.toLocaleString('zh-CN')} 次播放`; }
export function sourceInfo(video) {
  if (video.provenance?.kind === 'curated' || !video.hn) {
    const source = video.provenance || {};
    const candidate = source.sourceUrl || video.url;
    let url = '';
    try { const parsed = new URL(candidate); if (parsed.protocol === 'https:') url = parsed.href; } catch {}
    return { kind: 'curated', label: '编辑精选', detail: source.sourceName || video.channel || '原始发布者', verifiedAt: formatDate(source.verifiedAt), url };
  }
  const hn = video.hn;
  const label = hn.recommenders > 0 ? `${hn.recommenders} 人推荐` : `${hn.mentions || 0} 次引用`;
  return { kind: 'hacker-news', label: `HN · ${label}`, detail: `${hn.rec_months || 0} 个月被推荐 · ${hn.first_year || ''}–${hn.last_year || ''}`, url: `https://hackertube.org/watch/${video.vid}` };
}
export function toggleItem(items, id) { return items.includes(id) ? items.filter(x => x !== id) : [...items, id]; }
export function validatePreferences(input, ids) {
  if (!input || input.version !== 1 || !input.preferences) throw new Error('请选择 EvalTube 导出的收藏文件');
  const clean = {};
  for (const key of ['liked','disliked','later','history']) {
    const value = input.preferences[key];
    if (value != null && !Array.isArray(value)) throw new Error('收藏文件格式不正确');
    clean[key] = [...new Set((value || []).filter(id => typeof id === 'string' && ids.has(id)))].slice(-500);
  }
  clean.disliked = clean.disliked.filter(id => !clean.liked.includes(id));
  return clean;
}
