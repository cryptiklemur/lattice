# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Structure
Single npm package with three source directories:
- `src/shared/` — TypeScript types and constants (no build, imported via `#shared` subpath import)
- `src/server/` — Express + ws daemon serving WebSocket API + static client assets on port 7654
- `src/client/` — React 19 + Vite + Tailwind + daisyUI web app

## Commands
- `npm run dev` — starts Express server with Vite middleware mode (single port, HMR)
- `npm run build` — runs `vite build`, outputs to `dist/client/`
- `npm run typecheck` — runs `tsc --noEmit`
- `npx playwright test` — runs Playwright tests (server must be running on :7654)
- Single test: `npx playwright test tests/session-flow.spec.ts`

## Coding Standards
- Use `const`/`let` (not `var`). Use named function declarations, not arrow functions — except for anonymous callbacks where arrows are fine.
- No emojis for icons or in UI. Use `lucide-react` for all icons.
- No section separator comments or organizational comments.
- Follow .editorconfig (2-space indent, LF, UTF-8).
- Server: ESM with Node.js (tsx). Client: ESM with Vite + React.

## Git
- Never add "Co-Authored-By" lines mentioning Claude/AI.
- Commit messages follow Angular Commit Convention (feat/fix/refactor/etc).
- Only commit when explicitly asked.
- Releases are automated via semantic-release on push to main.

## Design
See `.impeccable.md` for comprehensive design guidelines. Key constraints:
- Dark-first with 23 base16 themes via OKLCH CSS variables
- Tailwind + daisyUI component framework
- Typography: JetBrains Mono (headings/code), IBM Plex Sans (body)
- Three surface tiers: Chrome (base-200), Stage (base-100 + dot-grid), Elevated (base-300 + shadow)
- Never hardcode colors — always use CSS variables/theme tokens
- WCAG AA contrast, prefers-reduced-motion, keyboard-first

## Pre-existing Errors
DO NOT EVER LEAVE PRE-EXISTING ERRORS. FIX THEM.

## Environment
- ANTHROPIC_API_KEY is optional — server uses the token from `claude setup-token` if not set.
- Single port: Express server on 0.0.0.0:7654 serves both API/WS and client (Vite middleware in dev, static files in production).
- `LATTICE_HOME` — override data directory (default: `~/.lattice`).
- `LATTICE_PORT` — override server port (default: 7654). Also: `--port=N`.

## Testing
- Playwright tests live in `tests/` at the project root.
- Tests require the server running on localhost:7654.
- Screenshots on failure go to `test-results/`.
- Use Playwright MCP for visual verification. Save screenshots to `.playwright-mcp/`.

### Testing Mesh/Node Functionality
Run a second Lattice instance with a separate data directory and port:
```bash
LATTICE_HOME=/tmp/lattice-test-node NODE_ENV=production npx tsx src/server/index.ts daemon --port 7655
```
Then pair the two instances via the UI or WebSocket:
```bash
# Generate invite on :7654, then pair from :7655:
node -e "
var ws = new (require('ws').WebSocket)('ws://localhost:7655/ws');
ws.on('open', function() { ws.send(JSON.stringify({ type: 'mesh:pair', code: 'LTCE-XXXX-...' })); });
ws.on('message', function(d) { console.log(JSON.parse(d).type); });
"
```
The test instance serves from `dist/client/` (run `npm run build` first for UI access on :7655).
Clean up: `rm -rf /tmp/lattice-test-node`
