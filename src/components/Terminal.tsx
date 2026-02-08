import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { executeCommand, getWelcomeMessage } from '../commands'
import { HistoryItem } from '../types'
import './Terminal.css'

export default function Terminal() {
  const [history, setHistory] = useState<HistoryItem[]>([
    { type: 'output', content: getWelcomeMessage() }
  ])
  const [input, setInput] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const terminalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [history])

  const handleSubmit = () => {
    if (!input.trim()) {
      setHistory(prev => [...prev, { type: 'command', content: '' }])
      return
    }

    const cmd = input.trim()
    const output = executeCommand(cmd)

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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex
        setHistoryIndex(newIndex)
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '')
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '')
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setInput('')
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      // Simple tab completion
      const commands = ['help', 'about', 'skills', 'projects', 'contact', 'clear', 'echo', 'whoami', 'date', 'neofetch']
      const matches = commands.filter(cmd => cmd.startsWith(input.toLowerCase()))
      if (matches.length === 1) {
        setInput(matches[0])
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setHistory([])
    }
  }

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
          <input
            ref={inputRef}
            type="text"
            className="terminal-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  )
}
