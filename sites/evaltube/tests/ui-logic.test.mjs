import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchesSearch, filterVideos, sortVideos, relatedVideos,
  formatDuration, formatDate, formatViews, escapeHTML,
  toggleItem, validatePreferences, sourceInfo, topicNames,
} from '../public/lib.js';

const video = (overrides = {}) => ({
  vid: 'llm-example', title: 'A practical GPT introduction', channel: 'Andrej Karpathy',
  summary: 'Build a language model with attention and tokenization.', tags: ['transformers'],
  topics: ['llm', 'architecture'], content_type: 'lecture', level: 'intro',
  shelf_life: 'evergreen', score: 3, hn: { recommenders: 2, last_year: 2025 },
  duration_s: 1800, published: '2025-01-01T00:00:00Z', ...overrides,
});
const ids = xs => xs.map(v => v.vid);

test('Chinese aliases find the actual speaker and model terms; multiword searches require every term', () => {
  const v = video();
  assert.equal(matchesSearch(v, '卡帕西 大模型'), true);
  assert.equal(matchesSearch(v, '  ANDREJ   attention  '), true);
  assert.equal(matchesSearch(v, '分词'), true);
  assert.equal(matchesSearch(v, 'attention nonexistent'), false);
  assert.equal(matchesSearch(v, '蒸馏'), false);
  assert.equal(matchesSearch(v, '   '), true);
  const evaluation = video({ title: 'Testing failure modes', summary: 'Capabilities and limitations of GPT-4', topics: ['evaluation'] });
  assert.equal(matchesSearch(evaluation, '模型评测'), true);
  assert.equal(matchesSearch(evaluation, '评测 GPT-4'), true);
});

test('combined topic, content, level and shelf-life filters do not leak unrelated items', () => {
  const wanted = video({ vid: 'wanted', topics: ['evaluation'], level: 'advanced' });
  const all = [wanted,
    video({ vid: 'wrong-topic' }),
    video({ vid: 'wrong-format', topics: ['evaluation'], level: 'advanced', content_type: 'demo' }),
    video({ vid: 'wrong-level', topics: ['evaluation'] }),
    video({ vid: 'news', topics: ['evaluation'], level: 'advanced', shelf_life: 'news' }),
  ];
  assert.deepEqual(ids(filterVideos(all, { topic: 'evaluation', type: 'lecture', level: 'advanced', evergreen: true })), ['wanted']);
  assert.equal(all.length, 5);
});

test('duration ranges have unambiguous 20-minute and 60-minute boundaries and exclude unknown durations', () => {
  const all = [1199, 1200, 3599, 3600, null, 0, -1, NaN, undefined].map((duration_s, i) => video({ vid: String(i), duration_s }));
  assert.deepEqual(ids(filterVideos(all, { duration: 'short' })), ['0']);
  assert.deepEqual(ids(filterVideos(all, { duration: 'medium' })), ['1', '2']);
  assert.deepEqual(ids(filterVideos(all, { duration: 'long' })), ['3']);
  assert.equal(filterVideos(all).length, all.length, 'unknown durations remain discoverable without a duration filter');
});

test('history and dislikes affect discovery only when the corresponding filter is enabled', () => {
  const all = ['seen', 'disliked', 'fresh'].map(vid => video({ vid }));
  const prefs = { history: ['seen'], disliked: ['disliked'] };
  assert.deepEqual(ids(filterVideos(all, { hideSeen: true, hideDisliked: true }, prefs)), ['fresh']);
  assert.deepEqual(ids(filterVideos(all, {}, prefs)), ['seen', 'disliked', 'fresh']);
  assert.deepEqual(ids(filterVideos(all, { hideDisliked: true }, prefs)), ['seen', 'fresh']);
});

test('sorting returns a new array and places missing publication dates after real dates', () => {
  const all = [
    video({ vid: 'unknown', published: null, score: 100 }),
    video({ vid: 'old', published: '2020-01-01T00:00:00Z' }),
    video({ vid: 'invalid', published: 'not-a-date', score: 0 }),
    video({ vid: 'new', published: '2026-01-01T00:00:00Z' }),
  ];
  const snapshot = structuredClone(all);
  const sorted = sortVideos(all, 'published');
  assert.deepEqual(ids(sorted), ['new', 'old', 'unknown', 'invalid']);
  assert.notEqual(sorted, all);
  assert.deepEqual(all, snapshot);
});

test('recent HN sorting handles missing years and ties using community recommendations', () => {
  const all = [
    video({ vid: 'missing', hn: {}, score: 100 }),
    video({ vid: 'old', hn: { last_year: 2024 }, score: 20 }),
    video({ vid: 'new-low', hn: { last_year: 2026 }, score: 1 }),
    video({ vid: 'new-high', hn: { last_year: 2026 }, score: 4 }),
  ];
  assert.deepEqual(ids(sortVideos(all, 'recent')), ['new-high', 'new-low', 'old', 'missing']);
});

