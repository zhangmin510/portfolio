import {
  Suspense,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  HOME_DIRECTORY,
  autocompleteCommand,
  getCompletionCandidates,
  executeCommand,
  type CommandResult,
} from '../commands'
import { PROFILE, WEBSITES } from '../data/portfolio'
import type { HistoryItem } from '../types'
import CommandOutput from './CommandOutput'
import './Terminal.css'

const MAX_HISTORY_ITEMS = 120
const MAX_COMMAND_HISTORY = 100
const InputVisualizer = lazy(() => import('./InputVisualizer'))

const HELLO_WORLD_LINES = [
  '  ██╗  ██╗███████╗██╗     ██╗      ██████╗ ',
  '  ██║  ██║██╔════╝██║     ██║     ██╔═══██╗',
  '  ███████║█████╗  ██║     ██║     ██║   ██║',
  '  ██╔══██║██╔══╝  ██║     ██║     ██║   ██║',
  '  ██║  ██║███████╗███████╗███████╗╚██████╔╝',
  '  ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝ ╚═════╝ ',
  '',
  '  ██╗    ██╗ ██████╗ ██████╗ ██╗     ██████╗  ██╗',
  '  ██║    ██║██╔═══██╗██╔══██╗██║     ██╔══██╗ ██║',
  '  ██║ █╗ ██║██║   ██║██████╔╝██║     ██║  ██║ ██║',
  '  ██║███╗██║██║   ██║██╔══██╗██║     ██║  ██║ ╚═╝',
  '  ╚███╔███╔╝╚██████╔╝██║  ██║███████╗██████╔╝ ██╗',
  '   ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═════╝  ╚═╝',
  '',
  '// The program that started it all.',
  'C (1972)       printf("Hello, World!\\n");',
  'Python         print("Hello, World!")',
  'JavaScript     console.log("Hello, World!")',
  'Go             fmt.Println("Hello, World!")',
  'Rust           println!("Hello, World!");',
  '',
  '// And then came the AI era...',
  'Prompt         "Write a Hello World program"',
  'MCP Tool       {"tool":"hello","input":"world"}',
  'Vibe Coding    "Build me a hello world app with animations"',
  '',
  'Every master was once a beginner.',
  'Every expert was once a novice.',
  'It all starts with Hello, World!',
]

interface AudioEngine {
  context: AudioContext
  noiseBuffer: AudioBuffer
}

let audioEngine: AudioEngine | null = null

function getAudioEngine(): AudioEngine | null {
  if (typeof window === 'undefined' || !window.AudioContext) return null
  if (audioEngine) return audioEngine

  const context = new window.AudioContext()
  const size = Math.floor(context.sampleRate * 0.08)
  const noiseBuffer = context.createBuffer(1, size, context.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let index = 0; index < size; index += 1) {
    data[index] = Math.random() * 2 - 1
  }

  audioEngine = { context, noiseBuffer }
  return audioEngine
}

function playKeySound() {
  const engine = getAudioEngine()
  if (!engine) return

  const { context, noiseBuffer } = engine
  if (context.state === 'suspended') void context.resume()

  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  const now = context.currentTime

  source.buffer = noiseBuffer
  filter.type = 'bandpass'
  filter.frequency.value = 3000 + Math.random() * 1000
  filter.Q.value = 2.2
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
  source.connect(filter).connect(gain).connect(context.destination)
  source.start(now)
  source.stop(now + 0.04)
}

function displayDirectory(cwd = HOME_DIRECTORY) {
  return cwd === HOME_DIRECTORY
    ? '~'
    : cwd.startsWith(`${HOME_DIRECTORY}/`)
      ? `~${cwd.slice(HOME_DIRECTORY.length)}`
      : cwd
}

function Prompt({ cwd = HOME_DIRECTORY }: { cwd?: string }) {
  return (
    <span className="prompt" aria-hidden="true">
      <span className="user">guest</span>
      <span>@</span>
      <span className="host">zhangmin.name</span>
      <span>:</span>
      <span className="path">{displayDirectory(cwd)}</span>
      <span className="dollar">$</span>
    </span>
  )
}

