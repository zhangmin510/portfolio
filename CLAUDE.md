# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev      # Start development server (http://localhost:5173)
npm run build    # TypeScript check + production build
npm run preview  # Preview production build locally
```

## Architecture

Terminal-style portfolio built with React + TypeScript + Vite.

### Key Files

- `src/components/Terminal.tsx` - Main terminal UI component with input handling, command history (↑/↓), tab completion, auto-focus, key sound effects, and hello world easter egg
- `src/components/Terminal.css` - Terminal styling, custom block cursor with blink animation
- `src/commands/index.ts` - Command registry and execution logic. Add new commands in the `executeCommand` switch statement
- `src/components/InputVisualizer.tsx` - Fixed bottom-right virtual keyboard & mouse that highlights on physical input
- `src/components/InputVisualizer.css` - InputVisualizer styling (semi-transparent, pointer-events: none, hidden on mobile)
- `src/data/keyboardLayout.ts` - Keyboard layout data using `KeyboardEvent.code` for physical key mapping
- `src/styles/index.css` - CSS variables for theming (colors defined in `:root`)

### Adding a New Command

Edit `src/commands/index.ts`:
1. Add command case in `executeCommand()` function
2. Use HTML spans with classes like `highlight`, `accent`, `error`, `link` for styling

### Easter Eggs

- `hello world` - ASCII art animation showing Hello World across programming languages and the AI era
- DevTools console message (see `src/commands/index.ts`)

### Customizing Content

All personal info (about, skills, projects, contact) is defined as constants in `src/commands/index.ts`. Replace the placeholder data with real information.
