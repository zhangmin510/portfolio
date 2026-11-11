type Env = {
  ASSETS: Fetcher;
};

import { framework, meetingMap, sourceCards, timeline, verbLadder } from "./data";

type OfficialItem = {
  TITLE?: string;
  URL?: string;
  DOCRELPUBTIME?: string;
};

const SOURCES = {
  news: "https://www.gov.cn/yaowen/liebiao/YAOWENLIEBIAO.json",
  policy: "https://www.gov.cn/zhengce/zuixin/ZUIXINZHENGCE.json"
};

const MEETING_WORDS = [
  "会议", "两会", "全会", "政治局", "国务院常务", "座谈会", "新闻发布会", "吹风会", "工作会议"
];

const clean = (value = "") => value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();

function classify(title: string) {
  if (/党代会|全会/.test(title)) return { type: "定方向", tone: "战略" };
  if (/经济工作会议|两会|政府工作报告/.test(title)) return { type: "定基调", tone: "年度" };
  if (/政治局|财经委员会|深改委|座谈会/.test(title)) return { type: "定节奏", tone: "校准" };
  if (/国务院常务|国常会/.test(title)) return { type: "抓落实", tone: "执行" };
  if (/发布会|吹风会|答记者问/.test(title)) return { type: "释预期", tone: "沟通" };
  return { type: "政策文件", tone: "落地" };
}

function signalLevel(title: string) {
  if (/全面开展|全面实施|常态化/.test(title)) return 5;
  if (/确保|提速|加力/.test(title)) return 4;
  if (/加快|推动|促进|部署|实施/.test(title)) return 3;
  if (/支持|鼓励|引导/.test(title)) return 2;
  return 1;
}

async function fetchOfficial(url: string): Promise<OfficialItem[]> {
  const response = await fetch(url, {
    headers: { "User-Agent": "PolicyRadar/1.0 (+Cloudflare Worker; public information monitor)" },
    cf: { cacheTtl: 900, cacheEverything: true }
  });
  if (!response.ok) throw new Error(`Official source returned ${response.status}`);
  const data = await response.json<OfficialItem[]>();
  return Array.isArray(data) ? data : [];
}

function normalize(item: OfficialItem, sourceKind: "news" | "policy") {
  const title = clean(item.TITLE);
  const category = classify(title);
  return {
    title,
    url: item.URL || "https://www.gov.cn/",
    date: item.DOCRELPUBTIME || "",
    source: "中国政府网",
    sourceKind,
    type: category.type,
    tone: category.tone,
    signalLevel: signalLevel(title)
  };
}

async function livePayload() {
  const [newsResult, policyResult] = await Promise.allSettled([
    fetchOfficial(SOURCES.news),
    fetchOfficial(SOURCES.policy)
  ]);

  const news = newsResult.status === "fulfilled" ? newsResult.value : [];
  const policies = policyResult.status === "fulfilled" ? policyResult.value : [];
  const meetingItems = news
    .filter((item) => MEETING_WORDS.some((word) => clean(item.TITLE).includes(word)))
    .slice(0, 12)
    .map((item) => normalize(item, "news"));
  const policyItems = policies.slice(0, 12).map((item) => normalize(item, "policy"));
  const all = [...meetingItems, ...policyItems]
    .filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url) === index)
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    ok: all.length > 0,
    updatedAt: new Date().toISOString(),
    sourceUpdatedAt: all[0]?.date || null,
    meetingCount: meetingItems.length,
    policyCount: policyItems.length,
    items: all,
    sourceStatus: {
      news: newsResult.status,
      policy: policyResult.status
    }
  };
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=120, s-maxage=900",
    "access-control-allow-origin": "*",
    "x-content-type-options": "nosniff"
  }
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/api/live") {
      const cache = (caches as unknown as { default: Cache }).default;
      const cacheKey = new Request(`${url.origin}/api/live`, request);
      if (url.searchParams.get("fresh") !== "1") {
        const cached = await cache.match(cacheKey);
        if (cached) return cached;
      }

      try {
        const response = json(await livePayload());
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      } catch (error) {
        return json({ ok: false, error: "官方源暂时不可用，请稍后重试。" }, 503);
      }
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "中国政策雷达", time: new Date().toISOString() });
    }

    if (url.pathname === "/api/data") {
      return json({ meetingMap, timeline, framework, verbLadder, sourceCards });
    }

    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;
