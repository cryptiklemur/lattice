# UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul Lattice's frontend — establish lattice visual identity, upgrade chat to handle rich content, scale the sidebar for real usage, add real-time processing feedback, and fix visual hierarchy.

**Architecture:** Client-side focused with targeted shared type additions and server-side session import logic. Each task is a self-contained unit that compiles and runs independently. Tasks build on each other but each leaves the app in a working state.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, daisyUI v5, lucide-react, Bun, Vite

**Design Spec:** `docs/plans/2026-03-17-ui-redesign.md`

**Code Conventions:**
- Use `var` (not `const`/`let`), no arrow functions, function declarations only
- Use `lucide-react` for all icons
- Follow `.editorconfig` (2-space indent, LF, UTF-8)
- No section separator comments, no emojis
- One class per file

---

## Task 1: Surface Tiers & Visual Hierarchy

Establish the three-surface-tier system and fix Firefox scrollbar support. This is foundational — every subsequent task builds on these surface conventions.

**Files:**
- Modify: `client/src/styles/global.css`
- Modify: `client/src/components/chat/ChatView.tsx`
- Modify: `client/src/components/sidebar/Sidebar.tsx`

**Step 1: Update global.css with Firefox scrollbar support and dot-grid background utility**

In `client/src/styles/global.css`, add Firefox scrollbar support after the webkit scrollbar rules (after line 82), and add the dot-grid background class:

```css
* {
  scrollbar-width: thin;
  scrollbar-color: oklch(25% 0.02 280) transparent;
}

.bg-lattice-grid {
  background-image: radial-gradient(circle, oklch(90% 0.02 280 / 0.05) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

**Step 2: Apply surface tiers to ChatView**

In `client/src/components/chat/ChatView.tsx`:

- The outer container stays `bg-base-100` (Tier 2 — Stage)
- The header bar stays `bg-base-100` (part of the stage)
- The scroll container gets the `bg-lattice-grid` class added
- The input area stays `bg-base-200` (Tier 1 — Chrome)

Change the scroll container div (currently `className="flex-1 overflow-y-auto flex flex-col min-h-0"`) to:
```
className="flex-1 overflow-y-auto flex flex-col min-h-0 bg-lattice-grid"
```

**Step 3: Verify surfaces are consistent**

Check that Sidebar uses `bg-base-200` (Tier 1 — Chrome). It already does on line 43. No change needed.

**Step 4: Commit**

```
feat(ui): establish surface tier system and Firefox scrollbar support
```

---

## Task 2: Branding & Logo Extraction

Extract the LatticeLogomark from SetupWizard into a shared component and upgrade the sidebar branding.

**Files:**
- Create: `client/src/components/ui/LatticeLogomark.tsx`
- Modify: `client/src/components/sidebar/Sidebar.tsx`
- Modify: `client/src/components/setup/SetupWizard.tsx`

**Step 1: Create shared LatticeLogomark component**

Create `client/src/components/ui/LatticeLogomark.tsx`:

```tsx
interface LatticeLogomarkProps {
  size: number;
}

export function LatticeLogomark(props: LatticeLogomarkProps) {
  var s = props.size;
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="18" height="18" rx="3" fill="currentColor" />
      <rect x="26" y="4" width="18" height="18" rx="3" fill="currentColor" opacity="0.55" />
      <rect x="4" y="26" width="18" height="18" rx="3" fill="currentColor" opacity="0.55" />
      <rect x="26" y="26" width="18" height="18" rx="3" fill="currentColor" opacity="0.25" />
      <line x1="13" y1="22" x2="13" y2="26" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
      <line x1="35" y1="22" x2="35" y2="26" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <line x1="22" y1="13" x2="26" y2="13" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
      <line x1="22" y1="35" x2="26" y2="35" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}
```

Note: Uses `currentColor` instead of `var(--accent-primary)` so it inherits from parent text color via Tailwind.

**Step 2: Update Sidebar branding**

In `client/src/components/sidebar/Sidebar.tsx`, import and use the logo:

Replace the sidebar header (lines 53-57):
```tsx
<div className="px-4 py-3 border-b border-base-300 flex-shrink-0">
  <span className="text-sm font-mono font-bold tracking-widest text-base-content/60 uppercase">
    lattice
  </span>
