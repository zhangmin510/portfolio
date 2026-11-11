import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('data/catalog.json', root)));
const comments = JSON.parse(await readFile(new URL('data/comments.json', root)));
const ids = new Set(catalog.videos.map(v => v.vid));
const topics = new Set(catalog.topics.map(t => t.id));

test('catalog references distinct real source videos and declared topics', () => {
  assert.ok(catalog.meta.totalSourceVideos >= catalog.videos.length);
  assert.equal(catalog.meta.totalVideos, catalog.videos.length);
  assert.equal(ids.size, catalog.videos.length);
  assert.ok(ids.size >= 30);
  for (const video of catalog.videos) {
    assert.match(video.vid, /^[\w-]{11}$/);
    assert.equal(video.url, `https://www.youtube.com/watch?v=${video.vid}`);
    assert.ok(video.title && video.summary && video.selection_reason);
    assert.ok(video.topics.length);
    for (const topic of video.topics) assert.ok(topics.has(topic));
    assert.ok(Number.isFinite(video.score));
  }
});

test('scope keeps concrete LLM experiments and excludes unrelated AI content', () => {
  for (const vid of ['qbIk7-JPB2c', 'outcGtbnMuQ', 'EL7Au1tzNxE', '5KKDCp3OaMo', 'tNmgmwEtoWE']) {
    assert.ok(catalog.videos.find(v => v.vid === vid)?.topics.includes('evaluation'), vid);
  }
  for (const vid of ['GVT3WUa-48Y', 'IkaAZE_UGMo', '7k1ehaE0bdU', 'WXuK6gekU1Y', '22wlLy7hKP4', 'jvqFAi7vkBc', 'ebls5x-gb0s']) {
    assert.ok(!ids.has(vid), `Unrelated content was included: ${vid}`);
  }
});

test('expanded topics distinguish practical AI application reviews from Agent task evaluation', () => {
  const find = id => catalog.videos.find(video => video.vid === id);
  assert.ok(find('TitZV6k8zfA').topics.includes('app-evaluation'));
  assert.ok(find('Ly6USRwTHe0').topics.includes('app-evaluation'));
  assert.equal(find('Ly6USRwTHe0').content_type, 'demo');
  for (const id of ['EL7Au1tzNxE', 'GJVSDjRXVoo', 'tNmgmwEtoWE']) assert.ok(find(id).topics.includes('agent-evaluation'));
  assert.ok(!find('RjfbvDXpFls').topics.includes('agent-evaluation'), 'Agent architecture is not automatically an evaluation');
  assert.ok(!find('FHwnrYm0mNc').topics.includes('agent-evaluation'), 'Code completion testing is not automatically autonomous Agent testing');
  assert.ok(!find('TitZV6k8zfA').topics.includes('agent-evaluation'), 'AI hardware reviews are not automatically Agent task tests');
});

test('editorial AI search selections cite verified sources and never invent HN evidence', () => {
  const curated = catalog.videos.filter(video => video.provenance?.kind === 'curated');
  assert.equal(catalog.meta.totalCuratedVideos, curated.length);
  assert.equal(catalog.meta.totalHnVideos + curated.length, catalog.videos.length);
  assert.ok(curated.some(video => video.topics.includes('ai-search')));
  for (const video of curated) {
    assert.equal(new URL(video.provenance.sourceUrl).protocol, 'https:');
    assert.ok(video.provenance.sourceName);
    assert.ok(Number.isFinite(Date.parse(video.provenance.verifiedAt)));
    assert.equal(video.hn, null);
    assert.equal(video.score, 0);
    assert.equal(video.why_hn, '');
    assert.equal(video.quote, null);
    assert.equal((comments[video.vid] || []).length, 0);
  }
});

test('comments stay attached to selected videos and their original HN references', () => {
  let count = 0;
  for (const [vid, list] of Object.entries(comments)) {
    assert.ok(ids.has(vid));
    const seen = new Set();
    for (const comment of list) {
      assert.ok(Number.isInteger(comment.id) && comment.id > 0);
      assert.ok(!seen.has(comment.id));
      seen.add(comment.id);
      assert.match(comment.ym, /^\d{4}-\d{2}$/);
      assert.ok(comment.author && comment.text);
      assert.equal(comment.url, `https://news.ycombinator.com/item?id=${comment.id}`);
      count++;
    }
  }
  assert.equal(count, catalog.meta.totalComments);
  assert.ok(count > 100);
});

test('open export preserves attribution and separates YouTube metadata', () => {
  assert.equal(catalog.meta.license, 'ODC-By-1.0');
  assert.ok(catalog.meta.attribution.some(a => a.name === 'HackerTube'));
  assert.ok(catalog.meta.attribution.some(a => a.name === 'open-index/hacker-news'));
  assert.ok(!Number.isNaN(Date.parse(catalog.meta.fetchedAt)));
  for (const video of catalog.videos) {
    assert.equal(video.duration_s, null);
    assert.equal(video.published, null);
    assert.equal(video.views, null);
  }
});

test('optional local metadata has valid durations and publication dates', async () => {
  let local;
  try { local = JSON.parse(await readFile(new URL('data/youtube-metadata.local.json', root))); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const [vid, metadata] of Object.entries(local.videos)) {
    assert.ok(ids.has(vid));
    if (metadata.duration_s !== null) assert.ok(Number.isInteger(metadata.duration_s) && metadata.duration_s > 0);
    if (metadata.views !== null) assert.ok(Number.isInteger(metadata.views) && metadata.views >= 0);
    if (metadata.published !== null) assert.ok(!Number.isNaN(Date.parse(metadata.published)));
  }
});

test('failed updates preserve the existing catalog and comments', async () => {
  const files = ['data/catalog.json', 'data/comments.json'];
  const before = await Promise.all(files.map(file => readFile(new URL(file, root), 'utf8')));
  const result = spawnSync(process.execPath, [
    new URL('scripts/update-data.mjs', root).pathname,
    '--offline', '--source', new URL('tests/does-not-exist.jsonl', root).pathname,
  ], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /existing data was kept/);
  const after = await Promise.all(files.map(file => readFile(new URL(file, root), 'utf8')));
  assert.deepEqual(after, before);
});
