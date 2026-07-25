const ASCII_LOGO = `
<span class="ascii-art desktop-logo">
  ████████╗███████╗██████╗ ███╗   ███╗██╗███╗   ██╗ █████╗ ██╗
  ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║████╗  ██║██╔══██╗██║
     ██║   █████╗  ██████╔╝██╔████╔██║██║██╔██╗ ██║███████║██║
     ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║██║╚██╗██║██╔══██║██║
     ██║   ███████╗██║  ██║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║███████╗
     ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝
</span><span class="ascii-art mobile-logo">
  ╭────────────────────╮
  │  ZHANGMIN.NAME     │
  │  AI ENGINEER       │
  ╰────────────────────╯
</span>`

const NEOFETCH = `
<span class="ascii-art">        .--.        </span>   <span class="highlight">zhangmin</span>@<span class="accent">portfolio</span>
<span class="ascii-art">       |o_o |       </span>   ─────────────────
<span class="ascii-art">       |:_/ |       </span>   <span class="highlight">Name:</span> ZhangMin.name
<span class="ascii-art">      //   \\ \\      </span>   <span class="highlight">Role:</span> AI Engineer
<span class="ascii-art">     (|     | )     </span>   <span class="highlight">Location:</span> Hangzhou
<span class="ascii-art">    /'\\_   _/\`\\     </span>   <span class="highlight">Focus:</span> AI Application Evaluation
<span class="ascii-art">    \\___)=(___/     </span>   <span class="highlight">Stack:</span> Java / TypeScript / Swift / Node.js
                       <span class="highlight">Motto:</span> 行胜于言
                       <span class="highlight">GitHub:</span> zhangmin510
                       <span class="highlight">Viewport:</span> ${window.innerWidth}x${window.innerHeight}
`

const ABOUT = `
<span class="section-header">关于我 / About Me</span>

  你好，我是 <span class="highlight">ZhangMin.name</span>。

  🧑‍💻 AI 工程师 / AI Engineer
  📍 杭州 / Hangzhou
  🎯 AI 应用评测 · AI Native 工作流 · 分布式系统开发

  我关注如何把认知、规范与工具沉淀为可执行的工作流，
  也持续通过开源项目，把想法做成真正可用的产品和 MVP。

  I build practical AI systems, evaluation workflows,
  agent tooling, and distributed system applications.

  <span class="dim">“行胜于言” / Actions speak louder than words.</span>
`

const SKILLS = `
<span class="section-header">能力方向 / Focus & Stack</span>

  <span class="accent">AI & Agent</span>
    AI 应用评测 · AI Native Workflow · Agent · MCP
    Spec-Driven Development · 持久化上下文 · 可编排行动

  <span class="accent">Backend & Systems</span>
    Java · TypeScript · Swift · Node.js
    分布式系统开发 · 微服务 · IoT / OSGi · GitHub API

  <span class="dim">不使用虚构的技能百分比；这里展示的是持续实践的方向。</span>
`

const PROJECTS = `
<span class="section-header">代表项目 / Selected Projects</span>

  <span class="highlight">01.</span> <span class="bold">MeetingCopter</span>
      <span class="dim">macOS 菜单栏会议提醒：会前让红色直升机飞过屏幕</span>
      <span class="accent">Tech:</span> Swift 6 · macOS 15 · Calendar
      <a class="link" href="https://github.com/zhangmin510/MeetingCopter" target="_blank" rel="noopener noreferrer">→ github.com/zhangmin510/MeetingCopter</a>

  <span class="highlight">02.</span> <span class="bold">AI Native Workflow</span>
      <span class="dim">围绕可执行规范、持久化上下文与可编排行动的工作流实践</span>
      <span class="accent">Focus:</span> Specs · Agent · MCP · Context Engineering
      <a class="link" href="https://github.com/zhangmin510/ai-workflow" target="_blank" rel="noopener noreferrer">→ github.com/zhangmin510/ai-workflow</a>

  <span class="highlight">03.</span> <span class="bold">IoTGW</span>
      <span class="dim">物联网应用网关原型：设备接入、应用管理与感知数据过滤</span>
      <span class="accent">Tech:</span> Java · OSGi · IoT
      <a class="link" href="https://github.com/zhangmin510/IoTGW" target="_blank" rel="noopener noreferrer">→ github.com/zhangmin510/IoTGW</a>

  <span class="highlight">04.</span> <span class="bold">Fabric Console</span>
      <span class="dim">跨平台的轻量级 Hyperledger Fabric 桌面客户端</span>
      <span class="accent">Tech:</span> Electron · Node.js · Hyperledger Fabric
      <a class="link" href="https://github.com/zhangmin510/fabric-console" target="_blank" rel="noopener noreferrer">→ github.com/zhangmin510/fabric-console</a>
`