export default function Terminal() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [input, setInput] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [cwd, setCwd] = useState(HOME_DIRECTORY)
  const [previousCwd, setPreviousCwd] = useState<string>()
  const [showWelcome, setShowWelcome] = useState(true)
  const draftInput = useRef('')
  const composing = useRef(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [finePointer, setFinePointer] = useState(false)
  const [visualizerEnabled, setVisualizerEnabled] = useState(false)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const nextHistoryId = useRef(1)
  const latestCommandId = useRef<number | null>(null)
  const eggTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const getHistoryId = () => {
    const id = nextHistoryId.current
    nextHistoryId.current += 1
    return id
  }

  const cancelEasterEgg = useCallback(() => {
    if (eggTimer.current) {
      clearInterval(eggTimer.current)
      eggTimer.current = null
    }
  }, [])

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pointerQuery = window.matchMedia(
      '(min-width: 760px) and (hover: hover) and (pointer: fine)',
    )

    const updatePreferences = () => {
      setReducedMotion(motionQuery.matches)
      setFinePointer(pointerQuery.matches)
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    updatePreferences()
    motionQuery.addEventListener('change', updatePreferences)
    pointerQuery.addEventListener('change', updatePreferences)
    window.addEventListener('resize', updatePreferences)

    try {
      setSoundEnabled(window.localStorage.getItem('terminal-sound') === 'on')
      const storedVisualizer = window.localStorage.getItem('input-visualizer')
      setVisualizerEnabled(storedVisualizer === null || storedVisualizer === 'on')
    } catch {
      setVisualizerEnabled(true)
    }

    if (pointerQuery.matches && document.activeElement === document.body) {
      inputRef.current?.focus({ preventScroll: true })
    }

    return () => {
      motionQuery.removeEventListener('change', updatePreferences)
      pointerQuery.removeEventListener('change', updatePreferences)
      window.removeEventListener('resize', updatePreferences)
    }
  }, [])

  useEffect(() => cancelEasterEgg, [cancelEasterEgg])

  useEffect(() => {
    if (latestCommandId.current === null) return
    const lastItem = history[history.length - 1]
    if (lastItem?.type === 'output' && lastItem.result.kind === 'feedback') return
    inputRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }, [history, reducedMotion])

  const appendHistory = useCallback((items: HistoryItem[]) => {
    setHistory((previous) =>
      [...previous, ...items].slice(-MAX_HISTORY_ITEMS),
    )
  }, [])

  const startEasterEgg = useCallback(
    (commandId: number, outputId: number, command: string, commandCwd: string) => {
      latestCommandId.current = commandId
      appendHistory([
        { id: commandId, type: 'command', content: command, cwd: commandCwd },
        {
          id: outputId,
          type: 'output',
          result: {
            kind: 'easter-egg',
            lines: reducedMotion ? HELLO_WORLD_LINES : [],
          },
        },
      ])

      if (reducedMotion) return

      let visibleLineCount = 0
      eggTimer.current = setInterval(() => {
        visibleLineCount += 1
        const result: CommandResult = {
          kind: 'easter-egg',
          lines: HELLO_WORLD_LINES.slice(0, visibleLineCount),
        }
        setHistory((previous) =>
          previous.map((item) =>
            item.id === outputId && item.type === 'output'
              ? { ...item, result }
              : item,
          ),
        )

        if (visibleLineCount >= HELLO_WORLD_LINES.length) {
          cancelEasterEgg()
        }
      }, 60)
    },
    [appendHistory, cancelEasterEgg, reducedMotion],
  )

  const clearScreen = useCallback(() => {
    cancelEasterEgg()
    setHistory([])
    setShowWelcome(false)
    latestCommandId.current = null
  }, [cancelEasterEgg])

  const editInput = (value: string, caret = value.length) => {
    setInput(value)
    draftInput.current = value
    setHistoryIndex(commandHistory.length)
    window.requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(caret, caret)
    })
  }

  const runCommand = useCallback(
    (rawCommand: string) => {
      const command = rawCommand.trim()
      cancelEasterEgg()
      const commandId = getHistoryId()
      latestCommandId.current = commandId
      const commandEntry: HistoryItem = {
        id: commandId,
        type: 'command',
        content: rawCommand,
        cwd,
      }
      const nextCommandHistory = !command || commandHistory[commandHistory.length - 1] === command
        ? commandHistory
        : [...commandHistory, command].slice(-MAX_COMMAND_HISTORY)
      const execution = executeCommand(command, new Date(), {
        cwd,
        previousCwd,
        history: nextCommandHistory,
      })

      if (execution.kind === 'clear') {
        clearScreen()
      } else if (execution.kind === 'easter-egg') {
        startEasterEgg(commandId, getHistoryId(), rawCommand, cwd)
      } else {
        const entries: HistoryItem[] = [commandEntry]
        if (execution.kind === 'change-directory') {
          setPreviousCwd(cwd)
          setCwd(execution.cwd)
        } else if (execution.kind === 'output') {
          entries.push({ id: getHistoryId(), type: 'output', result: execution.result })
        }
        appendHistory(entries)
      }

      setCommandHistory(nextCommandHistory)
      setHistoryIndex(nextCommandHistory.length)
      draftInput.current = ''
      setInput('')
      if (execution.kind !== 'output' || execution.result.kind !== 'feedback') {
        window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
      }
    },
    [appendHistory, cancelEasterEgg, clearScreen, commandHistory, cwd, previousCwd, startEasterEgg],
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!composing.current) runCommand(input)
  }

  const handleInputKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.nativeEvent.isComposing || composing.current || event.keyCode === 229) return
    if (soundEnabled && !event.repeat) playKeySound()

    if (event.ctrlKey && !event.metaKey && !event.altKey) {
      const key = event.key.toLowerCase()
      const field = event.currentTarget
      const start = field.selectionStart ?? input.length
      const end = field.selectionEnd ?? start

      if (key === 'c') {
        if (start !== end || window.getSelection()?.toString()) return
        event.preventDefault()
        cancelEasterEgg()
        const id = getHistoryId()
        latestCommandId.current = id
        appendHistory([{ id, type: 'command', content: `${input}^C`, cwd }])
        editInput('')
        return
      }
      if (key === 'l') {
        event.preventDefault()
        clearScreen()
        return
      }
      if (key === 'a' || key === 'e') {
        event.preventDefault()
        const caret = key === 'a' ? 0 : input.length
        field.setSelectionRange(caret, caret)
        return
      }
      if (key === 'u' || key === 'k' || key === 'w') {
        event.preventDefault()
        if (key === 'u') {
          editInput(input.slice(end), 0)
        } else if (key === 'k') {
          editInput(input.slice(0, start), start)
        } else {
          const prefix = start !== end
            ? input.slice(0, start)
            : input.slice(0, start).replace(/\s+$/, '').replace(/\S+$/, '')
          editInput(prefix + input.slice(end), prefix.length)
        }
        return
      }
    }

    if (event.metaKey || event.altKey || event.ctrlKey) return

    if (event.key === 'Enter') {
      event.preventDefault()
      runCommand(input)
      return
    }

    if (event.key === 'Tab') {
      if (event.shiftKey) return
      event.preventDefault()
      const position = event.currentTarget.selectionStart ?? input.length
      const end = event.currentTarget.selectionEnd ?? position
      const prefix = input.slice(0, position)
      const candidates = getCompletionCandidates(prefix, cwd)
      const completed = autocompleteCommand(prefix, cwd)
      editInput(completed + input.slice(end), completed.length)
      if (candidates.length > 1) {
        const id = getHistoryId()
        latestCommandId.current = id
        appendHistory([
          { id, type: 'command', content: input, cwd },
          { id: getHistoryId(), type: 'completion', candidates },
        ])
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!commandHistory.length) return
      if (historyIndex === commandHistory.length) draftInput.current = input
      const nextIndex = Math.max(0, historyIndex - 1)
      const value = commandHistory[nextIndex] ?? ''
      setHistoryIndex(nextIndex)
      setInput(value)
      window.requestAnimationFrame(() => inputRef.current?.setSelectionRange(value.length, value.length))
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (historyIndex === commandHistory.length) return
      const nextIndex = Math.min(commandHistory.length, historyIndex + 1)
      const value = nextIndex === commandHistory.length
        ? draftInput.current
        : commandHistory[nextIndex] ?? ''
      setHistoryIndex(nextIndex)
      setInput(value)
      window.requestAnimationFrame(() => inputRef.current?.setSelectionRange(value.length, value.length))
    }
  }

  const focusTerminal = (event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target
    if (!(target instanceof Element) ||
      target.closest('a, button, input, textarea, select, label, summary, [contenteditable]') ||
      window.getSelection()?.toString()) return
    inputRef.current?.focus({ preventScroll: true })
  }

  const toggleSound = () => {
    setSoundEnabled((previous) => {
      const next = !previous
      try {
        window.localStorage.setItem('terminal-sound', next ? 'on' : 'off')
      } catch {
        // Keep the in-memory preference when persistence is unavailable.
      }
      return next
    })
  }

  const toggleVisualizer = () => {
    setVisualizerEnabled((previous) => {
      const next = !previous
      try {
        window.localStorage.setItem('input-visualizer', next ? 'on' : 'off')
      } catch {
        // Keep the in-memory preference when persistence is unavailable.
      }
      return next
    })
  }

  return (
    <div className={`terminal-container${finePointer && visualizerEnabled ? ' has-visualizer' : ''}`}>
      <header className="terminal-header">
        <div className="terminal-buttons" aria-hidden="true">
          <span className="terminal-button close" />
          <span className="terminal-button minimize" />
          <span className="terminal-button maximize" />
        </div>
        <div className="terminal-title" title={`guest@zhangmin.name:${displayDirectory(cwd)}`}>
          guest@zhangmin.name:{displayDirectory(cwd)}
        </div>
        <div className="terminal-controls">
          <button
            type="button"
            className="terminal-control"
            aria-pressed={soundEnabled}
            onClick={toggleSound}
          >
            {soundEnabled ? 'sound:on' : 'sound:off'}
          </button>
          {finePointer && (
            <button
              type="button"
              className="terminal-control"
              aria-pressed={visualizerEnabled}
              onClick={toggleVisualizer}
            >
              {visualizerEnabled ? 'keys:on' : 'keys:off'}
            </button>
          )}
        </div>
      </header>

      <main className="terminal-body" aria-label="交互式终端" onClick={focusTerminal}>
        <h1 className="sr-only">{PROFILE.name} 个人终端</h1>
        {showWelcome && (
          <div className="terminal-welcome">
            <p>{PROFILE.name} · {PROFILE.title}</p>
            <p className="dim">{PROFILE.motto}</p>
            <p className="dim">输入 <span className="accent">help</span> 查看命令，<span className="accent">projects</span> 查看项目，<span className="accent">panoramas</span> 浏览全景图，或<button type="button" className="terminal-link welcome-feedback" onClick={() => runCommand('留言')}>留言</button>。</p>
          </div>
        )}

        <nav className="site-navigation" aria-label="网站导航">
          <p className="dim">// WEB APPS</p>
          <div>
            {WEBSITES.map((site) => (
              <a key={site.slug} className="terminal-link" href={site.href}>
                <span>{site.name}</span><span className="dim">{site.label} →</span>
              </a>
            ))}
          </div>
        </nav>

        <div
          className="terminal-history"
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {history.map((item) => (
            <div
              key={item.id}
              className={`terminal-line ${item.type}`}
              data-history-id={item.id}
            >
              {item.type === 'command' ? (
                <>
                  <Prompt cwd={item.cwd} />
                  <span className="command-input">{item.content}</span>
                </>
              ) : item.type === 'completion' ? (
                <div className="completion-list">
                  {item.candidates.map((candidate) => <span key={candidate}>{candidate}</span>)}
                </div>
              ) : (
                <CommandOutput result={item.result} viewport={viewport} />
              )}
            </div>
          ))}
        </div>

        <form className="terminal-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="terminal-command">
            输入终端命令
          </label>
          <Prompt cwd={cwd} />
          <input
            ref={inputRef}
            id="terminal-command"
            type="text"
            value={input}
            onChange={(event) => {
              setInput(event.target.value)
              draftInput.current = event.target.value
              setHistoryIndex(commandHistory.length)
            }}
            onKeyDown={handleInputKeyDown}
            onCompositionStart={() => { composing.current = true }}
            onCompositionEnd={() => { composing.current = false }}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="text"
            aria-describedby="terminal-input-hint"
          />
          <button type="submit" className="sr-only">
            执行命令
          </button>
        </form>
        <p id="terminal-input-hint" className="sr-only">
          输入 help 查看命令。Tab 补全，Shift+Tab 离开输入框，上下方向键浏览历史，Ctrl+C 取消，Ctrl+L 清屏。
        </p>
      </main>

      {finePointer && visualizerEnabled && (
        <Suspense fallback={null}>
          <InputVisualizer />
        </Suspense>
      )}
    </div>
  )
}
