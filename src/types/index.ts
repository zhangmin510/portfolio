export interface HistoryItem {
  type: 'command' | 'output'
  content: string
}

export interface Command {
  name: string
  description: string
  execute: (args: string[]) => string
}
