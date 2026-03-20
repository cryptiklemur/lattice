# PWA, Offline Mode & Notifications

## Overview

Enhance Lattice with full PWA support: service worker with Workbox precaching via `vite-plugin-pwa`, offline/disconnected read-only mode with disabled inputs and a persistent banner, a custom app install prompt, and browser notifications for key events (gated by idle detection).

## 1. Service Worker (vite-plugin-pwa + Workbox)

### Setup

Add `vite-plugin-pwa` to the client. Configure in `client/vite.config.ts`:

```typescript
VitePWA({
  registerType: "prompt",
  workbox: {
    globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
    navigateFallback: "/index.html",
    runtimeCaching: [
      {
        urlPattern: /^https?:\/\/.*\/ws/,
        handler: "NetworkOnly",
      },
      {
        urlPattern: /^https?:\/\/.*\.(js|css|woff2|svg|png)$/,
        handler: "CacheFirst",
        options: {
          cacheName: "static-assets",
          expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
    ],
  },
  manifest: {
    name: "Lattice",
    short_name: "Lattice",
    description: "Multi-machine agentic dashboard for Claude Code",
    display: "standalone",
    start_url: "/",
    theme_color: "#0d0d0d",
    background_color: "#0d0d0d",
    icons: [
      { src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "maskable" },
      { src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  },
})
```

### Auto-Update Flow

With `registerType: "prompt"`, the plugin exposes a `useRegisterSW` hook (or equivalent). When a new service worker is detected:

- Show a toast notification: "Update available" with a "Reload" button
- User clicks Reload → `registration.waiting.postMessage({ type: 'SKIP_WAITING' })` → page reloads
- If dismissed, update applies on next full page load

### Files to Remove

- Delete `client/public/sw.js` — replaced by generated Workbox SW
- Delete `client/public/manifest.json` — generated from vite config
- Remove manual SW registration script block from `client/index.html` (lines 20-30)

---

## 2. Offline / Disconnected Mode

### Trigger

When `useWebSocket().status !== "connected"` (covers both daemon down and network offline).

### UI Behavior

**Offline banner** — A persistent bar at the top of the workspace content area (inside `WorkspaceView`, above tab content):
- Icon: `WifiOff` from lucide-react
- Text: "Disconnected — viewing only"
- Style: `bg-warning/10 border-b border-warning/20 text-warning text-[12px]` (matches the existing interrupted-session banner pattern)
- Disappears automatically when WS reconnects

**Disabled inputs** — All write/send actions disabled when offline:
- Chat input (`ChatInput.tsx`): already has `disabled` prop — pass `true` when offline
- Send button: already disabled when input is disabled
- "New Session" button in sidebar
- "New Note" button in `NotesView`
- "New Task" button in `ScheduledTasksView`
- Note card editing (click-to-edit disabled)
- Task toggle/edit/delete buttons
- Terminal input (already fails silently when no termId, but should show as disabled)
- File browser "Open in IDE" button

**Preserved state** — Nothing is cleared. Messages, open tabs, file tree, notes, tasks all remain viewable.

### Implementation

Create a hook `client/src/hooks/useOnline.ts`:
```typescript
export function useOnline(): boolean {
  var ws = useWebSocket();
  return ws.status === "connected";
}
```

Components check `useOnline()` and disable their interactive elements.

---

## 3. Install Prompt

### Behavior

- Intercept the browser's `beforeinstallprompt` event
- Store the event in state
- Show an "Install" button in the sidebar UserIsland area (near the version number)
- Clicking it calls `event.prompt()` to trigger the native install dialog
- If user dismisses the install dialog, hide the button and persist `lattice-install-dismissed` in localStorage
- The button only appears if: the event fired AND the user hasn't dismissed it AND the app isn't already installed (`display-mode: standalone` check)

### UI

A small button or link in the UserIsland component:
- Icon: `Download` from lucide-react
- Text: "Install" (compact, fits alongside version info)
- Style: `text-[11px] text-primary/60 hover:text-primary` — subtle, not pushy

---

## 4. Browser Notifications

### Permission

- Do NOT request permission on page load (browsers penalize this)
- Add a "Notifications" toggle in global settings (new section or in existing Appearance section)
- First toggle-on triggers `Notification.requestPermission()`
- Store enabled/disabled preference in localStorage: `lattice-notifications-enabled`

### Notification Events

| Event | Message | When to send | Idle-gated? |
|-------|---------|-------------|-------------|
| `chat:done` | "Claude responded: {sessionTitle}" | After Claude finishes responding | Yes — only when idle |
| `mesh:node_online` | "{nodeName} came online" | New node joins mesh | No — always |
| `mesh:node_offline` | "{nodeName} went offline" | Node leaves mesh | No — always |
| WS disconnect | "Lost connection to daemon" | WebSocket closes | No — always |
| WS reconnect | "Reconnected to daemon" | WebSocket reopens | No — always |

### Idle Detection

A user is "idle" when:
1. The page is hidden (`document.hidden === true` via Page Visibility API), OR
2. No mouse/keyboard interaction for 60 seconds

Create `client/src/hooks/useIdleDetection.ts`:
- Listen to `visibilitychange`, `mousemove`, `keydown`, `mousedown`, `touchstart`
- Reset a 60-second timer on each interaction
- Return `{ isIdle: boolean }`

### Notification Behavior

- **Icon**: Use `/icons/icon-192.svg`
- **Click**: Focus the Lattice window/tab. For `chat:done`, navigate to the relevant session.
- **Auto-close**: 10 seconds (`setTimeout` with `notification.close()`)
- **Tag**: Use event type as tag to prevent stacking (e.g., `tag: "chat-done"` replaces previous)

### Implementation

Create `client/src/hooks/useNotifications.ts`:
- Check `Notification.permission` and localStorage preference
- `sendNotification(title, options)` helper that checks idle state + permission
- Used by WebSocketProvider to fire notifications on relevant events

### Settings UI

Add a "Notifications" row in the Appearance settings (or a dedicated section):
- Toggle: "Browser notifications"
- Description: "Get notified about new responses, node changes, and connection events"
- If permission is "denied", show: "Notifications are blocked by your browser. Update in browser settings."

---

## Design Principles

- **Earn every pixel**: Offline banner is minimal (single line), install prompt is subtle
- **Theme-native**: All new UI uses CSS variables, no hardcoded colors
- **State is sacred**: Offline mode preserves everything — no data loss
- **Dense but breathable**: Notifications are brief, banner is compact
- **Keyboard-first**: All new interactive elements are keyboard-accessible

## Implementation Order

1. **vite-plugin-pwa** setup (SW, manifest, auto-update)
2. **Offline mode** (banner + disabled inputs)
3. **Install prompt** (beforeinstallprompt + UserIsland button)
4. **Notifications** (idle detection, permission, triggers)
