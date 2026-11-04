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

export const YEARLY_KEYWORDS = [
  { year: 2026, keywords: '认知 Agent MVP' },
  { year: 2025, keywords: '沟通 成长 Agent' },
  { year: 2024, keywords: '真行 传承 节奏' },
  { year: 2022, keywords: '家 突破 而立' },
  { year: 2021, keywords: '家 做时间的朋友 而立' },
  { year: 2020, keywords: '家 7 而立' },
] as const
