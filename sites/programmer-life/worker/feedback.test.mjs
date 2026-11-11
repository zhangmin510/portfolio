import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './feedback.mjs';

const ORIGIN = 'https://stack-town.example';
const API = `${ORIGIN}/api/feedback`;
const ISSUE_URL = 'https://github.com/zhangmin510/portfolio/issues/123';
const CLIENT_IP = '203.0.113.7';
const TOKEN = 'test-only-token';

function environment(overrides = {}) {
  return {
    GITHUB_ISSUES_TOKEN: TOKEN,
    FEEDBACK_RATE_LIMITER: { limit: async () => ({ success: true }) },
    ...overrides,
  };
}

function submit(payload, headers = {}) {
  return new Request(API, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
}

const feedback = { title: '建议改进地图', message: '希望可以在地图上显示地铁站。' };
const unexpectedFetch = async () => { throw new Error('unexpected upstream request'); };

test('同源提交只向固定仓库发送文字，处理提及和 Markdown 后返回 Issue 地址', async (t) => {
  const limit = t.mock.fn(async () => ({ success: true }));
  const upstream = t.mock.method(globalThis, 'fetch', async () => Response.json({ number: 123, html_url: ISSUE_URL }, { status: 201 }));
  const request = submit({
    title: '  测试 @some-team #9  ',
    message: '  第一句\r\n```\r\n@everyone https://example.test #7\n```  ',
    repository: 'other/repo',
  }, { 'CF-Connecting-IP': CLIENT_IP, 'X-Forwarded-For': '198.51.100.18' });
  const response = await worker.fetch(request, environment({ FEEDBACK_RATE_LIMITER: { limit } }));

  assert.equal(response.status, 201);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { issueUrl: ISSUE_URL });
  assert.deepEqual(limit.mock.calls[0].arguments, [{ key: `feedback:${CLIENT_IP}` }]);
  assert.equal(upstream.mock.callCount(), 1);
  const [target, options] = upstream.mock.calls[0].arguments;
  assert.equal(target, 'https://api.github.com/repos/zhangmin510/portfolio/issues');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(options.redirect, 'manual');
  assert.ok(options.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(options.body), {
    title: '[栈城反馈] 测试 ＠some-team ＃9',
    body: '来自《栈城日常》的匿名反馈。\n\n    第一句\n    ```\n    ＠everyone https://example.test ＃7\n    ```',
  });
  assert.equal(options.body.includes(CLIENT_IP), false);
});

test('缺失来源和其他站点的 POST 不会访问限流绑定或 GitHub', async (t) => {
  const upstream = t.mock.method(globalThis, 'fetch', unexpectedFetch);
  const limit = t.mock.fn();
  const env = environment({ FEEDBACK_RATE_LIMITER: { limit } });
  const missingOrigin = submit(feedback);
  missingOrigin.headers.delete('Origin');

  for (const request of [missingOrigin, submit(feedback, { Origin: 'https://another.example' })]) {
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 403);
    assert.match((await response.json()).message, /网页内提交/);
  }
  assert.equal(limit.mock.callCount(), 0);
  assert.equal(upstream.mock.callCount(), 0);
});

test('校验请求类型、JSON、字段长度和流式大小上限', async (t) => {
  const upstream = t.mock.method(globalThis, 'fetch', unexpectedFetch);
  const limit = t.mock.fn();
  const env = environment({ FEEDBACK_RATE_LIMITER: { limit } });
  const malformed = new Request(API, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: '{"title":' });
  const streamed = new Request(API, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(32 * 1024 + 1)); controller.close(); } }),
    duplex: 'half',
  });

  for (const [request, status] of [
    [submit(feedback, { 'Content-Type': 'text/plain' }), 415],
    [malformed, 400],
    [submit({ title: '好', message: '短' }), 400],
    [submit({ title: '长'.repeat(81), message: feedback.message }), 400],
    [submit({ title: feedback.title, message: '长'.repeat(2_001) }), 400],
    [submit({ title: feedback.title, message: '反馈正文含控制字符\u0000' }), 400],
    [submit(feedback, { 'Content-Length': '32769' }), 413],
    [streamed, 413],
  ]) {
    const response = await worker.fetch(request, env);
    assert.equal(response.status, status);
    assert.equal(typeof (await response.json()).message, 'string');
  }
  assert.equal(limit.mock.callCount(), 0);
  assert.equal(upstream.mock.callCount(), 0);
});

test('缺少配置时健康检查为不可用，非 API 路径交给静态资源', async (t) => {
  const assets = t.mock.fn(async () => new Response('static asset'));
  const env = environment({ GITHUB_ISSUES_TOKEN: undefined, ASSETS: { fetch: assets } });
  const health = await worker.fetch(new Request(API), env);
  assert.deepEqual(await health.json(), { available: false });
  assert.deepEqual(await (await worker.fetch(new Request(API), environment())).json(), { available: true });
  assert.equal((await worker.fetch(submit(feedback), env)).status, 503);
  const unsupported = await worker.fetch(new Request(API, { method: 'PUT' }), env);
  assert.equal(unsupported.status, 405);
  assert.equal(unsupported.headers.get('Allow'), 'GET, POST');
  const asset = new Request(`${ORIGIN}/assets/index.js`);
  assert.equal(await (await worker.fetch(asset, env)).text(), 'static asset');
  assert.deepEqual(assets.mock.calls[0].arguments, [asset]);
});

test('限流拒绝或异常时不创建 Issue', async (t) => {
  const upstream = t.mock.method(globalThis, 'fetch', unexpectedFetch);
  const denied = await worker.fetch(submit(feedback), environment({ FEEDBACK_RATE_LIMITER: { limit: async () => ({ success: false }) } }));
  assert.equal(denied.status, 429);
  const unavailable = await worker.fetch(submit(feedback), environment({ FEEDBACK_RATE_LIMITER: { limit: async () => { throw new Error(TOKEN); } } }));
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.text()).includes(TOKEN), false);
  assert.equal(upstream.mock.callCount(), 0);
});

test('上游重定向、响应地址异常、拒绝或超时时，不透传其响应或凭证', async (t) => {
  const upstream = t.mock.method(globalThis, 'fetch', async () => { throw new DOMException(TOKEN, 'TimeoutError'); });
  upstream.mock.mockImplementationOnce(async () => Response.json({ number: 123, html_url: 'https://github.com/other/repo/issues/123' }, { status: 201 }), 0);
  upstream.mock.mockImplementationOnce(async () => Response.json({ error: TOKEN }, { status: 403 }), 1);
  upstream.mock.mockImplementationOnce(async () => Response.redirect('https://example.test/elsewhere'), 2);
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await worker.fetch(submit(feedback), environment());
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.deepEqual(Object.keys(body), ['message']);
    assert.equal(body.message.includes(TOKEN), false);
  }
  assert.equal(upstream.mock.callCount(), 4);
});
