const REPOSITORY = 'zhangmin510/portfolio';
const ISSUES_API = `https://api.github.com/repos/${REPOSITORY}/issues`;
const MAX_BODY_BYTES = 32 * 1024;
const GITHUB_TIMEOUT_MS = 8_000;
const INVALID_FORMAT = '反馈格式有误，请检查标题和正文。';
const TOO_LARGE = '反馈内容超出大小限制。';
const UNAVAILABLE = '反馈暂时不可用，请稍后再试。';
const UNCONFIRMED = '暂时无法确认反馈提交结果。';

function json(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
  });
}

async function readFeedback(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
    return { error: TOO_LARGE, status: 413 };
  }

  const reader = request.body?.getReader();
  if (!reader) return { error: INVALID_FORMAT, status: 400 };

  let data;
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytesRead = 0;
    let text = '';

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { error: TOO_LARGE, status: 413 };
      }
      text += decoder.decode(value, { stream: true });
    }

    data = JSON.parse(text + decoder.decode());
  } catch {
    return { error: INVALID_FORMAT, status: 400 };
  } finally {
    reader.releaseLock();
  }

  if (!data || typeof data.title !== 'string' || typeof data.message !== 'string') {
    return { error: INVALID_FORMAT, status: 400 };
  }

  const title = data.title.replace(/\s+/gu, ' ').trim();
  const message = data.message.replace(/\r\n?/g, '\n').trim();
  const titleLength = [...title].length;
  const messageLength = [...message].length;
  if (titleLength < 3 || titleLength > 80 || messageLength < 5 || messageLength > 2_000) {
    return { error: '反馈标题需为 3–80 字，正文需为 5–2000 字。', status: 400 };
  }

  const invisibleControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
  if (invisibleControls.test(title) || invisibleControls.test(message)) {
    return { error: '反馈包含无法显示的控制字符，请修改后提交。', status: 400 };
  }
  return { title, message };
}

function neutralizeIssueLinks(text) {
  return text.replaceAll('@', '＠').replaceAll('#', '＃');
}

function rateLimitKey(request) {
  const clientIp = request.headers.get('CF-Connecting-IP');
  // Only the Cloudflare edge header contributes to the anonymous request bucket.
  return `feedback:${clientIp && /^[\da-f.:]{1,45}$/i.test(clientIp) ? clientIp : 'unknown'}`;
}

async function createIssue(token, title, message) {
  // Indent every user line so Markdown syntax is preserved as literal feedback.
  const literal = neutralizeIssueLinks(message).split('\n').map(line => `    ${line}`).join('\n');
  const response = await fetch(ISSUES_API, {
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'stack-town-feedback',
      'X-GitHub-Api-Version': '2026-03-10',
    },
    body: JSON.stringify({
      title: `[栈城反馈] ${neutralizeIssueLinks(title)}`,
      body: `来自《栈城日常》的匿名反馈。\n\n${literal}`,
    }),
  });

  if (response.status !== 201) {
    console.warn('Guest feedback: GitHub rejected issue creation', { status: response.status });
    await response.body?.cancel().catch(() => undefined);
    return null;
  }

  const result = await response.json();
  const number = result?.number;
  if (Number.isSafeInteger(number) && number > 0) {
    const issueUrl = `https://github.com/${REPOSITORY}/issues/${number}`;
    if (result.html_url === issueUrl) return issueUrl;
  }
  console.warn('Guest feedback: GitHub did not return a valid issue link');
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/feedback') {
      return env.ASSETS?.fetch(request) ?? new Response('未找到页面。', { status: 404 });
    }

    const available = Boolean(env.GITHUB_ISSUES_TOKEN?.trim()) && typeof env.FEEDBACK_RATE_LIMITER?.limit === 'function';
    if (request.method === 'GET') return json({ available });
    if (request.method !== 'POST') {
      return json({ message: '此接口支持查询和提交反馈。' }, 405, { Allow: 'GET, POST' });
    }
    if (request.headers.get('Origin') !== url.origin) {
      return json({ message: '请在《栈城日常》网页内提交反馈。' }, 403);
    }
    if (!available) return json({ message: UNAVAILABLE }, 503);

    const [contentType] = (request.headers.get('Content-Type') ?? '').split(';', 1);
    if (contentType.trim().toLowerCase() !== 'application/json') {
      return json({ message: '请使用 JSON 格式提交反馈。' }, 415);
    }

    const input = await readFeedback(request);
    if ('error' in input) return json({ message: input.error }, input.status);

    try {
      const { success } = await env.FEEDBACK_RATE_LIMITER.limit({ key: rateLimitKey(request) });
      if (success !== true) return json({ message: '反馈提交过于频繁，请稍后再试。' }, 429);
    } catch {
      return json({ message: UNAVAILABLE }, 503);
    }

    try {
      const issueUrl = await createIssue(env.GITHUB_ISSUES_TOKEN.trim(), input.title, input.message);
      if (issueUrl) return json({ issueUrl }, 201);
    } catch (error) {
      // An upstream timeout can happen after GitHub accepted the request.
      console.warn('Guest feedback: GitHub request did not complete', { type: error instanceof Error ? error.name : 'Unknown' });
    }
    return json({ message: UNCONFIRMED }, 502);
  },
};