</div>
```

With:
```tsx
<div className="px-4 py-3 border-b border-base-300 flex-shrink-0 flex items-center gap-2">
  <LatticeLogomark size={20} />
  <span className="text-sm font-mono font-bold tracking-widest text-base-content/80 uppercase">
    lattice
  </span>
</div>
```

Add the import at the top of Sidebar.tsx:
```tsx
import { LatticeLogomark } from "../ui/LatticeLogomark";
```

**Step 3: Update SetupWizard to use shared component**

In `client/src/components/setup/SetupWizard.tsx`:

Replace the local `LatticeLogomark` function (lines 271-285) usage with the imported shared component. Add import:
```tsx
import { LatticeLogomark } from "../ui/LatticeLogomark";
```

Remove the local `LatticeLogomark` function definition (lines 271-285). The usage on line 122 stays the same: `<LatticeLogomark size={64} />`. But the SetupWizard's version uses `var(--accent-primary)` for fill — we changed to `currentColor`, so wrap the usage in a span with `text-primary` class:

```tsx
<div className="wizard-fade-in text-primary" style={{ animationDelay: "0ms" }}>
  <LatticeLogomark size={64} />
</div>
```

**Step 4: Commit**

```
refactor(ui): extract LatticeLogomark to shared component and upgrade sidebar branding
```

---

## Task 3: Topological NodeRail

Replace the flat avatar list with a mini network visualization showing connection lines between nodes.

**Files:**
- Modify: `client/src/components/sidebar/NodeRail.tsx`

**Step 1: Rewrite NodeRail with topology lines**

Rewrite `client/src/components/sidebar/NodeRail.tsx`. The core changes:

- Add an SVG overlay that draws lines between connected (online) nodes
- Replace the "ALL" text button with a lattice icon (4 dots + lines)
- Keep all existing functionality (click to select, online indicator, tooltip)
- Use `useRef` to track node button positions for line drawing
- Connection lines: 1px stroke, `base-content/15` when idle, primary color when both endpoints are selected/active

Key implementation details:

```tsx
import { useState, useRef, useEffect } from "react";
import type { NodeInfo } from "@lattice/shared";
import { LatticeLogomark } from "../ui/LatticeLogomark";
```

The SVG overlay sits absolutely positioned over the rail. After mount and on node list changes, measure each node button's center Y position (using refs) and draw vertical connection lines between adjacent nodes.

The NodeButton component needs a ref forwarded to measure its position. The tooltip positioning bug is also fixed here — add a computed `top` style based on the button's bounding rect.

For the AllButton, replace the "ALL" text with `<LatticeLogomark size={18} />`.

**Step 2: Fix tooltip positioning**

The current tooltip (lines 48-59) uses `fixed` positioning but has no `top` value. Fix by computing top from the button's bounding rect on hover:

```tsx
var [tooltipTop, setTooltipTop] = useState(0);

// In onMouseEnter:
var rect = e.currentTarget.getBoundingClientRect();
setTooltipTop(rect.top + rect.height / 2);

