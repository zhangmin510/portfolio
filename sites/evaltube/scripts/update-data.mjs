#!/usr/bin/env node
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = 'https://hackertube.org';
const cache = path.join(tmpdir(), 'hackertube-ai-source');
const manifest = JSON.parse(await readFile(path.join(root, 'scripts/selection-manifest.json'), 'utf8'));
const supplemental = JSON.parse(await readFile(path.join(root, 'scripts/supplemental-videos.json'), 'utf8'));
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${name} requires a path`);
  return path.resolve(args[i + 1]);
};
const offline = flag('--offline');
const topics = [
  { id: 'llm', name: '大模型入门', description: '语言模型的原理、整体训练流程与能力概览。' },
  { id: 'architecture', name: '模型架构', description: 'Transformer、注意力、分词、嵌入与替代架构。' },
  { id: 'training', name: '训练与对齐', description: '神经网络基础、预训练、微调、RLHF 与缩放定律。' },
  { id: 'inference', name: '推理与使用', description: '模型采样、提示、API 使用与输出检测方法。' },
  { id: 'evaluation', name: '能力与评测', description: '具体任务实验、红队、失败案例和效果研究；包含演示与观察，不等同于标准化 benchmark。' },
  { id: 'ai-search', name: 'AI 搜索', description: 'AI 搜索、语义检索与 RAG，关注检索质量、相关性和回答依据。' },
  { id: 'app-evaluation', name: '应用评测', description: 'AI 产品与工具的实际工作流、效果研究、对比和局限；演示会明确标注。' },
  { id: 'agent-evaluation', name: 'Agent 评测', description: '用具体任务检查 Agent 的完成质量、可靠性与失败方式，不将架构介绍自动归入评测。' },
  { id: 'agents', name: 'Agent 与编程', description: '代码模型、工具调用、Agent 架构与实际任务验证。' },
  { id: 'multimodal', name: '多模态', description: '图文大模型与生成模型机制、能力及局限。' },
];
const parseLines = text => text.split(/\r?\n/).filter(Boolean).map((line, index) => {
  try { return JSON.parse(line); } catch { throw new Error(`Invalid JSONL at line ${index + 1}`); }
});
async function fetchText(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(90000),
    headers: { 'User-Agent': 'EvalTube-local/1.0 (+https://hackertube.org/about)' },
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}
async function source(name, url, override) {
  if (override) return readFile(override, 'utf8');
  if (offline) return readFile(path.join(cache, name), 'utf8');
  const text = await fetchText(url);
  return text;
}
function selectVideo(video) {
  const decision = manifest.include[video.vid];
  if (manifest.exclude[video.vid] || !decision) return null;
  return {
    ...video,
    hn: {
      ...video.hn,
      first: String(video.hn?.first_year ?? ''),
      last: String(video.hn?.last_year ?? ''),
      strong: video.hn?.strong_recs ?? 0,
    },
    quote: video.quote ? { ...video.quote, id: video.quote.hn_comment_id ?? video.quote.id } : null,
    duration_s: null,
    published: null,
    views: null,
    topics: decision.topics,
    selection_reason: decision.reason,
    provenance: { kind: 'hacker-news', sourceName: 'HackerTube / Hacker News', sourceUrl: `${base}/watch/${video.vid}` },
  };
}
function selectSupplemental(records, sourceIds) {
  if (!Array.isArray(records)) throw new Error('Supplemental catalog must be an array');
  const topicIds = new Set(topics.map(topic => topic.id));
  return records.map(record => {
    if (!/^[\w-]{11}$/.test(record.vid) || sourceIds.has(record.vid)) throw new Error(`Invalid or duplicate supplemental ID: ${record.vid}`);
    if (!record.title || !record.channel || !record.summary || !record.selection_reason || !record.topics?.length) throw new Error(`Incomplete supplemental record: ${record.vid}`);
    if (!record.topics.every(topic => topicIds.has(topic))) throw new Error(`Unknown supplemental topic: ${record.vid}`);
    const provenance = record.provenance;
    if (provenance?.kind !== 'curated' || !provenance.sourceName || !provenance.verifiedAt || !Number.isFinite(Date.parse(provenance.verifiedAt))) throw new Error(`Missing supplemental provenance: ${record.vid}`);
    if (new URL(provenance.sourceUrl).protocol !== 'https:') throw new Error(`Invalid supplemental source URL: ${record.vid}`);
    return {
      ...record,
      url: `https://www.youtube.com/watch?v=${record.vid}`,
      why_hn: '', hn: null, score: 0, quote: null,
      duration_s: null, published: null, views: null,
      tags: record.tags ?? [], categories: record.categories ?? [],
    };
  });
}
function needsReview(video) {
  if (manifest.include[video.vid] || manifest.exclude[video.vid]) return false;
  const llmCategory = video.categories?.some(c => c.id === 'llms-generative-ai');
  const text = [video.title, video.primary_topic, ...(video.tags ?? [])].join(' ');
  return llmCategory || /\b(?:llms?|language models?|rlhf|tokenization|gpt[- ]?[3456]|perplexity|retrieval[ -]augmented|semantic search|vector search|ai search|ai apps?|ai applications?|humane ai pin|rabbit r1|(?:ai|llm|coding|voice)[ -]agents?)\b/i.test(text);
}
function normalizeComment(comment) {
  return {
    id: comment.hn_comment_id,
    author: comment.author,
    ym: comment.month,
    story: comment.story_title,
    text: comment.text,
    stance: comment.stance,
    why: comment.why,
    url: comment.hn_url || `https://news.ycombinator.com/item?id=${comment.hn_comment_id}`,
  };
}
async function commitFiles(files) {
  // All network reads and validation finish before any previous dataset is replaced.
  await mkdir(path.join(root, 'data'), { recursive: true });
  const staged = [];
  try {
    for (const [name, text] of Object.entries(files)) {
      const destination = path.join(root, 'data', name);
      const temporary = `${destination}.${process.pid}.tmp`;
      await writeFile(temporary, text);
      staged.push([temporary, destination]);
    }
    for (const [temporary, destination] of staged) await rename(temporary, destination);
  } finally {
    await Promise.all(staged.map(([temporary]) => rm(temporary, { force: true })));
  }
}

