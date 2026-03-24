# Suggested Commands

## Development
- `bun run dev` — Start server (--watch) + Vite dev server, hot reloads both
- `bun run build` — Build all workspaces (only client produces output)
- `bun run typecheck` — Run tsc across all workspaces

## Testing
- `bunx playwright test` — Run all Playwright tests (server must be running on :7654)
- `bunx playwright test tests/session-flow.spec.ts` — Run single test file

## Type Checking (per-workspace, as CI does it)
- `bunx tsc -p shared/tsconfig.json` — Build shared types (must run first)
- `bunx tsc --noEmit -p server/tsconfig.json` — Typecheck server
- `bunx tsc --noEmit -p client/tsconfig.json` — Typecheck client

## Client Build
- `cd client && npx vite build` — Build client for production

## Server
- `bun run server/src/index.ts daemon` — Run server daemon directly
- `bun run server/src/index.ts daemon --port 8080` — Custom port
- Default port: 7654, binds to 0.0.0.0

## Environment
- `ANTHROPIC_API_KEY` — Optional, uses `claude setup-token` if not set
- `DEBUG=lattice:*` — Enable structured debug logging

## Git
- Commit messages: Angular Commit Convention (feat/fix/refactor/etc)
- Releases: automated via semantic-release on push to main
- Never add AI attribution to commits
