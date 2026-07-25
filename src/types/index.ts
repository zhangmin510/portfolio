import type { CommandResult } from '../commands'

export type HistoryItem =
  | {
      id: number
      type: 'command'
      content: string
    }
  | {
      id: number
      type: 'output'
      result: CommandResult
    }