try {
  const sourcePath = value('--source');
  const mentionPath = value('--mentions');
  const exportPath = value('--export');
  const docPath = value('--data-doc');
  const metadataPath = value('--metadata');
  const [videoText, mentionText, exportText, dataDoc] = await Promise.all([
    source('videos.jsonl', `${base}/download/videos.jsonl`, sourcePath),
    source('mentions.jsonl', `${base}/download/mentions.jsonl`, mentionPath),
    source('export.json', `${base}/api/export`, exportPath),
    source('DATA.md', `${base}/download/DATA.md`, docPath),
  ]);
  const sourceVideos = parseLines(videoText);
  const exportInfo = JSON.parse(exportText);
  if (!sourceVideos.length || !sourceVideos.every(v => /^[\w-]{11}$/.test(v.vid))) {
    throw new Error('Source video data is empty or malformed');
  }
  const hnVideos = sourceVideos.map(selectVideo).filter(Boolean);
  const curatedVideos = selectSupplemental(supplemental, new Set(sourceVideos.map(video => video.vid)));
  const videos = [...hnVideos, ...curatedVideos];
  const selectedIds = new Set(videos.map(v => v.vid));
  if (videos.length < 10) throw new Error('Refusing to replace catalog with fewer than 10 reviewed videos');
  if (selectedIds.size !== videos.length) throw new Error('Duplicate video IDs in source');
  const comments = Object.fromEntries(videos.map(v => [v.vid, []]));
  for (const comment of parseLines(mentionText)) {
    if (selectedIds.has(comment.vid)) comments[comment.vid].push(normalizeComment(comment));
  }
  for (const list of Object.values(comments)) list.sort((a, b) => b.ym.localeCompare(a.ym));
  const metadata = {};
  let metadataFetchedAt = null;
  if (metadataPath) {
    const saved = JSON.parse(await readFile(metadataPath, 'utf8'));
    Object.assign(metadata, saved.videos ?? saved);
    metadataFetchedAt = saved.fetchedAt ?? null;
  } else if (!flag('--no-metadata') && !offline) {
    // External selections have no HackerTube metadata endpoint. Keep their separately
    // verified local cache while refreshing only videos present in the HN source.
    try {
      const existing = JSON.parse(await readFile(path.join(root, 'data/youtube-metadata.local.json'), 'utf8'));
      for (const video of curatedVideos) if (existing.videos?.[video.vid]) metadata[video.vid] = existing.videos[video.vid];
    } catch { /* publisher metadata is optional */ }
    const ids = hnVideos.map(video => video.vid);
    for (let i = 0; i < ids.length; i += 30) {
      const docs = JSON.parse(await fetchText(`${base}/api/docs?vids=${ids.slice(i, i + 30).join(',')}`));
      if (!Array.isArray(docs)) throw new Error('Unexpected video metadata response');
      for (const doc of docs) {
        metadata[doc.vid] = {
          duration_s: Number.isFinite(doc.duration_s) ? doc.duration_s : null,
          published: doc.published ?? null,
          views: Number.isFinite(doc.views) ? doc.views : null,
        };
      }
    }
  } else if (offline && !flag('--no-metadata')) {
    try {
      const existing = JSON.parse(await readFile(path.join(root, 'data/youtube-metadata.local.json'), 'utf8'));
      Object.assign(metadata, existing.videos);
      metadataFetchedAt = existing.fetchedAt ?? null;
    } catch { /* metadata is optional for offline rebuilds */ }
  }
  for (const vid of Object.keys(metadata)) if (!selectedIds.has(vid)) delete metadata[vid];
  const reviewQueue = sourceVideos.filter(needsReview).map(v => ({ vid: v.vid, title: v.title, primary_topic: v.primary_topic, summary: v.summary }));
  const now = new Date().toISOString();
  let fetchedAt = now;
  if (offline) {
    try {
      const previous = JSON.parse(await readFile(path.join(root, 'data/catalog.json'), 'utf8'));
      fetchedAt = previous.meta.fetchedAt ?? now;
    } catch { /* first offline import: its import time is the only known time */ }
  }
  const catalog = {
    meta: {
      source: 'HackerTube',
      sourceUrl: `${base}/data`,
      sourceGeneratedAt: exportInfo.generated ?? exportInfo.generated_at ?? null,
      fetchedAt,
      builtAt: now,
      totalSourceVideos: sourceVideos.length,
      totalHnVideos: hnVideos.length,
      totalCuratedVideos: curatedVideos.length,
      totalVideos: videos.length,
      totalComments: Object.values(comments).reduce((n, list) => n + list.length, 0),
      filterVersion: manifest.version,
      reviewedAt: manifest.reviewedAt,
      policy: manifest.policy,
      pendingReview: reviewQueue.length,
      license: 'ODC-By-1.0',
      licenseScope: 'hacker-news records and HN comments only',
      curatedNotice: '外部编辑精选是独立编写的摘要与来源链接，不属于 HackerTube 开放导出；原视频权利属于其发布者。',
      attribution: [
        { name: 'HackerTube', url: base },
        { name: 'open-index/hacker-news', url: 'https://huggingface.co/datasets/open-index/hacker-news' },
      ],
      metadataFile: 'youtube-metadata.local.json',
      metadataNote: 'YouTube 元数据只保存在本地可选缓存，不属于开放数据导出。HN 视频与评论来自 HackerTube；外部编辑精选单独标注来源，不附加 HN 推荐证据。',
    },
    topics: topics.map(topic => ({ ...topic, count: videos.filter(v => v.topics.includes(topic.id)).length })),
    videos,
  };
  const json = object => JSON.stringify(object, null, 2) + '\n';
  const output = {
    'catalog.json': json(catalog),
    'comments.json': json(comments),
    'review-queue.json': json({ policy: '未经人工审查的新候选不会进入视频目录；审阅后编辑 scripts/selection-manifest.json。', videos: reviewQueue }),
    'DATA-LICENSE.md': dataDoc,
    'source-export.json': json(exportInfo),
  };
  if (Object.keys(metadata).length) output['youtube-metadata.local.json'] = json({ fetchedAt: metadataFetchedAt ?? now, source: 'Optional local metadata from HackerTube public endpoint and separately verified publisher sources', videos: metadata });
  if (!offline) {
    await mkdir(cache, { recursive: true });
    await Promise.all([
      writeFile(path.join(cache, 'videos.jsonl'), videoText),
      writeFile(path.join(cache, 'mentions.jsonl'), mentionText),
      writeFile(path.join(cache, 'export.json'), exportText),
      writeFile(path.join(cache, 'DATA.md'), dataDoc),
    ]);
  }
  await commitFiles(output);
  console.log(`Selected ${videos.length}/${sourceVideos.length} videos; ${catalog.meta.totalComments} HN comments; ${reviewQueue.length} candidates need review.`);
  console.log(`Catalog saved to ${path.join(root, 'data/catalog.json')}`);
} catch (error) {
  console.error(`Update failed; existing data was kept. ${error.message}`);
  process.exitCode = 1;
}