test('local likes modestly promote matching topics without overwhelming a much stronger HN recommendation', () => {
  const liked = video({ vid: 'liked', topics: ['training'], score: 0 });
  const all = [
    video({ vid: 'close-other', topics: ['llm'], score: 3.1 }),
    video({ vid: 'training-match', topics: ['training'], score: 3 }),
    video({ vid: 'established', topics: ['llm'], score: 20 }),
  ];
  assert.deepEqual(ids(sortVideos(all, 'recommended', { liked: ['liked'] }, [...all, liked])), ['established', 'training-match', 'close-other']);
  assert.deepEqual(ids(sortVideos(all)), ['established', 'close-other', 'training-match']);
});

test('related videos exclude the current ID, prioritize shared topics/tags, respect limit and preserve input order', () => {
  const current = video({ vid: 'current', topics: ['architecture'], tags: ['attention'] });
  const all = [
    current,
    video({ vid: 'unrelated', topics: ['agents'], tags: ['tools'], channel: 'Other' }),
    video({ vid: 'shared-topic', topics: ['architecture'], tags: [], channel: 'Other' }),
    video({ vid: 'best', topics: ['architecture'], tags: ['attention'], channel: 'Other' }),
    { ...current },
  ];
  const before = ids(all);
  assert.deepEqual(ids(relatedVideos(current, all, 2)), ['best', 'shared-topic']);
  assert.deepEqual(ids(all), before);
  assert.deepEqual(relatedVideos(current, [current]), []);
});

test('import discards unknown IDs, non-string payloads, extra settings and duplicates; likes win over dislikes', () => {
  const allow = new Set(['known', 'second']);
  const data = {
    version: 1,
    preferences: {
      liked: ['known', 'known', '<img src=x onerror=alert(1)>', { vid: 'second' }, 1],
      disliked: ['known', 'second', '__proto__'],
      later: ['second', 'unknown'], history: ['known', null], theme: '<script>alert(1)</script>',
    },
  };
  assert.deepEqual(validatePreferences(data, allow), {
    liked: ['known'], disliked: ['second'], later: ['second'], history: ['known'],
  });
  assert.equal(data.preferences.liked.length, 5, 'validation does not mutate the imported object');
});

test('import validates version and list shapes and bounds a large library to 500 entries', () => {
  assert.throws(() => validatePreferences(null, new Set()));
  assert.throws(() => validatePreferences({ version: 2, preferences: {} }, new Set()));
  assert.throws(() => validatePreferences({ version: 1, preferences: { liked: 'not-a-list' } }, new Set()));
  const values = Array.from({ length: 650 }, (_, i) => 'video-' + i);
  const result = validatePreferences({ version: 1, preferences: { history: values } }, new Set(values));
  assert.equal(result.history.length, 500);
  assert.equal(result.history[0], 'video-150');
  assert.equal(result.history.at(-1), 'video-649');
});

test('display helpers do not invent unavailable metadata and escape untrusted text', () => {
  assert.equal(formatDuration(null), '');
  assert.equal(formatDuration(NaN), '');
  assert.equal(formatDuration(3661), '1:01:01');
  assert.equal(formatDuration(1199), '19:59');
  assert.equal(formatDate('bad-date'), '');
  assert.equal(formatDate('2026-11-05T17:00:00Z'), '2026.11.06');
  assert.equal(formatViews(null), '');
  assert.equal(formatViews(0), '0 次播放');
  assert.equal(escapeHTML('<script x="a">&\'text\'</script>'), '&lt;script x=&quot;a&quot;&gt;&amp;&#39;text&#39;&lt;/script&gt;');
});

test('saving and unsaving preserves other library entries without mutating input', () => {
  const saved = ['first', 'second'];
  assert.deepEqual(toggleItem(saved, 'first'), ['second']);
  assert.deepEqual(toggleItem(saved, 'third'), ['first', 'second', 'third']);
  assert.deepEqual(saved, ['first', 'second']);
});

test('search, application reviews and agent evaluations are distinct channels; agent practice alone is not an evaluation', () => {
  const all = [
    video({ vid: 'search', topics: ['ai-search'] }),
    video({ vid: 'application', topics: ['app-evaluation'] }),
    video({ vid: 'agent-practice', topics: ['agents'] }),
    video({ vid: 'agent-test', topics: ['agents', 'agent-evaluation'] }),
    video({ vid: 'shared', topics: ['app-evaluation', 'agent-evaluation'] }),
  ];
  assert.deepEqual(ids(filterVideos(all, { topic: 'ai-search' })), ['search']);
  assert.deepEqual(ids(filterVideos(all, { topic: 'app-evaluation' })), ['application', 'shared']);
  assert.deepEqual(ids(filterVideos(all, { topic: 'agent-evaluation' })), ['agent-test', 'shared']);
  assert.deepEqual(ids(filterVideos(all, { topic: 'agents' })), ['agent-practice', 'agent-test']);
  for (const topic of ['ai-search', 'app-evaluation', 'agent-evaluation']) assert.ok(topicNames[topic]);
});

