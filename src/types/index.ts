import type { CommandResult } from '../commands'

export type HistoryItem =
  | {
      id: number
      type: 'command'
      content: string
      cwd?: string
    }
  | {
      id: number
      type: 'output'
      result: CommandResult
    }
  | {
      id: number
      type: 'completion'
      candidates: string[]
    }
