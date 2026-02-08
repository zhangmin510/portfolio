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

- `src/components/Terminal.tsx` - Main terminal UI component with input handling, command history (↑/↓), and tab completion
- `src/commands/index.ts` - Command registry and execution logic. Add new commands in the `executeCommand` switch statement
- `src/styles/index.css` - CSS variables for theming (colors defined in `:root`)

### Adding a New Command

Edit `src/commands/index.ts`:
1. Add command case in `executeCommand()` function
2. Use HTML spans with classes like `highlight`, `accent`, `error`, `link` for styling

### Customizing Content

All personal info (about, skills, projects, contact) is defined as constants in `src/commands/index.ts`. Replace the placeholder data with real information.
