# Lattice — Project Rules

## Icons
- Use `lucide-react` for ALL icons. Never write custom/inline SVG icons.
- Import icons individually: `import { Settings, Moon, Sun } from "lucide-react"`

## Coding Standards
- Use `var` instead of `const`/`let`. No arrow functions.
- Server-side: ESM with Bun. Client-side: ESM with Vite + React.
- No emojis for icons or in UI.
- No section separator comments or organizational comments.
- One class per file.
- Follow .editorconfig (2-space indent, LF, UTF-8).

## Git
- Never add "Co-Authored-By" lines mentioning Claude/AI.
- Commit messages follow Angular Commit Convention.
- Only commit when explicitly asked.

## Development
- Use `bun run dev` to start the development server — it hot reloads both the server and the web app automatically. No manual restart needed after code changes.

## Pre-existing Errors
- DO NOT EVER LEAVE PRE-EXISTING ERRORS, FIX THEM.

## Design Context
See `.impeccable.md` for comprehensive design guidelines. Key principles:
- **Personality**: Precise, Technical, Calm — quiet authority, no fluff
- **Emotions**: Control & Mastery, Trust & Reliability
- **Dark-first** with 23 base16 themes via OKLCH color space
- **Typography**: JetBrains Mono (headings/code), IBM Plex Sans (body)
- **Three surface tiers**: Chrome (base-200), Stage (base-100 + dot-grid), Elevated (base-300 + shadow)
- **Design principles**: Earn every pixel, quiet confidence, state is sacred, dense but breathable, theme-native
- **Accessibility**: WCAG AA, reduced motion, high contrast, color blind safe, mobile/responsive, keyboard-first
- **Anti-patterns**: No gratuitous animation, no emoji icons, no hardcoded colors, no "AI slop" aesthetics