test('new channel queries support Chinese labels, compact aliases and RAG retrieval terms', () => {
  const search = video({ vid: 'search', title: 'Measuring retrieval and answer quality', topics: ['ai-search'], tags: ['RAG'] });
  const application = video({ vid: 'application', title: 'Hands-on product review', topics: ['app-evaluation'], tags: [] });
  const agent = video({ vid: 'agent-test', title: 'Testing task completion', topics: ['agent-evaluation'], tags: [] });
  const practice = video({ vid: 'agent-practice', title: 'Agent implementation walkthrough', topics: ['agents'], tags: [] });
  for (const query of ['AI 搜索', 'AI搜索', '检索', '检索增强', 'RAG']) assert.equal(matchesSearch(search, query), true, query);
  assert.equal(matchesSearch(application, '应用评测'), true);
  assert.equal(matchesSearch(agent, 'Agent评测'), true);
  assert.equal(matchesSearch(agent, 'Agent 评测'), true);
  assert.equal(matchesSearch(agent, '智能体评测'), true);
  assert.equal(matchesSearch(practice, 'Agent评测'), false);
  assert.equal(matchesSearch(practice, 'Agent 评测'), false);
  assert.equal(matchesSearch(application, 'AI搜索'), false);
  assert.deepEqual(ids(filterVideos([search, application, agent], { topic: 'ai-search', q: 'RAG' })), ['search']);
});

test('short search acronyms do not match substrings inside micrograd or autograd, and spaced channel labels retain their meaning', () => {
  const micrograd = video({
    vid: 'VMj-3S1tku0',
    title: 'The spelled-out intro to neural networks and backpropagation: building micrograd',
    summary: 'Build an automatic differentiation engine from scratch.',
    tags: ['autograd', 'backpropagation', 'neural networks'], topics: ['training'],
  });
  const rag = video({ vid: 'retrieval', title: 'Evaluate a RAG pipeline', summary: 'Measure retrieval and answer quality.', tags: ['RAG'], topics: ['ai-search'] });
  for (const query of ['RAG', 'rag', 'AI 搜索', 'AI   搜索']) {
    assert.equal(matchesSearch(micrograd, query), false, query);
    assert.equal(matchesSearch(rag, query), true, query);
    assert.deepEqual(ids(filterVideos([micrograd, rag], { q: query })), ['retrieval']);
  }
  const practice = video({
    vid: 'agent-tooling', title: 'Building an Agent evaluation harness',
    summary: 'Architecture walkthrough without task results.', tags: ['tools'], topics: ['agents'],
  });
  const evaluated = video({ vid: 'evaluated', title: 'Measured task completion', tags: [], topics: ['agent-evaluation'] });
  for (const query of ['Agent 评测', 'Agent   评测', 'Agent评测']) {
    assert.equal(matchesSearch(practice, query), false, query);
    assert.equal(matchesSearch(evaluated, query), true, query);
  }
});

test('editorial provenance never displays fabricated HN counts, even if an upstream record contains stale HN fields', () => {
  const curated = video({
    hn: null,
    url: 'https://www.youtube.com/watch?v=example1234',
    provenance: { kind: 'curated', sourceName: 'Original Publisher', sourceUrl: 'https://example.org/original', verifiedAt: '2026-11-06' },
  });
  const expected = { kind: 'curated', label: '编辑精选', detail: 'Original Publisher', verifiedAt: '2026.11.06', url: 'https://example.org/original' };
  assert.deepEqual(sourceInfo(curated), expected);
  assert.deepEqual(sourceInfo({ ...curated, hn: { recommenders: 99, mentions: 100 } }), expected);
  const missingSource = sourceInfo(video({ hn: null, provenance: undefined, url: curated.url }));
  assert.equal(missingSource.kind, 'curated');
  assert.equal(missingSource.label, '编辑精选');
  assert.equal(missingSource.detail, 'Andrej Karpathy');
  assert.equal(missingSource.verifiedAt, '');
});

test('editorial source links reject active, insecure and malformed URL schemes', () => {
  for (const sourceUrl of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'http://example.org/source', '//example.org/source', 'not a URL']) {
    const result = sourceInfo(video({ hn: null, provenance: { kind: 'curated', sourceUrl } }));
    assert.equal(result.url, '', sourceUrl);
  }
  const fallback = sourceInfo(video({ hn: null, provenance: { kind: 'curated' }, url: 'https://www.youtube.com/watch?v=example1234' }));
  assert.equal(fallback.url, 'https://www.youtube.com/watch?v=example1234');
});

test('HN source summaries distinguish actual recommendations from citations and preserve source attribution', () => {
  const recommended = sourceInfo(video({ vid: 'realHNvideo', hn: { recommenders: 4, mentions: 9, rec_months: 3, first_year: 2021, last_year: 2026 } }));
  assert.deepEqual(recommended, { kind: 'hacker-news', label: 'HN · 4 人推荐', detail: '3 个月被推荐 · 2021–2026', url: 'https://hackertube.org/watch/realHNvideo' });
  const cited = sourceInfo(video({ hn: { recommenders: 0, mentions: 2, rec_months: 0 } }));
  assert.equal(cited.label, 'HN · 2 次引用');
  assert.doesNotMatch(cited.label, /人推荐/);
});
