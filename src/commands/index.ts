import {
  CONTENT_DIRECTORIES,
  HOME_DIRECTORY,
  getContentNode,
  listContentDirectory,
  resolveContentPath,
  type FileEntry,
} from './filesystem'

export { HOME_DIRECTORY } from './filesystem'

export type MessageTone = 'normal' | 'success' | 'warning' | 'error' | 'dim'

export type CommandResult =
  | { kind: 'about' }
  | { kind: 'skills' }
  | { kind: 'projects' }
  | { kind: 'project'; slug: string }
  | { kind: 'panoramas' }
  | { kind: 'panorama'; slug: string }
  | { kind: 'sites' }
  | { kind: 'site'; slug: string }
  | { kind: 'contact' }
  | { kind: 'feedback' }
  | { kind: 'keywords' }
  | { kind: 'help' }
  | { kind: 'neofetch' }
  | { kind: 'file-list'; path?: string; entries?: FileEntry[] }
  | { kind: 'easter-egg'; lines: string[] }
  | {
      kind: 'message'
      text: string
      tone?: MessageTone
      suggestHelp?: boolean
    }

export type CommandExecution =
  | { kind: 'output'; result: CommandResult }
  | { kind: 'clear' }
  | { kind: 'noop' }
  | { kind: 'easter-egg' }
  | { kind: 'change-directory'; cwd: string }

export interface CommandContext {
  cwd: string
  previousCwd?: string
  history?: string[]
}

export interface CommandDefinition {
  name: string
  aliases?: string[]
  description?: string
  quick?: boolean
  execute: (args: string[], now: Date, context: CommandContext) => CommandExecution
}

const output = (result: CommandResult): CommandExecution => ({
  kind: 'output',
  result,
})

const error = (text: string) => output({ kind: 'message', text, tone: 'error' })

function pathTarget(command: string, input: string, cwd: string) {
  if (!input) return { execution: error(`${command}: ${input}: No such file or directory`) }
  const path = resolveContentPath(input, cwd)
  if (path !== HOME_DIRECTORY && !path.startsWith(`${HOME_DIRECTORY}/`)) {
    return { execution: error(`${command}: ${input}: Permission denied`) }
  }
  const expanded = input === '~' ? HOME_DIRECTORY : input.startsWith('~/')
    ? `${HOME_DIRECTORY}/${input.slice(2)}` : input
  const parts = (expanded.startsWith('/') ? expanded : `${cwd}/${expanded}`).split('/').filter(Boolean)
  const walked: string[] = []
  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index] === '..') walked.pop()
    else if (parts[index] !== '.') walked.push(parts[index])
    const current = `/${walked.join('/')}`
    if (HOME_DIRECTORY.startsWith(`${current}/`) || current === '/') continue
    const entry = getContentNode(current)
    if (!entry) return { execution: error(`${command}: ${input}: No such file or directory`) }
    if (entry.type !== 'directory' && index < parts.length - 1) {
      return { execution: error(`${command}: ${input}: Not a directory`) }
    }
  }
  const node = getContentNode(path)
  if (!node) return { execution: error(`${command}: ${input}: No such file or directory`) }
  if (input.endsWith('/') && node.type !== 'directory') {
    return { execution: error(`${command}: ${input}: Not a directory`) }
  }
  return { node }
}

