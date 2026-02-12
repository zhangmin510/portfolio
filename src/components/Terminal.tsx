import { useState, useRef, useEffect } from 'react'
import { executeCommand, getWelcomeMessage } from '../commands'
import { HistoryItem } from '../types'
import './Terminal.css'

const audioCtx = new AudioContext()

// 生成白噪声 buffer（复用）
const noiseBuffer = (() => {
  const size = audioCtx.sampleRate * 0.1
  const buf = audioCtx.createBuffer(1, size, audioCtx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1
  return buf
})()

function playKeySound() {
  if (audioCtx.state === 'suspended') audioCtx.resume()
  const t = audioCtx.currentTime
  const v = 0.8 + Math.random() * 0.4 // 每次按键音量微变

  // === 1. Click：Cherry 轴段落感的清脆咔嗒 ===
  const clickSrc = audioCtx.createBufferSource()
  clickSrc.buffer = noiseBuffer
  const clickBP = audioCtx.createBiquadFilter()
  clickBP.type = 'bandpass'
  clickBP.frequency.value = 3500 + Math.random() * 1000
  clickBP.Q.value = 2.5
  const clickGain = audioCtx.createGain()
  clickGain.gain.setValueAtTime(0.25 * v, t)
  clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015)
  clickSrc.connect(clickBP).connect(clickGain).connect(audioCtx.destination)
  clickSrc.start(t)
  clickSrc.stop(t + 0.015)

  // === 2. Thock：触底的低沉敲击声 ===
  const thockSrc = audioCtx.createBufferSource()
  thockSrc.buffer = noiseBuffer
  const thockLP = audioCtx.createBiquadFilter()
  thockLP.type = 'lowpass'
  thockLP.frequency.value = 800 + Math.random() * 200
  thockLP.Q.value = 1.2
  const thockGain = audioCtx.createGain()
  thockGain.gain.setValueAtTime(0.0001, t)
  thockGain.gain.linearRampToValueAtTime(0.18 * v, t + 0.003)
  thockGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
  thockSrc.connect(thockLP).connect(thockGain).connect(audioCtx.destination)
  thockSrc.start(t + 0.002) // 略延迟，模拟触底在 click 之后
  thockSrc.stop(t + 0.06)

  // === 3. 金属弹簧回弹的高频尾音 ===
  const springSrc = audioCtx.createBufferSource()
  springSrc.buffer = noiseBuffer
  const springHP = audioCtx.createBiquadFilter()
  springHP.type = 'highpass'
  springHP.frequency.value = 6000
  springHP.Q.value = 3
  const springGain = audioCtx.createGain()
  springGain.gain.setValueAtTime(0.0001, t + 0.01)
  springGain.gain.linearRampToValueAtTime(0.06 * v, t + 0.015)
  springGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045)
  springSrc.connect(springHP).connect(springGain).connect(audioCtx.destination)
  springSrc.start(t + 0.01)
  springSrc.stop(t + 0.045)
}