// In tooltip div style:
style={{
  position: "fixed",
  left: "calc(var(--node-rail-width, 52px) + 8px)",
  top: tooltipTop + "px",
  transform: "translateY(-50%)",
}}
```

**Step 3: Commit**

```
feat(ui): topological NodeRail with connection lines and fixed tooltips
```

---

## Task 4: Settings Slide-Out Panel

Replace the full-screen modal with a right-edge slide-out panel.

**Files:**
- Modify: `client/src/components/settings/Settings.tsx`

**Step 1: Rewrite Settings container**

Replace the modal structure (lines 186-248 of Settings.tsx). The new structure:

```tsx
return (
  <div
    className={"fixed inset-0 z-[9999] transition-colors duration-200 " + (props.isOpen ? "bg-black/40" : "bg-transparent pointer-events-none")}
    onClick={props.onClose}
  >
    <div
      className={"fixed top-0 right-0 h-full w-[400px] max-w-[90vw] flex bg-base-300 border-l border-base-300 shadow-2xl transition-transform duration-200 ease-out " + (props.isOpen ? "translate-x-0" : "translate-x-full")}
      onClick={function (e) { e.stopPropagation(); }}
    >
      {/* Left nav */}
      <div className="w-[160px] flex-shrink-0 border-r border-base-300 bg-base-200 flex flex-col overflow-hidden">
        {/* ... nav items ... */}
      </div>
      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ... header + content ... */}
      </div>
    </div>
  </div>
);
```

Key changes:
- `fixed top-0 right-0 h-full w-[400px]` instead of `absolute inset-[5%]`
- `translate-x-0` / `translate-x-full` for slide animation
- Left nav narrowed from 200px to 160px to fit in 400px panel
- Backdrop is `bg-black/40` (lighter than the modal's `bg-black/60`)
- Remove `backdrop-blur-sm` (unnecessary for a slide-out)
- Don't `return null` when not open — always render, use translate to hide (enables animation)

**Step 2: Commit**

```
feat(ui): replace settings modal with slide-out panel
```

---

## Task 5: Sidebar Icon Buttons & Search Filter

Add icon button controls and search filtering to both project and session sections.

**Files:**
- Create: `client/src/components/sidebar/SearchFilter.tsx`
- Modify: `client/src/components/sidebar/Sidebar.tsx`
- Modify: `client/src/components/sidebar/SessionList.tsx`
- Modify: `client/src/components/sidebar/ProjectList.tsx`

**Step 1: Create SearchFilter component**

Create `client/src/components/sidebar/SearchFilter.tsx`:

```tsx
import { useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  placeholder?: string;
}

