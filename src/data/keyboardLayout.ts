export interface KeyDef {
  label: string
  codes: string[]
  width: number
}

export const KEYBOARD_LAYOUT: KeyDef[][] = [
  // Row 1: Number row
  [
    { label: 'Esc', codes: ['Escape'], width: 1 },
    { label: '`', codes: ['Backquote'], width: 1 },
    { label: '1', codes: ['Digit1'], width: 1 },
    { label: '2', codes: ['Digit2'], width: 1 },
    { label: '3', codes: ['Digit3'], width: 1 },
    { label: '4', codes: ['Digit4'], width: 1 },
    { label: '5', codes: ['Digit5'], width: 1 },
    { label: '6', codes: ['Digit6'], width: 1 },
    { label: '7', codes: ['Digit7'], width: 1 },
    { label: '8', codes: ['Digit8'], width: 1 },
    { label: '9', codes: ['Digit9'], width: 1 },
    { label: '0', codes: ['Digit0'], width: 1 },
    { label: '-', codes: ['Minus'], width: 1 },
    { label: '=', codes: ['Equal'], width: 1 },
    { label: 'Bksp', codes: ['Backspace'], width: 1.5 },
  ],
  // Row 2: QWERTY row
  [
    { label: 'Tab', codes: ['Tab'], width: 1.5 },
    { label: 'Q', codes: ['KeyQ'], width: 1 },
    { label: 'W', codes: ['KeyW'], width: 1 },
    { label: 'E', codes: ['KeyE'], width: 1 },
    { label: 'R', codes: ['KeyR'], width: 1 },
    { label: 'T', codes: ['KeyT'], width: 1 },
    { label: 'Y', codes: ['KeyY'], width: 1 },
    { label: 'U', codes: ['KeyU'], width: 1 },
    { label: 'I', codes: ['KeyI'], width: 1 },
    { label: 'O', codes: ['KeyO'], width: 1 },
    { label: 'P', codes: ['KeyP'], width: 1 },
    { label: '[', codes: ['BracketLeft'], width: 1 },
    { label: ']', codes: ['BracketRight'], width: 1 },
    { label: '\\', codes: ['Backslash'], width: 1.5 },
  ],
  // Row 3: Home row
  [
    { label: 'Caps', codes: ['CapsLock'], width: 1.75 },
    { label: 'A', codes: ['KeyA'], width: 1 },
    { label: 'S', codes: ['KeyS'], width: 1 },
    { label: 'D', codes: ['KeyD'], width: 1 },
    { label: 'F', codes: ['KeyF'], width: 1 },
    { label: 'G', codes: ['KeyG'], width: 1 },
    { label: 'H', codes: ['KeyH'], width: 1 },
    { label: 'J', codes: ['KeyJ'], width: 1 },
    { label: 'K', codes: ['KeyK'], width: 1 },
    { label: 'L', codes: ['KeyL'], width: 1 },
    { label: ';', codes: ['Semicolon'], width: 1 },
    { label: "'", codes: ['Quote'], width: 1 },
    { label: 'Enter', codes: ['Enter'], width: 2.25 },
  ],
  // Row 4: Shift row
  [
    { label: 'Shift', codes: ['ShiftLeft'], width: 2.25 },
    { label: 'Z', codes: ['KeyZ'], width: 1 },
    { label: 'X', codes: ['KeyX'], width: 1 },
    { label: 'C', codes: ['KeyC'], width: 1 },
    { label: 'V', codes: ['KeyV'], width: 1 },
    { label: 'B', codes: ['KeyB'], width: 1 },
    { label: 'N', codes: ['KeyN'], width: 1 },
    { label: 'M', codes: ['KeyM'], width: 1 },
    { label: ',', codes: ['Comma'], width: 1 },
    { label: '.', codes: ['Period'], width: 1 },
    { label: '/', codes: ['Slash'], width: 1 },
    { label: 'Shift', codes: ['ShiftRight'], width: 2.75 },
  ],
  // Row 5: Modifier row + Space
  [
    { label: 'Ctrl', codes: ['ControlLeft'], width: 1.5 },
    { label: 'Opt', codes: ['AltLeft'], width: 1.25 },
    { label: 'Cmd', codes: ['MetaLeft'], width: 1.5 },
    { label: '', codes: ['Space'], width: 5.5 },
    { label: 'Cmd', codes: ['MetaRight'], width: 1.5 },
    { label: 'Opt', codes: ['AltRight'], width: 1.25 },
    { label: 'Ctrl', codes: ['ControlRight'], width: 1.5 },
  ],
]
