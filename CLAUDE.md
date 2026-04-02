# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Structure
Bun monorepo with three workspaces:
- `shared/` — TypeScript types and constants (no build, imported directly)
- `server/` — Bun daemon serving WebSocket API + static client assets on port 7654
- `client/` — React 19 + Vite + Tailwind + daisyUI web app

## Commands
- `bun run dev` — starts server (--watch) + Vite dev server, hot reloads both
- `bun run build` — builds all workspaces (only client produces output)
- `bun run typecheck` — runs tsc across all workspaces
- `bunx playwright test` — runs Playwright tests (server must be running on :7654)
- Single test: `bunx playwright test tests/session-flow.spec.ts`

## Coding Standards
- Use `const`/`let` (not `var`). Use named function declarations, not arrow functions — except for anonymous callbacks where arrows are fine.
- No emojis for icons or in UI. Use `lucide-react` for all icons.
- No section separator comments or organizational comments.
- Follow .editorconfig (2-space indent, LF, UTF-8).
- Server: ESM with Bun. Client: ESM with Vite + React.

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
- Server binds to 0.0.0.0:7654 in production, 0.0.0.0:17654 in dev (WSL2 compatible).
- Client dev server runs on :5173 and proxies to :17654. Production serves from server via client/dist/.
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
LATTICE_HOME=/tmp/lattice-test-node LATTICE_PORT=7655 bun server/src/index.ts daemon
```
Then pair the two instances via the UI or WebSocket:
```bash
# Generate invite on :7654, then pair from :7655:
bun -e "
var ws = new WebSocket('ws://localhost:7655/ws');
ws.onopen = function() { ws.send(JSON.stringify({ type: 'mesh:pair', code: 'LTCE-XXXX-...' })); };
ws.onmessage = function(e) { console.log(JSON.parse(e.data).type); };
"
```
The test instance serves from `client/dist/` (run `bun run build` first for UI access on :7655).
Clean up: `rm -rf /tmp/lattice-test-node`