export function SearchFilter(props: SearchFilterProps) {
  var inputRef = useRef<HTMLInputElement>(null);

  useEffect(function () {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      props.onClose();
    }
  }

  return (
    <div className="px-2 pb-1.5 flex-shrink-0">
      <div className="flex items-center gap-1.5 bg-base-300 border border-base-content/15 rounded-md px-2 h-7 focus-within:border-primary transition-colors duration-[120ms]">
        <Search size={12} className="text-base-content/30 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={props.value}
          onChange={function (e) { props.onChange(e.target.value); }}
          onKeyDown={handleKeyDown}
          placeholder={props.placeholder || "Search..."}
          className="flex-1 bg-transparent text-base-content text-[13px] outline-none min-w-0"
          spellCheck={false}
        />
        {props.value.length > 0 && (
          <button
            onClick={function () { props.onChange(""); }}
            className="text-base-content/30 hover:text-base-content flex-shrink-0"
          >
            <X size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Update SectionLabel in Sidebar.tsx to accept action buttons**

In `client/src/components/sidebar/Sidebar.tsx`, update the SectionLabel component:

```tsx
function SectionLabel({ label, actions }: { label: string; actions?: React.ReactNode }) {
  return (
    <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-shrink-0 select-none">
      <span className="text-xs font-bold tracking-wider uppercase text-base-content/40">
        {label}
      </span>
      {actions && (
        <div className="flex items-center gap-0.5">
          {actions}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Add icon buttons and search state to Sidebar**

In `client/src/components/sidebar/Sidebar.tsx`:

Add imports:
```tsx
import { Plus, Download, Search, FolderPlus } from "lucide-react";
import { SearchFilter } from "./SearchFilter";
```

Add state:
```tsx
var [projectSearch, setProjectSearch] = useState<string>("");
var [projectSearchOpen, setProjectSearchOpen] = useState<boolean>(false);
var [sessionSearch, setSessionSearch] = useState<string>("");
var [sessionSearchOpen, setSessionSearchOpen] = useState<boolean>(false);
var [importOpen, setImportOpen] = useState<boolean>(false);
```

Add Cmd+K handler (useEffect with keydown listener):
```tsx
useEffect(function () {
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setSessionSearchOpen(function (prev) { return !prev; });
    }
  }
  document.addEventListener("keydown", handleKeyDown);
  return function () { document.removeEventListener("keydown", handleKeyDown); };
}, []);
```

Update Projects section:
```tsx
<SectionLabel
  label="Projects"
  actions={
    <>
      <button onClick={function () { setProjectSearchOpen(function (v) { return !v; }); }} className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content" aria-label="Search projects">
        <Search size={13} />
      </button>
      <button onClick={handleAddProject} className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content" aria-label="Add project">
        <FolderPlus size={13} />
      </button>
    </>
  }
/>
{projectSearchOpen && (
  <SearchFilter
    value={projectSearch}
    onChange={setProjectSearch}
    onClose={function () { setProjectSearchOpen(false); setProjectSearch(""); }}
    placeholder="Filter projects..."
  />
)}
```

Update Sessions section similarly with Plus, Download, Search buttons.

Pass search values to ProjectList and SessionList as `filter` props.

**Step 4: Update ProjectList to accept and apply filter**

Add `filter?: string` to `ProjectListProps`. Filter the rendered list:
```tsx
var displayed = props.filter
  ? props.projects.filter(function (p) {
      var q = props.filter!.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
    })
  : props.projects;
```

Remove the "Add Project" button at the bottom (moved to section label icon button).

**Step 5: Update SessionList to accept and apply filter**

Add `filter?: string` to `SessionListProps`. Filter sessions before rendering:
```tsx
var displayed = props.filter
  ? sessions.filter(function (s) {
      return s.title.toLowerCase().includes(props.filter!.toLowerCase());
    })
  : sessions;
```

Remove the full-width "New Session" button (moved to section label icon button).

**Step 6: Commit**

```
feat(sidebar): add icon button controls and search filtering for projects and sessions
```

---

## Task 6: Time-Grouped Sessions

Group sessions under time headers: Today, Yesterday, This Week, This Month, Older.

**Files:**
- Modify: `client/src/components/sidebar/SessionList.tsx`

**Step 1: Add time grouping logic**

Add a grouping function to SessionList.tsx:

```tsx
interface SessionGroup {
  label: string;
  sessions: SessionSummary[];
}

function groupByTime(sessions: SessionSummary[]): SessionGroup[] {
  var now = Date.now();
  var todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  var todayMs = todayStart.getTime();
  var yesterdayMs = todayMs - 86400000;
  var weekMs = todayMs - 6 * 86400000;
  var monthMs = todayMs - 29 * 86400000;

  var groups: Record<string, SessionSummary[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    "This Month": [],
    Older: [],
  };

  for (var i = 0; i < sessions.length; i++) {
    var ts = sessions[i].updatedAt;
    if (ts >= todayMs) {
      groups["Today"].push(sessions[i]);
    } else if (ts >= yesterdayMs) {
      groups["Yesterday"].push(sessions[i]);
    } else if (ts >= weekMs) {
      groups["This Week"].push(sessions[i]);
    } else if (ts >= monthMs) {
      groups["This Month"].push(sessions[i]);
    } else {
      groups["Older"].push(sessions[i]);
    }
  }

  var order = ["Today", "Yesterday", "This Week", "This Month", "Older"];
  var result: SessionGroup[] = [];
  for (var j = 0; j < order.length; j++) {
    if (groups[order[j]].length > 0) {
      result.push({ label: order[j], sessions: groups[order[j]] });
    }
  }
  return result;
}
```

**Step 2: Update the render to use groups**

Replace the flat session list render with grouped render:

```tsx
var grouped = groupByTime(displayed);

{grouped.length === 0 ? (
  <div className="px-3 py-2 text-sm text-base-content/40 italic">
    {props.filter ? "No matches" : "No sessions yet"}
  </div>
) : (
  grouped.map(function (group) {
    return (
      <div key={group.label}>
        <div className="text-[10px] uppercase tracking-widest text-base-content/30 px-3 pt-3 pb-1 select-none">
          {group.label}
        </div>
        <ul className="menu menu-sm p-0 gap-0.5">
          {group.sessions.map(function (session) {
            // ... existing session item render ...
          })}
        </ul>
      </div>
    );
  })
)}
```

**Step 3: Commit**

```
feat(sidebar): group sessions by time period (Today, Yesterday, This Week, etc.)
```

---

## Task 7: Chat Message Rendering — Assistant Left-Border Style

Update assistant messages from transparent bubbles to full-width with left border accent. Update user messages for tighter styling.

**Files:**
- Modify: `client/src/components/chat/Message.tsx`

**Step 1: Restyle AssistantMessage**

Replace the AssistantMessage component (lines 31-48):

```tsx
function AssistantMessage(props: { message: HistoryMessage }) {
  var msg = props.message;
  return (
    <div className="px-5 py-1.5">
      <div className="flex gap-3 items-start">
        <div className="w-6 h-6 rounded-full bg-base-200 border border-base-300 flex items-center justify-center flex-shrink-0 mt-0.5">
          <div className="w-3 h-3 rounded-full bg-primary" />
        </div>
        <div className="flex-1 min-w-0 border-l-2 border-primary/40 pl-3">
          <div className="text-[14px] text-base-content leading-relaxed whitespace-pre-wrap break-words">
            {msg.text || ""}
          </div>
          <div className="text-[11px] text-base-content/40 mt-1">
            {formatTime(msg.timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Restyle ToolMessage for indented nesting**

Update the ToolMessage wrapper to add left indentation to nest under assistant messages:

Change the outer div from `className="px-5 py-1"` to:
```tsx
className="pl-[52px] pr-5 py-1"
```

(52px = 20px base padding + 24px avatar + 8px gap — aligns with assistant message content)

Add running state animated border. Replace the static container border:
- When `!hasResult` (running): `border-l-2 border-primary animate-pulse`
- When `hasResult` (done): `border-l-2 border-base-300`

**Step 3: Restyle PermissionMessage for indented nesting**

Same indentation: change from `className="px-5 py-1"` to `className="pl-[52px] pr-5 py-1"`.

Remove the daisyUI `alert alert-warning` hybrid class. Replace with fully custom styling:

```tsx
<div className="border-l-2 border-warning bg-warning/10 rounded-r-md p-3 flex flex-col gap-2.5">
```

**Step 4: Commit**

```
feat(chat): restyle messages with left-border accent and indented tool calls
```

---

## Task 8: Status Bar

Add a persistent collapsible status bar between messages and input.

**Files:**
- Create: `client/src/components/chat/StatusBar.tsx`
- Modify: `client/src/components/chat/ChatView.tsx`
- Modify: `client/src/hooks/useSession.ts`
- Modify: `shared/src/messages.ts`
- Modify: `shared/src/models.ts`

**Step 1: Add ChatStatusMessage to shared types**

In `shared/src/messages.ts`, add after the ChatPermissionRequestMessage interface (around line 260):

```typescript
export interface ChatStatusMessage {
  type: "chat:status";
  phase: "thinking" | "tool_call" | "tool_result";
  toolName?: string;
  elapsed?: number;
  summary?: string;
}
```

Add `ChatStatusMessage` to the ServerMessage union type (around line 393, after ChatPermissionRequestMessage).

**Step 2: Add status state to useSession**

In `client/src/hooks/useSession.ts`:

Add to SessionState interface:
```tsx
currentStatus: { phase: string; toolName?: string; elapsed?: number; summary?: string } | null;
```

Add state:
```tsx
var [currentStatus, setCurrentStatus] = useState<SessionState["currentStatus"]>(null);
```

Add handler:
```tsx
function handleStatus(msg: ServerMessage) {
  var m = msg as ChatStatusMessage;
  setCurrentStatus({ phase: m.phase, toolName: m.toolName, elapsed: m.elapsed, summary: m.summary });
}
```

Subscribe to `chat:status`. Clear status on `chat:done` and `chat:error`:
```tsx
setCurrentStatus(null);
```

Add import for `ChatStatusMessage`.

Return `currentStatus` in the hook's return object.

**Step 3: Create StatusBar component**

Create `client/src/components/chat/StatusBar.tsx`:

```tsx
import { Loader, Wrench, Brain } from "lucide-react";

interface StatusBarProps {
  status: {
    phase: string;
    toolName?: string;
    elapsed?: number;
    summary?: string;
  } | null;
}

export function StatusBar(props: StatusBarProps) {
  var active = props.status !== null;

  return (
    <div
      className="grid transition-all duration-200 ease-out"
      style={{ gridTemplateRows: active ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">
        <div className="flex items-center gap-2 px-5 h-7 text-[12px] font-mono text-base-content/50 border-t border-base-300 bg-base-200">
          {props.status && (
            <>
              {props.status.phase === "thinking" ? (
                <Brain size={12} className="text-primary animate-pulse" />
              ) : (
                <Wrench size={12} className="text-primary" />
              )}
              <span className="truncate">
                {props.status.phase === "thinking"
                  ? "Thinking..."
                  : props.status.toolName || "Processing..."}
              </span>
              {props.status.summary && (
                <span className="text-base-content/30 truncate">
                  {props.status.summary}
                </span>
              )}
              {props.status.elapsed != null && (
                <span className="text-base-content/30 ml-auto flex-shrink-0">
                  {(props.status.elapsed / 1000).toFixed(1)}s
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Integrate StatusBar into ChatView**

In `client/src/components/chat/ChatView.tsx`, import StatusBar and add it between the scroll area and the input area:

```tsx
import { StatusBar } from "./StatusBar";
```

Add `currentStatus` to the destructured useSession() call. Then insert between the scroll div and the input div:

```tsx
<StatusBar status={currentStatus} />
```

**Step 5: Commit**

```
feat(chat): add persistent collapsible status bar for processing feedback
```

---

## Task 9: Session Import — Shared Types & Server

Add the import protocol types and server-side session import logic.

**Files:**
- Modify: `shared/src/models.ts`
- Modify: `shared/src/messages.ts`
- Modify: `server/src/project/session.ts`
- Modify: `server/src/ws/router.ts`

**Step 1: Add ImportableSession to shared models**

In `shared/src/models.ts`, add after LoopStatus interface (after line 123):

```typescript
export interface ImportableSession {
  id: string;
  title: string;
  context: string;
  createdAt: number;
  messageCount: number;
  alreadyImported: boolean;
}
```

**Step 2: Add import message types to shared messages**

In `shared/src/messages.ts`:

Add client messages:
```typescript
export interface SessionListImportableMessage {
  type: "session:list_importable";
  projectSlug: string;
}

export interface SessionImportMessage {
  type: "session:import";
  projectSlug: string;
  sessionId: string;
}
```

Add to ClientMessage union type.

Add server message:
```typescript
export interface SessionImportableListMessage {
  type: "session:importable_list";
  projectSlug: string;
  sessions: ImportableSession[];
}
```

Add to ServerMessage union type. Add `ImportableSession` to the imports from `"./models.js"`.

**Step 3: Add server-side import logic**

In `server/src/project/session.ts`, add two new functions:

```typescript
export function listImportableSessions(projectSlug: string): ImportableSession[] {
  // Find the project's path from config
  // Look for Claude Code sessions in the project's .claude/ directory
  // Parse each session file to extract title, context, message count
  // Check which are already imported (exist in our sessions dir)
  // Return ImportableSession[]
}

export function importSession(projectSlug: string, claudeSessionId: string): SessionSummary | null {
  // Read the Claude Code session file
  // Convert to Lattice JSONL format
  // Create a new session entry
  // Return the created SessionSummary
}
```

The implementation depends on Claude Code's session storage format. The key paths to check:
- `{projectPath}/.claude/sessions/` — Claude Code session files
- Each session is likely a JSONL or JSON file with conversation history

Add `ImportableSession` to the imports from `@lattice/shared`.

**Step 4: Register import handlers in router**

The session handler (registered with prefix "session") needs to handle the two new message types. This is likely in a session handler file that registers with the router. Add cases for `session:list_importable` and `session:import` that call the new session.ts functions and send responses via `sendTo`.

**Step 5: Commit**

```
feat(session): add session import protocol types and server-side import logic
```

---

## Task 10: Session Import — Client UI

Add the import panel to the sidebar.

**Files:**
- Create: `client/src/components/sidebar/ImportPanel.tsx`
- Modify: `client/src/components/sidebar/Sidebar.tsx`
- Modify: `client/src/components/sidebar/SessionList.tsx`

**Step 1: Create ImportPanel component**

Create `client/src/components/sidebar/ImportPanel.tsx`:

```tsx
import { useState, useEffect, useRef } from "react";
import { Download, X, Check, Loader } from "lucide-react";
import type { ImportableSession, ServerMessage } from "@lattice/shared";
import { useWebSocket } from "../../hooks/useWebSocket";

interface ImportPanelProps {
  projectSlug: string;
  onClose: () => void;
  onImported: () => void;
}

export function ImportPanel(props: ImportPanelProps) {
  var ws = useWebSocket();
  var [sessions, setSessions] = useState<ImportableSession[]>([]);
  var [loading, setLoading] = useState<boolean>(true);
  var [manualId, setManualId] = useState<string>("");
  var [importing, setImporting] = useState<string | null>(null);

  useEffect(function () {
    function handleList(msg: ServerMessage) {
      if (msg.type === "session:importable_list") {
        var listMsg = msg as { type: string; projectSlug: string; sessions: ImportableSession[] };
        if (listMsg.projectSlug === props.projectSlug) {
          setSessions(listMsg.sessions);
          setLoading(false);
        }
      }
    }
    ws.subscribe("session:importable_list", handleList);
    ws.send({ type: "session:list_importable", projectSlug: props.projectSlug });
    return function () { ws.unsubscribe("session:importable_list", handleList); };
  }, [props.projectSlug, ws]);

  function handleImport(sessionId: string) {
    setImporting(sessionId);
    ws.send({ type: "session:import", projectSlug: props.projectSlug, sessionId: sessionId });
    // onImported will be called when session:created fires
  }

  function handleManualImport() {
    var id = manualId.trim();
    if (id.length > 0) {
      handleImport(id);
      setManualId("");
    }
  }

  return (
    <div className="border-t border-base-300 bg-base-300 flex flex-col max-h-[50%] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
        <span className="text-[11px] font-bold tracking-wider uppercase text-base-content/40">
          Import Sessions
        </span>
        <button onClick={props.onClose} className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content">
          <X size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader size={16} className="animate-spin text-base-content/30" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-2 py-3 text-[12px] text-base-content/40 italic">
            No Claude Code sessions found for this project
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sessions.map(function (session) {
              return (
                <button
                  key={session.id}
                  disabled={session.alreadyImported || importing === session.id}
                  onClick={function () { handleImport(session.id); }}
                  className={
                    "flex flex-col items-start gap-0.5 px-2.5 py-2 rounded-md text-left transition-colors duration-[120ms] w-full " +
                    (session.alreadyImported
                      ? "opacity-40 cursor-default"
                      : "hover:bg-base-200 cursor-pointer")
                  }
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-[12px] font-medium text-base-content truncate flex-1">
                      {session.title}
                    </span>
                    {session.alreadyImported && (
                      <Check size={11} className="text-success flex-shrink-0" />
                    )}
                    {importing === session.id && (
                      <Loader size={11} className="animate-spin text-primary flex-shrink-0" />
                    )}
                  </div>
                  <span className="text-[11px] text-base-content/40 truncate w-full">
                    {session.context}
                  </span>
                  <span className="text-[10px] text-base-content/25">
                    {session.messageCount} msgs
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-2 pb-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={manualId}
            onChange={function (e) { setManualId(e.target.value); }}
            onKeyDown={function (e) { if (e.key === "Enter") { handleManualImport(); } }}
            placeholder="Session ID..."
            className="input input-xs input-bordered flex-1 bg-base-200 text-[12px] font-mono"
            spellCheck={false}
          />
          <button
            onClick={handleManualImport}
            disabled={manualId.trim().length === 0}
            className="btn btn-primary btn-xs"
          >
            <Download size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Integrate ImportPanel into Sidebar**

In Sidebar.tsx, conditionally render ImportPanel below the SessionList when `importOpen` is true:

```tsx
{importOpen && activeProject && (
  <ImportPanel
    projectSlug={activeProject.slug}
    onClose={function () { setImportOpen(false); }}
    onImported={function () { setImportOpen(false); }}
  />
)}
```

Wire the Download icon button in sessions SectionLabel to toggle `importOpen`.

**Step 3: Commit**

```
feat(sidebar): add session import panel with detected sessions and manual ID input
```

---

## Task 11: ModelSelector Visibility

Make the model/effort selectors more visible and interactive.

**Files:**
- Modify: `client/src/components/chat/ModelSelector.tsx`

**Step 1: Add chevron affordance and increase opacity**

In `client/src/components/chat/ModelSelector.tsx`:

Add import:
```tsx
import { ChevronDown } from "lucide-react";
```

Change the outer div class from `text-base-content/40` to `text-base-content/60`.

Add a small ChevronDown icon after each select to indicate interactivity. Wrap each select in a div that contains the select + chevron:

```tsx
<div className="flex items-center gap-0.5">
  <select ...>{/* model options */}</select>
  <ChevronDown size={10} className="text-base-content/30 pointer-events-none" />
</div>
```

Repeat for effort select.

**Step 2: Commit**

```
fix(chat): improve ModelSelector visibility with chevron indicators
```

---

## Task 12: Empty State

Replace the generic icon-in-a-box empty state with contextual content.

**Files:**
- Modify: `client/src/components/chat/ChatView.tsx`

**Step 1: Replace empty state**

Replace the empty state block (lines 76-89 of ChatView.tsx) with a contextual version:

```tsx
<div className="flex-1 flex items-center justify-center p-10">
  <div className="text-center max-w-[360px]">
    <div className="text-primary mb-4">
      <LatticeLogomark size={48} />
    </div>
    <p className="text-[17px] font-mono font-bold text-base-content mb-2 tracking-tight">
      {activeSessionId ? "Start the conversation" : "Select a project"}
    </p>
    <p className="text-[13px] text-base-content/40 leading-relaxed">
      {activeSessionId
        ? "Type a message below to begin chatting with Claude."
        : "Choose a project from the sidebar, then create or select a session."}
    </p>
  </div>
</div>
```

Import LatticeLogomark at the top of ChatView.tsx.

**Step 2: Commit**

```
feat(chat): replace generic empty state with branded lattice visualization
```

---

## Summary

| Task | Scope | Depends On |
|------|-------|------------|
| 1. Surface Tiers | CSS + ChatView | — |
| 2. Branding & Logo | New component + Sidebar + SetupWizard | — |
| 3. Topological NodeRail | NodeRail rewrite | Task 2 (uses LatticeLogomark) |
| 4. Settings Slide-Out | Settings rewrite | — |
| 5. Sidebar Icon Buttons & Search | New component + Sidebar + ProjectList + SessionList | — |
| 6. Time-Grouped Sessions | SessionList | Task 5 (uses filter prop) |
| 7. Chat Message Restyling | Message.tsx | — |
| 8. Status Bar | New component + ChatView + useSession + shared types | — |
| 9. Session Import (Server) | Shared types + server session + router | — |
| 10. Session Import (Client) | New component + Sidebar | Task 5, Task 9 |
| 11. ModelSelector Visibility | ModelSelector | — |
| 12. Empty State | ChatView | Task 2 (uses LatticeLogomark) |

**Parallelizable groups:**
- Group A (independent): Tasks 1, 2, 4, 7, 8, 9, 11
- Group B (after dependencies): Tasks 3, 5, 6, 10, 12
