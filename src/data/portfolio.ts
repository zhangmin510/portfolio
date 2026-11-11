export interface Project {
  name: string
  tagline: string
  summary: string
  role: string
  outcome: string
  stack: string[]
  href: string
  featured: boolean
}

export const PROFILE = {
  name: 'ZhangMin.name',
  title: 'AI Engineer',
  location: 'Hangzhou, China',
  motto: '行胜于言',
  focus: ['AI Native', 'Backend', 'Distributed Systems'],
  intro:
    '我把认知、规范与工具沉淀为可执行的工作流，也持续通过开源项目，把想法做成真正可用的产品和 MVP。',
  introEn:
    'I build practical AI systems, evaluation workflows, agent tooling, and distributed applications.',
  github: 'https://github.com/zhangmin510',
  website: 'https://zhangmin.name',
} as const

export const SKILL_GROUPS = [
  {
    name: 'AI & Agent',
    items: [
      'AI 应用评测',
      'AI Native Workflow',
      'Agent & MCP',
      'Spec-Driven Development',
      'Context Engineering',
    ],
  },
  {
    name: 'Backend & Systems',
    items: [
      'Java',
      'TypeScript',
      'Swift',
      'Node.js',
      '分布式系统',
      '微服务',
      'IoT / OSGi',
    ],
  },
] as const

export const PROJECTS: Project[] = [
  {
    name: 'Frontier Benchmarks',
    tagline: '一站掌握前沿模型评测',
    summary: '面向 OpenAI 与 Anthropic 前沿模型的中文 benchmark 聚合站。',
    role: '独立研究、设计与实现',
    outcome: '系统整理 23 个 benchmark，覆盖推理、软件工程、智能体、深度研究等七类能力。',
    stack: ['Next.js 16', 'React 19', 'TypeScript', 'Tailwind CSS'],
    href: 'https://github.com/zhangmin510/frontier-benchmarks',
    featured: true,
  },
  {
    name: 'MeetingCopter',
    tagline: '让会议提醒真正无法忽略',
    summary: 'macOS 菜单栏会议提醒：会前让红色直升机飞过屏幕。',
    role: '独立设计与实现',
    outcome: '完成可运行的 macOS 15 MVP，并开放完整源码。',
    stack: ['Swift 6', 'macOS 15', 'Calendar'],
    href: 'https://github.com/zhangmin510/MeetingCopter',
    featured: true,
  },
  {
    name: 'obsidian-podium',
    tagline: '把现有 Markdown 笔记直接变成演示文稿',
    summary: 'Obsidian 幻灯片插件：将 Markdown 笔记一键全屏演示，无需改写格式。',
    role: '插件设计与开发',
    outcome: '支持自适应分页、长内容续页、原生渲染与激光笔、画笔和荧光笔批注。',
    stack: ['Obsidian', 'JavaScript', 'Markdown', 'esbuild'],
    href: 'https://github.com/zhangmin510/obsidian-podium',
    featured: true,
  },
]

export const WEBSITES = [
  {
    slug: 'panoramas',
    name: '全景图',
    label: '知识地图',
    summary: '浏览技术、产业与学习主题的全景图总览。',
    href: 'https://zhangmin.name/panoramas/',
  },
  {
    slug: 'eval-quest',
    name: '评测探索局',
    label: '游戏式评测学习',
    summary: '从度量衡到 AI 智能体：12 关知识地图、24 道情境挑战、4 个实验与全书阅读。',
    href: 'https://zhangmin.name/panoramas/eval-quest/',
  },
  {
    slug: 'evalfrontier',
    name: '评测前沿',
    label: '模型与 Agent 评测',
    summary: '查看大模型、Agent 与应用评测的基准、结果和来源。',
    href: 'https://b.zhangmin.name/',
  },
  {
    slug: 'evaltube',
    name: 'EvalTube',
    label: 'AI 评测视频',
    summary: '聚焦模型、AI 搜索、应用与 Agent 的评测视频。',
    href: 'https://evaltube.zhangmin.name/',
  },
  {
    slug: 'evalpapers',
    name: 'EvalPapers',
    label: '评测论文',
    summary: '围绕模型、AI 搜索、应用与 Agent，搜索论文、收藏阅读清单并发现相关研究。',
    href: 'https://evalpapers.zhangmin.name/',
  },
  {
    slug: 'timecapsule',
    name: 'AI Time Capsule',
    label: 'AI 历史档案',
    summary: '把 AI 产品的原始主张与后续证据放回时间线，按日期回看并整理自己的判断。',
    href: 'https://timecapsule.zhangmin.name/',
  },
  {
    slug: 'autoeval',
    name: 'AutoEval',
    label: '检索实验',
    summary: '在固定数据上比较 RAG 检索配置，记录真实指标、保留改进并导出实验报告。',
    href: 'https://autoeval.zhangmin.name/',
  },
  {
    slug: 'programmer-life',
    name: '栈城日常',
    label: '程序员生活模拟',
    summary: '在三维城市里体验程序员的一天，安排通勤、工作和休息。',
    href: 'https://programmer-life.zhangmin.workers.dev/',
  },
  {
    slug: 'weight-space',
    name: '权重实验室',
    label: '模型权重与推理',
    summary: '逐张量查看 Qwen3.5-0.8B 的权重和补丁，用 1 + 1 跟踪逐 token 推理。',
    href: 'https://weights.zhangmin.name/',
  },
] as const

export const YEARLY_KEYWORDS = [
  { year: 2026, keywords: '认知 Agent MVP' },
  { year: 2025, keywords: '沟通 成长 Agent' },
  { year: 2024, keywords: '真行 传承 节奏' },
  { year: 2022, keywords: '家 突破 而立' },
  { year: 2021, keywords: '家 做时间的朋友 而立' },
  { year: 2020, keywords: '家 7 而立' },
] as const
