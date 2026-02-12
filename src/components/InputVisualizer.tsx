import { useEffect, useState, useCallback } from 'react'
import { KEYBOARD_LAYOUT } from '../data/keyboardLayout'
import './InputVisualizer.css'

export default function InputVisualizer() {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(() => new Set())
  const [pressedButtons, setPressedButtons] = useState<Set<number>>(() => new Set())
  const [scrollActive, setScrollActive] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    setPressedKeys(prev => {
      if (prev.has(e.code)) return prev
      const next = new Set(prev)
      next.add(e.code)
      return next
    })
  }, [])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    setPressedKeys(prev => {
      if (!prev.has(e.code)) return prev
      const next = new Set(prev)
      next.delete(e.code)
      return next
    })
  }, [])

  const handleMouseDown = useCallback((e: MouseEvent) => {
    setPressedButtons(prev => {
      if (prev.has(e.button)) return prev
      const next = new Set(prev)
      next.add(e.button)
      return next
    })
  }, [])

  const handleMouseUp = useCallback((e: MouseEvent) => {
    setPressedButtons(prev => {
      if (!prev.has(e.button)) return prev
      const next = new Set(prev)
      next.delete(e.button)
      return next
    })
  }, [])

  const handleWheel = useCallback(() => {
    setScrollActive(true)
  }, [])

  const handleBlur = useCallback(() => {
    setPressedKeys(new Set())
    setPressedButtons(new Set())
    setScrollActive(false)
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    window.addEventListener('mousedown', handleMouseDown, true)
    window.addEventListener('mouseup', handleMouseUp, true)
    window.addEventListener('wheel', handleWheel, true)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('mousedown', handleMouseDown, true)
      window.removeEventListener('mouseup', handleMouseUp, true)
      window.removeEventListener('wheel', handleWheel, true)
      window.removeEventListener('blur', handleBlur)
    }
  }, [handleKeyDown, handleKeyUp, handleMouseDown, handleMouseUp, handleWheel, handleBlur])

  // Scroll flash timeout
  useEffect(() => {
    if (!scrollActive) return
    const timer = setTimeout(() => setScrollActive(false), 150)
    return () => clearTimeout(timer)
  }, [scrollActive])

  const isKeyActive = (codes: string[]) =>
    codes.some(code => pressedKeys.has(code))

  return (
    <div className="input-visualizer">
      {/* Keyboard */}
      <div className="iv-keyboard">
        {KEYBOARD_LAYOUT.map((row, ri) => (
          <div className="iv-row" key={ri}>
            {row.map((key, ki) => (
              <div
                className={`iv-key${isKeyActive(key.codes) ? ' active' : ''}`}
                style={{ '--key-width': key.width } as React.CSSProperties}
                key={ki}
              >
                {key.label}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Mouse */}
      <div className="iv-mouse">
        <div className="iv-mouse-buttons">
          <div className={`iv-mouse-btn left${pressedButtons.has(0) ? ' active' : ''}`} />
          <div className={`iv-mouse-btn middle${pressedButtons.has(1) || scrollActive ? ' active' : ''}`} />
          <div className={`iv-mouse-btn right${pressedButtons.has(2) ? ' active' : ''}`} />
        </div>
        <div className="iv-mouse-body" />
      </div>
    </div>
  )
}