const CONTACT = `
<span class="section-header">找到我 / Find Me</span>

  <span class="accent">🐙 GitHub:</span>  <a class="link" href="https://github.com/zhangmin510" target="_blank" rel="noopener noreferrer">github.com/zhangmin510</a>
  <span class="accent">🌐 Blog:</span>    <a class="link" href="https://zhangmin.name" target="_blank" rel="noopener noreferrer">zhangmin.name</a>
  <span class="accent">📍 Base:</span>    Hangzhou, China

  <span class="dim">开源项目、实践记录与新的 MVP 会持续更新。</span>
`

const YEARLY_KEYWORDS = [
  { year: 2026, keywords: '认知 Agent MVP' },
  { year: 2025, keywords: '沟通 成长 Agent' },
  { year: 2024, keywords: '真行 传承 节奏' },
  { year: 2022, keywords: '家 突破 而立' },
  { year: 2021, keywords: '家 做时间的朋友 而立' },
  { year: 2020, keywords: '家 7 而立' },
]

const KEYWORDS = `
<span class="section-header">年度关键字 / Yearly Keywords</span>

${YEARLY_KEYWORDS
    .map(({ year, keywords }) => `  <span class="accent">${year}</span>  <span class="highlight">${keywords}</span>`)
    .join('\n')}
`

const HELP = `
<span class="section-header">可用命令 / Available Commands</span>

  <span class="highlight">about</span>      - 关于我的介绍
  <span class="highlight">skills</span>     - 技术栈展示
  <span class="highlight">projects</span>   - 项目经历
  <span class="highlight">keyword</span>    - 每年的关键字
  <span class="highlight">contact</span>    - 联系方式
  <span class="highlight">neofetch</span>   - 系统信息
  <span class="highlight">whoami</span>     - 当前用户
  <span class="highlight">date</span>       - 当前时间
  <span class="highlight">echo</span>       - 回显文本
  <span class="highlight">clear</span>      - 清空终端 (或 Ctrl+L)
  <span class="highlight">help</span>       - 显示此帮助信息

  <span class="dim">提示: 使用 ↑/↓ 键浏览命令历史，Tab 键自动补全</span>
`

export function getWelcomeMessage(): string {
  return `${ASCII_LOGO}
  欢迎来到 <span class="highlight">ZhangMin.name</span> 的终端主页。
  AI engineer · AI-native builder · Distributed systems practitioner.

  输入 <span class="highlight">help</span> 查看可用命令。
  Type <span class="highlight">help</span> to see available commands.
`
}

export function executeCommand(input: string): string {
  const parts = input.trim().split(/\s+/)
  const cmd = parts[0].toLowerCase()
  const args = parts.slice(1)

  switch (cmd) {
    case 'help':
    case '?':
      return HELP

    case 'about':
    case 'whoami':
      return ABOUT

    case 'skills':
    case 'tech':
      return SKILLS

    case 'projects':
    case 'work':
      return PROJECTS

    case 'keyword':
    case 'keywords':
      return KEYWORDS

    case 'contact':
    case 'email':
      return CONTACT

    case 'neofetch':
    case 'sysinfo':
      return NEOFETCH

    case 'date':
      return `  ${new Date().toLocaleString('zh-CN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}`

    case 'echo':
      return args.length > 0 ? `  ${args.join(' ')}` : ''

    case 'clear':
    case 'cls':
      return ''

    case 'ls':
      return `  <span class="accent">about.txt</span>  <span class="accent">skills.md</span>  <span class="accent">projects/</span>  <span class="accent">contact.json</span>`

    case 'cat':
      if (args[0] === 'about.txt') return ABOUT
      if (args[0] === 'skills.md') return SKILLS
      if (args[0] === 'contact.json') return CONTACT
      return `  <span class="error">cat: ${args[0] || '(no file)'}: No such file or directory</span>`

    case 'cd':
      return `  <span class="warning">Permission denied: Cannot navigate away from portfolio</span>`

    case 'sudo':
      return `  <span class="error">[sudo] password for zhangmin: Nice try! 😉</span>`

    case 'exit':
    case 'quit':
      return `  <span class="warning">Logout? But we just met! Try 'contact' instead.</span>`

    case 'rm':
      return `  <span class="error">rm: cannot remove: Read-only file system</span>`

    case 'vim':
    case 'nano':
    case 'emacs':
      return `  <span class="warning">Editor wars? Let's not go there... 😄</span>`

    case 'hello':
    case 'hi':
      if (args.length > 0 && args[0].toLowerCase() === 'world') {
        return `__EASTER_EGG_HELLO_WORLD__`
      }
      return `  <span class="highlight">Hello! 👋</span> Welcome to ZhangMin.name's portfolio. Type 'help' for commands.`

    case '':
      return ''

    default:
      return `  <span class="error">Command not found: ${cmd}</span>
  Type <span class="highlight">help</span> to see available commands.`
  }
}