export default function Terminal() {
  const [history, setHistory] = useState<HistoryItem[]>([
    { type: 'output', content: getWelcomeMessage() }
  ])
  const [input, setInput] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [, setHistoryIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const terminalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.altKey) return
      playKeySound()
      if (e.key === 'Enter') {
        handleSubmitRef.current()
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setInput(prev => prev.slice(0, -1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const cmds = commandHistoryRef.current
        if (cmds.length > 0) {
          setHistoryIndex(prev => {
            const next = prev < cmds.length - 1 ? prev + 1 : prev
            setInput(cmds[cmds.length - 1 - next] || '')
            return next
          })
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHistoryIndex(prev => {
          if (prev > 0) {
            const next = prev - 1
            setInput(commandHistoryRef.current[commandHistoryRef.current.length - 1 - next] || '')
            return next
          } else if (prev === 0) {
            setInput('')
            return -1
          }
          return prev
        })
      } else if (e.key === 'Tab') {
        e.preventDefault()
        const commands = ['help', 'about', 'skills', 'projects', 'contact', 'clear', 'echo', 'whoami', 'date', 'neofetch']
        setInput(prev => {
          const matches = commands.filter(cmd => cmd.startsWith(prev.toLowerCase()))
          return matches.length === 1 ? matches[0] : prev
        })
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault()
        setHistory([])
      } else if (e.key.length === 1 && !e.ctrlKey) {
        setInput(prev => prev + e.key)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [history])

  const eggTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const playHelloWorldEgg = () => {
    // 清理之前可能残留的定时器
    eggTimers.current.forEach(clearTimeout)
    eggTimers.current = []

    const asciiArt = [
      '',
      '<span class="ascii-art hello-world-art">',
      '  ██╗  ██╗███████╗██╗     ██╗      ██████╗ ',
      '  ██║  ██║██╔════╝██║     ██║     ██╔═══██╗',
      '  ███████║█████╗  ██║     ██║     ██║   ██║',
      '  ██╔══██║██╔══╝  ██║     ██║     ██║   ██║',
      '  ██║  ██║███████╗███████╗███████╗╚██████╔╝',
      '  ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝ ╚═════╝ </span>',
      '',
      '<span class="ascii-art hello-world-art">',
      '  ██╗    ██╗ ██████╗ ██████╗ ██╗     ██████╗  ██╗',
      '  ██║    ██║██╔═══██╗██╔══██╗██║     ██╔══██╗ ██║',
      '  ██║ █╗ ██║██║   ██║██████╔╝██║     ██║  ██║ ██║',
      '  ██║███╗██║██║   ██║██╔══██╗██║     ██║  ██║ ╚═╝',
      '  ╚███╔███╔╝╚██████╔╝██║  ██║███████╗██████╔╝ ██╗',
      '   ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═════╝  ╚═╝</span>',
      '',
      '  <span class="dim">// The program that started it all.</span>',
      '',
      '  <span class="highlight">C (1972)</span>        printf(<span class="accent">"Hello, World!\\n"</span>);',
      '  <span class="highlight">Python</span>          print(<span class="accent">"Hello, World!"</span>)',
      '  <span class="highlight">JavaScript</span>      console.log(<span class="accent">"Hello, World!"</span>)',
      '  <span class="highlight">Go</span>              fmt.Println(<span class="accent">"Hello, World!"</span>)',
      '  <span class="highlight">Rust</span>            println!(<span class="accent">"Hello, World!"</span>);',
      '  <span class="highlight">Java</span>            System.out.println(<span class="accent">"Hello, World!"</span>);',
      '  <span class="highlight">Brainfuck</span>       +[-->-[>>+>-----<<]<--<---]>-.>>>+.>>..+++[.>]<<<<.+++.------.<<-.>>>>+.',
      '',
      '  <span class="dim">// And then came the AI era...</span>',
      '',
      '  <span class="highlight">Prompt</span>          <span class="accent">"Write a Hello World program"</span>',
      '  <span class="highlight">MCP Tool</span>        {<span class="accent">"tool"</span>: <span class="accent">"hello"</span>, <span class="accent">"input"</span>: <span class="accent">"world"</span>}',
      '  <span class="highlight">LangChain</span>       chain.invoke({<span class="accent">"message"</span>: <span class="accent">"Hello, World!"</span>})',
      '  <span class="highlight">Cursor/Copilot</span>  <span class="dim">// Just type "hel" and Tab...</span> <span class="accent">Hello, World!</span>',
      '  <span class="highlight">Vibe Coding</span>     <span class="accent">"Build me a hello world app with animations"</span> <span class="dim">// Ship it!</span>',
      '',
      '  <span class="dim">1972: We wrote <span class="highlight">Hello, World!</span> to talk to machines.</span>',
      '  <span class="dim">2025: We say <span class="highlight">Hello, World!</span> and machines write it for us.</span>',
      '',
      '  <span class="dim">Every master was once a beginner.</span>',
      '  <span class="dim">Every expert was once a novice.</span>',
      '  <span class="dim">It all starts with <span class="highlight">Hello, World!</span></span>',
      '',
    ]

    // 先添加命令行
    setHistory(prev => [...prev, { type: 'command', content: 'hello world' }])
    // 添加空的输出占位
    setHistory(prev => [...prev, { type: 'output', content: '' }])

    let accumulated = ''
    asciiArt.forEach((line, i) => {
      const timer = setTimeout(() => {
        accumulated += (i > 0 ? '\n' : '') + line
        const snapshot = accumulated
        setHistory(prev => {
          const next = [...prev]
          next[next.length - 1] = { type: 'output', content: snapshot }
          return next
        })
      }, i * 60)
      eggTimers.current.push(timer)
    })
  }

  const handleSubmit = () => {
    if (!input.trim()) {
      setHistory(prev => [...prev, { type: 'command', content: '' }])
      return
    }

    const cmd = input.trim()
    const output = executeCommand(cmd)

    if (output === '__EASTER_EGG_HELLO_WORLD__') {
      setCommandHistory(prev => [...prev, cmd])
      setHistoryIndex(-1)
      setInput('')
      playHelloWorldEgg()
      return
    }

    if (cmd.toLowerCase() === 'clear') {
      setHistory([])
    } else {
      setHistory(prev => [
        ...prev,
        { type: 'command', content: cmd },
        { type: 'output', content: output }
      ])
    }

    setCommandHistory(prev => [...prev, cmd])
    setHistoryIndex(-1)
    setInput('')
  }

  const handleSubmitRef = useRef(handleSubmit)
  handleSubmitRef.current = handleSubmit

  const commandHistoryRef = useRef(commandHistory)
  commandHistoryRef.current = commandHistory

  const focusInput = () => {
    inputRef.current?.focus()
  }

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <div className="terminal-buttons">
          <span className="terminal-button close"></span>
          <span className="terminal-button minimize"></span>
          <span className="terminal-button maximize"></span>
        </div>
        <div className="terminal-title">guest@portfolio:~</div>
        <div className="terminal-buttons-placeholder"></div>
      </div>
      <div className="terminal-body" ref={terminalRef} onClick={focusInput}>
        {history.map((item, index) => (
          <div key={index} className={`terminal-line ${item.type}`}>
            {item.type === 'command' && (
              <span className="prompt">
                <span className="user">guest</span>
                <span className="at">@</span>
                <span className="host">portfolio</span>
                <span className="colon">:</span>
                <span className="path">~</span>
                <span className="dollar">$</span>
              </span>
            )}
            <span
              className="content"
              dangerouslySetInnerHTML={{ __html: item.content }}
            />
          </div>
        ))}
        <div className="terminal-line input-line">
          <span className="prompt">
            <span className="user">guest</span>
            <span className="at">@</span>
            <span className="host">portfolio</span>
            <span className="colon">:</span>
            <span className="path">~</span>
            <span className="dollar">$</span>
          </span>
          <div className="input-area">
            <span className="input-display">
              <span className="input-text">{input}</span>
              <span className="terminal-cursor" />
            </span>
            <input
              ref={inputRef}
              type="text"
              className="terminal-input"
              value={input}
              readOnly
              tabIndex={-1}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
