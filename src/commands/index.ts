export type MessageTone = 'normal' | 'success' | 'warning' | 'error' | 'dim'

export type CommandResult =
  | { kind: 'about' }
  | { kind: 'skills' }
  | { kind: 'projects' }
  | { kind: 'contact' }
  | { kind: 'keywords' }
  | { kind: 'help' }
  | { kind: 'neofetch' }
  | { kind: 'file-list' }
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

export interface CommandDefinition {
  name: string
  aliases?: string[]
  description?: string
  quick?: boolean
  execute: (args: string[], now: Date) => CommandExecution
}

const output = (result: CommandResult): CommandExecution => ({
  kind: 'output',
  result,
})

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
    name: 'keyword',
    aliases: ['keywords'],
    description: '每年的关键字',
    execute: () => output({ kind: 'keywords' }),
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
    execute: () => output({ kind: 'file-list' }),
  },
  {
    name: 'cat',
    execute: (args) => {
      if (args[0] === 'about.txt') return output({ kind: 'about' })
      if (args[0] === 'skills.md') return output({ kind: 'skills' })
      if (args[0] === 'contact.json') return output({ kind: 'contact' })
      return output({
        kind: 'message',
        text: `cat: ${args[0] || '(no file)'}: No such file or directory`,
        tone: 'error',
      })
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
    execute: () =>
      output({
        kind: 'message',
        text: 'Permission denied: Cannot navigate away from ZhangMin.name',
        tone: 'warning',
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
): CommandExecution {
  const normalized = input.trim()
  if (!normalized) return { kind: 'noop' }

  const [rawCommand, ...args] = normalized.split(/\s+/)
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

  return definition.execute(args, now)
}

export function autocompleteCommand(input: string): string {
  const normalized = input.trim().toLowerCase()
  if (!normalized || normalized.includes(' ')) return input

  const matches = AUTOCOMPLETE_COMMANDS.filter((command) =>
    command.startsWith(normalized),
  )
  return matches.length === 1 ? matches[0] : input
}
