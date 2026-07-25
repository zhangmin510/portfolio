const ASCII_LOGO = `
<span class="ascii-art">
  ████████╗███████╗██████╗ ███╗   ███╗██╗███╗   ██╗ █████╗ ██╗
  ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║████╗  ██║██╔══██╗██║
     ██║   █████╗  ██████╔╝██╔████╔██║██║██╔██╗ ██║███████║██║
     ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║██║╚██╗██║██╔══██║██║
     ██║   ███████╗██║  ██║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║███████╗
     ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝
</span>`

const NEOFETCH = `
<span class="ascii-art">        .--.        </span>   <span class="highlight">guest</span>@<span class="accent">portfolio</span>
<span class="ascii-art">       |o_o |       </span>   ─────────────────
<span class="ascii-art">       |:_/ |       </span>   <span class="highlight">OS:</span> WebOS 1.0.0
<span class="ascii-art">      //   \\ \\      </span>   <span class="highlight">Host:</span> Browser Environment
<span class="ascii-art">     (|     | )     </span>   <span class="highlight">Kernel:</span> JavaScript V8
<span class="ascii-art">    /'\\_   _/\`\\     </span>   <span class="highlight">Uptime:</span> Since page load
<span class="ascii-art">    \\___)=(___/     </span>   <span class="highlight">Shell:</span> ReactTerminal 1.0
                       <span class="highlight">Resolution:</span> ${window.innerWidth}x${window.innerHeight}
                       <span class="highlight">Theme:</span> GitHub Dark
                       <span class="highlight">Terminal:</span> JetBrains Mono
`

const ABOUT = `
<span class="section-header">关于我 / About Me</span>

  你好！我是 <span class="highlight">张三 (Zhang San)</span>

  🚀 全栈开发工程师 / Full Stack Developer
  📍 中国，北京 / Beijing, China
  💼 5年开发经验 / 5 years of experience

  我热衷于构建优雅、高效的软件解决方案。
  专注于 Web 开发、云原生架构和开源社区。

  <span class="dim">"代码如诗，架构如画"</span>
`

const SKILLS = `
<span class="section-header">技术栈 / Tech Stack</span>

  <span class="accent">Languages:</span>
    TypeScript   <span class="skill-bar"><span class="filled">████████████████████</span><span class="empty">░░░░</span></span> 90%
    Go           <span class="skill-bar"><span class="filled">██████████████████</span><span class="empty">░░░░░░</span></span> 85%
    Python       <span class="skill-bar"><span class="filled">████████████████</span><span class="empty">░░░░░░░░</span></span> 75%
    Rust         <span class="skill-bar"><span class="filled">████████████</span><span class="empty">░░░░░░░░░░░░</span></span> 60%

  <span class="accent">Frontend:</span>
    React        <span class="skill-bar"><span class="filled">████████████████████</span><span class="empty">░░░░</span></span> 90%
    Vue.js       <span class="skill-bar"><span class="filled">██████████████████</span><span class="empty">░░░░░░</span></span> 85%
    Next.js      <span class="skill-bar"><span class="filled">████████████████</span><span class="empty">░░░░░░░░</span></span> 80%

  <span class="accent">Backend:</span>
    Node.js      <span class="skill-bar"><span class="filled">██████████████████</span><span class="empty">░░░░░░</span></span> 85%
    PostgreSQL   <span class="skill-bar"><span class="filled">████████████████</span><span class="empty">░░░░░░░░</span></span> 80%
    Redis        <span class="skill-bar"><span class="filled">████████████████</span><span class="empty">░░░░░░░░</span></span> 75%

  <span class="accent">DevOps:</span>
    Docker       <span class="skill-bar"><span class="filled">████████████████████</span><span class="empty">░░░░</span></span> 90%
    Kubernetes   <span class="skill-bar"><span class="filled">██████████████</span><span class="empty">░░░░░░░░░░</span></span> 70%
    AWS          <span class="skill-bar"><span class="filled">████████████████</span><span class="empty">░░░░░░░░</span></span> 75%
`

const PROJECTS = `
<span class="section-header">项目经历 / Projects</span>

  <span class="highlight">01.</span> <span class="bold">CloudNative Platform</span>
      <span class="dim">企业级云原生开发平台</span>
      <span class="accent">Tech:</span> Go, Kubernetes, React, gRPC
      <a class="link" href="https://github.com" target="_blank">→ github.com/example/cloudnative</a>

  <span class="highlight">02.</span> <span class="bold">AI Code Assistant</span>
      <span class="dim">基于 LLM 的智能编程助手</span>
      <span class="accent">Tech:</span> Python, FastAPI, OpenAI, Redis
      <a class="link" href="https://github.com" target="_blank">→ github.com/example/ai-assistant</a>

  <span class="highlight">03.</span> <span class="bold">Real-time Dashboard</span>
      <span class="dim">实时数据可视化仪表板</span>
      <span class="accent">Tech:</span> TypeScript, Next.js, WebSocket, D3.js
      <a class="link" href="https://github.com" target="_blank">→ github.com/example/dashboard</a>

  <span class="highlight">04.</span> <span class="bold">Distributed Task Queue</span>
      <span class="dim">高性能分布式任务队列</span>
      <span class="accent">Tech:</span> Rust, Redis, PostgreSQL
      <a class="link" href="https://github.com" target="_blank">→ github.com/example/taskqueue</a>
`

const CONTACT = `
<span class="section-header">联系方式 / Contact</span>

  <span class="accent">📧 Email:</span>    <a class="link" href="mailto:zhangsan@example.com">zhangsan@example.com</a>
  <span class="accent">🐙 GitHub:</span>   <a class="link" href="https://github.com" target="_blank">github.com/zhangsan</a>
  <span class="accent">💼 LinkedIn:</span> <a class="link" href="https://linkedin.com" target="_blank">linkedin.com/in/zhangsan</a>
  <span class="accent">🐦 Twitter:</span>  <a class="link" href="https://twitter.com" target="_blank">@zhangsan_dev</a>
  <span class="accent">🌐 Blog:</span>     <a class="link" href="https://example.com" target="_blank">zhangsan.dev</a>

  <span class="dim">欢迎随时联系我！</span>
`

const YEARLY_KEYWORDS = [
  { year: 2026, keywords: '认知 Agent MVP' },
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
  欢迎来到我的终端风格个人主页！
  Welcome to my terminal-style portfolio!

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
      return `  <span class="error">[sudo] password for guest: Nice try! 😉</span>`

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
      return `  <span class="highlight">Hello! 👋</span> Welcome to my portfolio. Type 'help' for commands.`

    case '':
      return ''

    default:
      return `  <span class="error">Command not found: ${cmd}</span>
  Type <span class="highlight">help</span> to see available commands.`
  }
}
