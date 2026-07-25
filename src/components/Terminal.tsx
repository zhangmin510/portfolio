import {
  Suspense,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  QUICK_COMMANDS,
  autocompleteCommand,
  executeCommand,
  type CommandResult,
} from '../commands'
import { PROFILE, PROJECTS } from '../data/portfolio'
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

function ProjectShowcase() {
  return (
    <aside className="project-showcase" aria-labelledby="selected-projects">
      <div className="section-eyebrow">SELECTED WORK</div>
      <h2 id="selected-projects">代表项目</h2>
      <div className="showcase-list">
        {PROJECTS.filter((project) => project.featured).map(
          (project, index) => (
            <article className="showcase-card" key={project.name}>
              <div className="showcase-index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </div>
              <div>
                <h3>{project.name}</h3>
                <p className="showcase-tagline">{project.tagline}</p>
                <p>{project.outcome}</p>
                <p className="showcase-stack">{project.stack.join(' · ')}</p>
                <a
                  href={project.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  查看源码
                  <span aria-hidden="true"> ↗</span>
                </a>
              </div>
            </article>
          ),
        )}
      </div>
      <div className="contact-card">
        <p className="section-eyebrow">LET&apos;S BUILD</p>
        <h2>一起把想法做成可用的产品</h2>
        <p>欢迎交流开源项目、AI Native 工作流和新的 MVP。</p>
        <a
          className="primary-link"
          href={PROFILE.github}
          target="_blank"
          rel="noopener noreferrer"
        >
          在 GitHub 找到我
          <span aria-hidden="true"> ↗</span>
        </a>
      </div>
    </aside>
  )
}

export default function Terminal() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [input, setInput] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [finePointer, setFinePointer] = useState(false)
  const [visualizerEnabled, setVisualizerEnabled] = useState(false)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)
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
      '(min-width: 1100px) and (hover: hover) and (pointer: fine)',
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
      setVisualizerEnabled(
        window.localStorage.getItem('input-visualizer') === 'on',
      )
    } catch {
      // Privacy modes can make localStorage unavailable; defaults remain safe.
    }

    return () => {
      motionQuery.removeEventListener('change', updatePreferences)
      pointerQuery.removeEventListener('change', updatePreferences)
      window.removeEventListener('resize', updatePreferences)
    }
  }, [])

  useEffect(() => cancelEasterEgg, [cancelEasterEgg])

  useEffect(() => {
    if (latestCommandId.current === null || !historyRef.current) return
    const element = historyRef.current.querySelector(
      `[data-history-id="${latestCommandId.current}"]`,
    )
    element?.scrollIntoView({
      block: 'start',
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }, [history, reducedMotion])

  const appendHistory = useCallback((items: HistoryItem[]) => {
    setHistory((previous) =>
      [...previous, ...items].slice(-MAX_HISTORY_ITEMS),
    )
  }, [])

  const startEasterEgg = useCallback(
    (commandId: number, outputId: number) => {
      latestCommandId.current = commandId
      appendHistory([
        { id: commandId, type: 'command', content: 'hello world' },
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

  const runCommand = useCallback(
    (rawCommand: string) => {
      const command = rawCommand.trim()
      if (!command) return

      cancelEasterEgg()
      const execution = executeCommand(command)
      const commandId = getHistoryId()
      latestCommandId.current = commandId

      if (execution.kind === 'clear') {
        setHistory([])
        latestCommandId.current = null
      } else if (execution.kind === 'easter-egg') {
        startEasterEgg(commandId, getHistoryId())
      } else if (execution.kind === 'output') {
        appendHistory([
          { id: commandId, type: 'command', content: command },
          { id: getHistoryId(), type: 'output', result: execution.result },
        ])
      }

      setCommandHistory((previous) =>
        [...previous, command].slice(-MAX_COMMAND_HISTORY),
      )
      setHistoryIndex(commandHistory.length + 1)
      setInput('')
      window.requestAnimationFrame(() => inputRef.current?.focus())
    },
    [
      appendHistory,
      cancelEasterEgg,
      commandHistory.length,
      startEasterEgg,
    ],
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    runCommand(input)
  }

  const handleInputKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) => {
    if (soundEnabled && !event.repeat) playKeySound()

    if (event.key === 'Enter') {
      event.preventDefault()
      runCommand(input)
      return
    }

    if (event.key === 'Tab') {
      const completed = autocompleteCommand(input)
      if (completed !== input) {
        event.preventDefault()
        setInput(completed)
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!commandHistory.length) return
      const nextIndex = Math.max(0, historyIndex - 1)
      setHistoryIndex(nextIndex)
      setInput(commandHistory[nextIndex] ?? '')
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const nextIndex = Math.min(commandHistory.length, historyIndex + 1)
      setHistoryIndex(nextIndex)
      setInput(commandHistory[nextIndex] ?? '')
    }
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
    <div className="terminal-container">
      <header className="terminal-header">
        <div className="terminal-buttons" aria-hidden="true">
          <span className="terminal-button close" />
          <span className="terminal-button minimize" />
          <span className="terminal-button maximize" />
        </div>
        <div className="terminal-title">guest@zhangmin.name:~</div>
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

      <main className="terminal-body">
        <section className="brand-art" aria-labelledby="site-title">
          <div className="brand-command" aria-hidden="true">
            <span className="brand-chevron">&gt;</span>
            <span className="brand-cursor" />
          </div>
          <h1 id="site-title">
            ZhangMin<span>.name</span>
          </h1>
          <p className="brand-motto">{PROFILE.motto}</p>
          <p className="brand-focus">
            {PROFILE.focus.map((item, index) => (
              <span key={item}>
                {index > 0 && <b aria-hidden="true">·</b>}
                {item}
              </span>
            ))}
          </p>
          <p className="brand-intro">{PROFILE.intro}</p>
          <div className="hero-actions">
            <a className="primary-link" href="#selected-projects">
              查看代表项目
            </a>
            <button
              type="button"
              className="secondary-action"
              onClick={() => runCommand('about')}
            >
              在终端认识我
            </button>
          </div>
        </section>

        <div className="portfolio-grid">
          <section className="terminal-session" aria-labelledby="terminal-title">
            <div className="session-heading">
              <div>
                <p className="section-eyebrow">INTERACTIVE MODE</p>
                <h2 id="terminal-title">终端探索</h2>
              </div>
              <button
                type="button"
                className="help-action"
                onClick={() => runCommand('help')}
              >
                命令帮助
              </button>
            </div>

            <p className="terminal-hint">
              输入命令，或直接选择快捷入口。试试{' '}
              <button type="button" onClick={() => runCommand('projects')}>
                projects
              </button>
              。
            </p>

            <div
              className="quick-command-list"
              aria-label="快捷命令"
            >
              {QUICK_COMMANDS.map((command) => (
                <button
                  key={command}
                  type="button"
                  onClick={() => runCommand(command)}
                >
                  {command}
                </button>
              ))}
            </div>

            <div
              className="terminal-history"
              ref={historyRef}
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
                      <span className="prompt" aria-hidden="true">
                        <span className="user">guest</span>
                        <span>@</span>
                        <span className="host">zhangmin.name</span>
                        <span>:</span>
                        <span className="path">~</span>
                        <span className="dollar">$</span>
                      </span>
                      <span>{item.content}</span>
                    </>
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
              <span className="prompt" aria-hidden="true">
                <span className="user">guest</span>
                <span>@</span>
                <span className="host">zhangmin.name</span>
                <span>:</span>
                <span className="path">~</span>
                <span className="dollar">$</span>
              </span>
              <input
                ref={inputRef}
                id="terminal-command"
                type="text"
                value={input}
                onChange={(event) => {
                  setInput(event.target.value)
                  setHistoryIndex(commandHistory.length)
                }}
                onKeyDown={handleInputKeyDown}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="text"
                aria-describedby="terminal-input-hint"
              />
              <span id="terminal-input-hint" className="sr-only">
                使用 Tab 补全命令，使用上下方向键浏览历史。
              </span>
              <button type="submit" className="sr-only">
                执行命令
              </button>
            </form>
          </section>

          <ProjectShowcase />
        </div>
      </main>

      <nav className="mobile-command-bar" aria-label="移动端快捷命令">
        {QUICK_COMMANDS.map((command) => (
          <button
            key={command}
            type="button"
            onClick={() => runCommand(command)}
          >
            {command}
          </button>
        ))}
      </nav>

      {finePointer && visualizerEnabled && (
        <Suspense fallback={null}>
          <InputVisualizer />
        </Suspense>
      )}
    </div>
  )
}
