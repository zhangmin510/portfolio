import { describe, expect, it } from 'vitest'
import {
  QUICK_COMMANDS,
  autocompleteCommand,
  executeCommand,
} from './index'

describe('terminal command registry', () => {
  it('keeps the most useful calls to action first', () => {
    expect(QUICK_COMMANDS.slice(0, 4)).toEqual([
      'projects',
      'about',
      'contact',
      'skills',
    ])
  })

  it('supports command aliases', () => {
    expect(executeCommand('work')).toEqual({
      kind: 'output',
      result: { kind: 'projects' },
    })
  })

  it('keeps echoed HTML as plain text data', () => {
    expect(executeCommand('echo <img src=x onerror=alert(1)>')).toEqual({
      kind: 'output',
      result: {
        kind: 'message',
        text: '<img src=x onerror=alert(1)>',
        tone: 'normal',
      },
    })
  })

  it('returns a helpful error for unknown commands', () => {
    expect(executeCommand('not-a-command')).toEqual({
      kind: 'output',
      result: {
        kind: 'message',
        text: 'Command not found: not-a-command',
        tone: 'error',
        suggestHelp: true,
      },
    })
  })

  it('autocompletes only unambiguous command names', () => {
    expect(autocompleteCommand('proj')).toBe('projects')
    expect(autocompleteCommand('c')).toBe('c')
    expect(autocompleteCommand('echo hello')).toBe('echo hello')
  })

  it('keeps the hello world easter egg', () => {
    expect(executeCommand('hello world')).toEqual({ kind: 'easter-egg' })
  })
})
