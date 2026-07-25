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
    name: 'AI Native Workflow',
    tagline: '把 Agent 实践沉淀为可执行工作流',
    summary: '围绕可执行规范、持久化上下文与可编排行动的工作流实践。',
    role: '工作流设计与实现',
    outcome: '将 Specs、Agent、MCP 与上下文工程整合为持续演进的实践仓库。',
    stack: ['Specs', 'Agent', 'MCP', 'Context Engineering'],
    href: 'https://github.com/zhangmin510/ai-workflow',
    featured: true,
  },
  {
    name: 'IoTGW',
    tagline: '面向物联网应用的网关原型',
    summary: '物联网应用网关原型：设备接入、应用管理与感知数据过滤。',
    role: '原型系统设计与开发',
    outcome: '形成覆盖设备接入、应用管理和数据过滤的完整原型。',
    stack: ['Java', 'OSGi', 'IoT'],
    href: 'https://github.com/zhangmin510/IoTGW',
    featured: true,
  },
  {
    name: 'Fabric Console',
    tagline: '更轻量的 Hyperledger Fabric 桌面入口',
    summary: '跨平台的轻量级 Hyperledger Fabric 桌面客户端。',
    role: '桌面客户端设计与开发',
    outcome: '将常用 Fabric 操作封装为 Electron 桌面体验。',
    stack: ['Electron', 'Node.js', 'Hyperledger Fabric'],
    href: 'https://github.com/zhangmin510/fabric-console',
    featured: false,
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
