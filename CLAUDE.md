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

- `src/data/portfolio.ts` - Single source of truth for profile, skills, projects, and yearly keywords
- `src/components/Terminal.tsx` - Semantic portfolio shell plus scoped terminal input, history, sound preference, and hello world easter egg
- `src/components/CommandOutput.tsx` - Safe React rendering for rich command results; user input must never use `dangerouslySetInnerHTML`
- `src/components/Terminal.css` - Responsive portfolio and terminal styling
- `src/commands/index.ts` - Single command registry used for execution, help, shortcuts, and completion
- `src/components/InputVisualizer.tsx` - Fixed bottom-right virtual keyboard & mouse that highlights on physical input
- `src/entry-server.tsx` + `scripts/prerender.mjs` - Production static prerendering
- `worker/index.js` - Cache policy, security headers, and real 404 responses
- `src/data/keyboardLayout.ts` - Keyboard layout data using `KeyboardEvent.code` for physical key mapping
- `src/styles/index.css` - CSS variables for theming (colors defined in `:root`)

### Adding a New Command

1. Add one command definition in `src/commands/index.ts`.
2. Add a typed `CommandResult` variant only when a new output shape is needed.
3. Render that variant in `src/components/CommandOutput.tsx`.
4. Add or update tests in `src/commands/index.test.ts`.

### Easter Eggs

- `hello world` - ASCII art animation showing Hello World across programming languages and the AI era
- DevTools console message (see `src/commands/index.ts`)

### Customizing Content

All public personal content is defined in `src/data/portfolio.ts`. Do not publish private contact data or invent project metrics.
