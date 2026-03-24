# Task Completion Checklist

When a coding task is completed, verify the following:

1. **Type check** — Run `bunx tsc --noEmit -p client/tsconfig.json` and `bunx tsc --noEmit -p server/tsconfig.json` (build shared first with `bunx tsc -p shared/tsconfig.json`)
2. **Build** — Run `cd client && npx vite build` to verify client builds
3. **Server build** — Run `bun build server/src/index.ts --target=bun --outdir=/tmp/check` to verify server bundles
4. **No pre-existing errors** — Fix any errors you encounter, don't leave them
5. **Code style** — const/let (not var), named functions (not arrows except callbacks), lucide-react icons only
6. **Git** — Only commit when explicitly asked. Angular Commit Convention. No AI attribution.

## Important Notes
- The PWA service worker caches old bundles. After rebuilding client, users need to clear SW cache in browser to see changes.
- Server serves from `client/dist/` (built output), NOT from Vite dev server. Client changes require `npx vite build` to appear on port 7654.
- Vite dev server runs on :5173 separately but can't connect WebSocket without the Bun server on :7654.