export const COMMANDS: CommandDefinition[] = [
  {
    name: 'projects',
    aliases: ['work'],
    description: '代表项目与交付结果',
    quick: true,
    execute: () => output({ kind: 'projects' }),
  },
  {
    name: 'about',
    description: '关于我的介绍',
    quick: true,
    execute: () => output({ kind: 'about' }),
  },
  {
    name: 'contact',
    aliases: ['email'],
    description: '公开联系方式',
    quick: true,
    execute: () => output({ kind: 'contact' }),
  },
  {
    name: 'skills',
    aliases: ['tech'],
    description: '能力方向与技术栈',
    quick: true,
    execute: () => output({ kind: 'skills' }),
  },
  {
    name: 'feedback',
    aliases: ['留言'],
    description: '留言 · 匿名提交或使用 GitHub 账号',
    execute: () => output({ kind: 'feedback' }),
  },
  {
    name: 'keyword',
    aliases: ['keywords'],
    description: '每年的关键字',
    execute: () => output({ kind: 'keywords' }),
  },
  {
    name: 'panoramas',
    description: '浏览全部交互式全景图',
    quick: true,
    execute: () => output({ kind: 'panoramas' }),
  },
  {
    name: 'sites',
    aliases: ['websites'],
    description: '打开评测论文、AI 历史档案与检索实验网站',
    quick: true,
    execute: () => output({ kind: 'sites' }),
  },
  {
    name: 'neofetch',
    aliases: ['sysinfo'],
    description: '终端风格个人信息',
    execute: () => output({ kind: 'neofetch' }),
  },
  {
    name: 'whoami',
    description: '当前访客身份',
    execute: () =>
      output({
        kind: 'message',
        text: 'guest — visitor of ZhangMin.name',
        tone: 'dim',
      }),
  },
  {
    name: 'date',
    description: '当前时间',
    execute: (_args, now) =>
      output({
        kind: 'message',
        text: now.toLocaleString('zh-CN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      }),
  },
  {
    name: 'echo',
    description: '安全地回显文本',
    execute: (args) =>
      output({ kind: 'message', text: args.join(' '), tone: 'normal' }),
  },
  {
    name: 'clear',
    aliases: ['cls'],
    description: '清空终端记录',
    quick: true,
    execute: () => ({ kind: 'clear' }),
  },
  {
    name: 'help',
    aliases: ['?'],
    description: '显示命令帮助',
    quick: true,
    execute: () => output({ kind: 'help' }),
  },
  {
    name: 'ls',
    description: '列出当前目录或指定路径：ls [路径]',
    execute: (args, _now, context) => {
      const paths = args.filter((arg) => !/^-[al]+$/.test(arg))
      const invalidOption = paths.find((arg) => arg.startsWith('-'))
      if (invalidOption) return error(`ls: invalid option: ${invalidOption}`)
      if (paths.length > 1) return error('ls: too many arguments')
      const target = pathTarget('ls', paths[0] ?? '.', context.cwd)
      if (target.execution) return target.execution
      const node = target.node!
      return output({
        kind: 'file-list',
        path: node.path,
        entries: node.type === 'directory' ? listContentDirectory(node.path)
          : [{ name: node.name, type: 'file', href: node.href }],
      })
    },
  },
  {
    name: 'cat',
    description: '阅读文件：cat <路径>',
    execute: (args, _now, context) => {
      if (!args.length) return error('cat: missing operand')
      if (args.length > 1) return error('cat: too many arguments')
      const target = pathTarget('cat', args[0], context.cwd)
      if (target.execution) return target.execution
      const node = target.node!
      if (node.type === 'directory') return error(`cat: ${args[0]}: Is a directory`)
      if (node.content === 'project' || node.content === 'panorama' || node.content === 'site') {
        return output({ kind: node.content, slug: node.slug! })
      }
      return output({ kind: node.content })
    },
  },
  {
    name: 'hello',
    aliases: ['hi'],
    execute: (args) => {
      if (args[0]?.toLowerCase() === 'world') return { kind: 'easter-egg' }
      return output({
        kind: 'message',
        text: "Hello! 👋 Welcome to ZhangMin.name. Type 'help' for commands.",
        tone: 'success',
      })
    },
  },
  {
    name: 'cd',
    description: '切换内容目录：cd [路径]；cd - 返回上次目录',
    execute: (args, _now, context) => {
      if (args.length > 1) return error('cd: too many arguments')
      if (args[0] === '-' && !context.previousCwd) return error('cd: OLDPWD not set')
      const input = args[0] === '-' ? context.previousCwd! : args[0] ?? '~'
      const target = pathTarget('cd', input, context.cwd)
      if (target.execution) return target.execution
      if (target.node!.type !== 'directory') return error(`cd: ${input}: Not a directory`)
      return { kind: 'change-directory', cwd: target.node!.path }
    },
  },
  {
    name: 'pwd',
    description: '显示当前目录',
    execute: (_args, _now, context) => output({ kind: 'message', text: context.cwd }),
  },
  {
    name: 'history',
    description: '显示本次终端会话的命令历史',
    execute: (_args, _now, context) => output({
      kind: 'message',
      text: (context.history ?? []).map((line, index) => `${String(index + 1).padStart(4, ' ')}  ${line}`).join('\n'),
    }),
  },
  {
    name: 'sudo',
    execute: () =>
      output({
        kind: 'message',
        text: '[sudo] password for guest: Nice try! 😉',
        tone: 'error',
      }),
  },
  {
    name: 'exit',
    aliases: ['quit'],
    execute: () =>
      output({
        kind: 'message',
        text: "Logout? But we just met! Try 'contact' instead.",
        tone: 'warning',
      }),
  },
  {
    name: 'rm',
    execute: () =>
      output({
        kind: 'message',
        text: 'rm: cannot remove: Read-only file system',
        tone: 'error',
      }),
  },
  {
    name: 'vim',
    aliases: ['nano', 'emacs'],
    execute: () =>
      output({
        kind: 'message',
        text: "Editor wars? Let's not go there... 😄",
        tone: 'warning',
      }),
  },
]

export const QUICK_COMMANDS = COMMANDS.filter((command) => command.quick).map(
  (command) => command.name,
)

export const AUTOCOMPLETE_COMMANDS = Array.from(
  new Set(
    COMMANDS.flatMap((command) => [command.name, ...(command.aliases ?? [])]),
  ),
)

export const HELP_COMMANDS = COMMANDS.filter(
  (command) => command.description,
).map(({ name, description }) => ({ name, description: description! }))

export function executeCommand(
  input: string,
  now: Date = new Date(),
  context: CommandContext = { cwd: HOME_DIRECTORY },
): CommandExecution {
  const normalized = input.trim()
  if (!normalized) return { kind: 'noop' }

  const parsed = parseWords(normalized)
  if (parsed.incomplete) return error('parse: unmatched quote or trailing escape')
  const [rawCommand, ...args] = parsed.words.map((word) => word.value)
  const commandName = rawCommand.toLowerCase()
  const definition = COMMANDS.find(
    (command) =>
      command.name === commandName || command.aliases?.includes(commandName),
  )

  if (!definition) {
    return output({
      kind: 'message',
      text: `Command not found: ${commandName}`,
      tone: 'error',
      suggestHelp: true,
    })
  }

  return definition.execute(args, now, context)
}

function parseWords(input: string) {
  const words: { value: string; start: number }[] = []
  let value = ''
  let start = -1
  let quote = ''
  let escaped = false
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (escaped) { value += char; escaped = false; continue }
    if (char === '\\' && quote !== "'") {
      if (start === -1) start = index
      escaped = true
    } else if (quote) {
      if (char === quote) quote = ''
      else value += char
    } else if (char === '"' || char === "'") {
      if (start === -1) start = index
      quote = char
    } else if (/\s/.test(char)) {
      if (start !== -1) { words.push({ value, start }); value = ''; start = -1 }
    } else {
      if (start === -1) start = index
      value += char
    }
  }
  if (start !== -1) words.push({ value, start })
  return { words, incomplete: Boolean(quote || escaped), trailingSpace: start === -1 }
}

export function getCompletionCandidates(input: string, cwd = HOME_DIRECTORY): string[] {
  const { words, trailingSpace } = parseWords(input)
  if (words.length === 0 || (words.length === 1 && !trailingSpace)) {
    const word = words[0]
    const prefix = word?.value.toLowerCase() ?? ''
    return AUTOCOMPLETE_COMMANDS.filter((command) => command.startsWith(prefix))
      .map((command) => `${input.slice(0, word?.start ?? input.length)}${command}`)
  }
  if (!['cd', 'ls', 'cat'].includes(words[0].value.toLowerCase())) return []
  const current = trailingSpace ? { value: '', start: input.length } : words[words.length - 1]
  const partial = current.value
  let candidates: string[]
  if (partial.startsWith('/') && !partial.startsWith(`${HOME_DIRECTORY}/`)) {
    candidates = CONTENT_DIRECTORIES.map((directory) => `${directory.path}/`).filter((path) => path.startsWith(partial))
  } else if (partial === '~') {
    candidates = ['~/']
  } else {
    const slash = partial.lastIndexOf('/')
    const parent = partial.slice(0, slash + 1)
    const prefix = partial.slice(slash + 1)
    candidates = listContentDirectory(resolveContentPath(parent || '.', cwd))
      .filter((entry) => (words[0].value.toLowerCase() !== 'cd' || entry.type === 'directory') && entry.name.startsWith(prefix))
      .map((entry) => `${parent}${entry.name}${entry.type === 'directory' ? '/' : ''}`)
    if (words[0].value.toLowerCase() === 'cd' && partial === '.') candidates.push('./', '../')
  }
  return [...new Set(candidates)].map((candidate) => {
    const openingQuote = input[current.start]
    const token = openingQuote === '"' || openingQuote === "'"
      ? `${openingQuote}${candidate}${openingQuote}` : candidate.replace(/ /g, '\\ ')
    return `${input.slice(0, current.start)}${token}`
  })
}

export function autocompleteCommand(input: string, cwd = HOME_DIRECTORY): string {
  const candidates = getCompletionCandidates(input, cwd)
  if (candidates.length === 0) return input
  let common = candidates[0]
  for (const candidate of candidates.slice(1)) {
    let length = 0
    while (length < common.length && common[length] === candidate[length]) length += 1
    common = common.slice(0, length)
  }
  return common.length > input.length || candidates.length === 1 ? common : input
}
