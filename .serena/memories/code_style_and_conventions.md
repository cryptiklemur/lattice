# Code Style and Conventions

## JavaScript/TypeScript
- Use `const`/`let` (NOT `var`)
- Use named function declarations, not arrow functions — except for anonymous callbacks where arrows are fine
- ESM throughout (server + client)
- Follow .editorconfig: 2-space indent, LF line endings, UTF-8

## Icons
- Use `lucide-react` for ALL icons
- Import individually: `import { Settings, Moon } from "lucide-react"`
- No emojis for icons or in UI

## Comments
- No section separator comments (// ========)
- No organizational header comments
- Keep code clean without visual separators

## Design System
- See `.impeccable.md` for comprehensive design guidelines
- Dark-first with 23 base16 themes via OKLCH CSS variables
- Tailwind + daisyUI component framework
- Typography: JetBrains Mono (headings/code), IBM Plex Sans (body)
- Three surface tiers: Chrome (base-200), Stage (base-100 + dot-grid), Elevated (base-300 + shadow)
- Never hardcode colors — always use CSS variables/theme tokens
- WCAG AA contrast, prefers-reduced-motion, keyboard-first

## Types
- `HistoryMessage` uses a discriminated union type (`HistoryMessageType`)
- Shared types in `shared/src/models.ts`
- Message protocol in `shared/src/messages.ts`
- All `var` in existing code is legacy — new code should use `const`/`let`

## Pre-existing Errors
- DO NOT EVER LEAVE PRE-EXISTING ERRORS. FIX THEM.
