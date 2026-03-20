# Tabbed Workspace & Four Feature Specs

## Overview

Add a tabbed workspace system to Lattice with four new features: File Browser, Terminal, Sticky Notes, and Scheduled Tasks. These appear as persistent, closeable tabs alongside the existing Chat view, with optional split-pane support.

## Shared: Tab System Architecture

### Sidebar Changes

Below the "Dashboard" button and above the "Sessions" section in the project sidebar, add clickable items:
- Files (FolderOpen icon)
- Terminal (TerminalSquare icon)
- Notes (StickyNote icon)
- Tasks (Calendar icon)

Clicking an item opens it as a tab in the main content area. If already open, switches to it.

### Tab Bar

A horizontal tab bar at the top of the main content area when a project is active:
- **Chat** tab is always present (default)
- Other tabs appear when opened from sidebar, each with an X to close
- Active tab is highlighted
- Tabs are persistent — terminal keeps running, file stays loaded, etc.
- Closing a tab removes it from the bar but doesn't destroy state until the component unmounts

### Split Pane

Users can split the view to show multiple tabs simultaneously:
- Right-click a tab → "Split Right" / "Split Down"
- Drag a tab to the edge of the content area to split
- Each pane has its own active tab
- Panes can be resized by dragging the divider
- Close a pane by closing all its tabs

### State Management

New store: `client/src/stores/workspace.ts`
- `tabs: Array<{ id: string; type: "chat" | "files" | "terminal" | "notes" | "tasks"; label: string }>`
- `activeTabId: string`
- `panes: Array<{ id: string; tabIds: string[]; activeTabId: string }>` (for split view)
- `splitDirection: "horizontal" | "vertical" | null`

### New Components
- `client/src/components/workspace/TabBar.tsx`
- `client/src/components/workspace/WorkspaceView.tsx` — orchestrates tabs and panes
- `client/src/components/workspace/SplitPane.tsx` — resizable split container

---

## Feature 1: File Browser

### Description

VS Code-style file browser with tree view on the left and content viewer on the right. Read-only with syntax highlighting (Shiki), optional markdown rendering, copy contents, and "Open in IDE" button.

### UI Layout

**Left panel** (resizable, ~250px default):
- Project directory tree
- Expand/collapse directories
- File icons based on extension (use lucide-react generic file/folder icons)
- Click file to view in right panel
- Current file highlighted

**Right panel** (content viewer):
- Top bar: filename, language badge, line count, copy button, "Open in IDE" button, markdown toggle (for .md files)
- Content area: syntax-highlighted code via Shiki
- For markdown files: toggle between raw source and rendered markdown
- Line numbers on the left

### Syntax Highlighting

Use **Shiki** for syntax highlighting:
- `npm install shiki`
- Use WASM-based highlighter
- Load themes that map to our base16 themes (or use a neutral dark/light theme)
- Detect language from file extension
- Lazy-load grammars on demand

### "Open in IDE" Feature

**Global setting** (new section in global settings: "Editor"):
- Dropdown to select IDE: VS Code, VS Code Insiders, Cursor, WebStorm, IntelliJ IDEA, PyCharm, GoLand, Notepad++, Sublime Text, Custom
- Custom option: text input for the command template (e.g., `code -g {file}:{line}`)

**Server handler**: New message `editor:open` → `{ type: "editor:open", path: string, line?: number }`
- Server spawns the configured editor command with the file path
- Detached process (don't wait for exit)

**Client**: Button in file viewer header, sends `editor:open` with the current file path

### Server (existing infrastructure)

- `fs:list` already lists project directories
- `fs:read` already reads file contents
- May need a recursive tree listing: new message `fs:tree` that returns the full project tree structure

### New Files
- `client/src/components/workspace/FileBrowser.tsx`
- `client/src/components/workspace/FileTree.tsx`
- `client/src/components/workspace/FileViewer.tsx`

### Modified Files
- `shared/src/messages.ts` — add `editor:open`, `fs:tree` messages
- `server/src/handlers/fs.ts` — add `fs:tree` and `editor:open` handlers
- Global settings: add Editor section with IDE selector

---

## Feature 2: Terminal

### Description

Full terminal emulator using xterm.js + node-pty (server already has node-pty). Supports multiple tabs within the terminal view and split panes.

### UI Layout

**Terminal tab bar** (within the terminal workspace tab):
- Multiple terminal instances as sub-tabs
- "+" button to create new terminal
- Each sub-tab shows shell name or custom title
- Close button on each sub-tab

**Terminal area**:
- Full xterm.js terminal
- Resizes with the container (use xterm-addon-fit)
- Supports the user's configured shell (bash/zsh/fish — detected from `$SHELL` or configurable)
- Web links clickable (xterm-addon-web-links)
- Search support (xterm-addon-search)

### Shell Configuration

**Global setting** (in the Editor settings section or a new "Terminal" section):
- Shell path: auto-detected from `$SHELL`, user can override
- Default working directory: project root (default) or custom

### Server (existing infrastructure)

- `terminal:create` → spawns a new pty session, returns `termId`
- `terminal:input` → sends keystrokes to pty
- `terminal:resize` → resizes the pty
- Server sends `terminal:output` with data and `terminal:exited` on close
- **Enhancement needed**: pass shell path and initial cwd when creating

### Dependencies
- `xterm` — terminal emulator
- `@xterm/addon-fit` — auto-resize
- `@xterm/addon-web-links` — clickable URLs
- `@xterm/addon-search` — find in terminal

### New Files
- `client/src/components/workspace/TerminalView.tsx`
- `client/src/components/workspace/TerminalInstance.tsx`

### Modified Files
- `shared/src/messages.ts` — extend `terminal:create` with shell/cwd options
- `server/src/handlers/terminal.ts` — support shell/cwd in create
- Global settings: add Terminal section

---

## Feature 3: Sticky Notes

### Description

Simple per-project plain text notes. Quick capture, no formatting. Grid of note cards.

### UI Layout

**Notes grid**:
- Cards in a responsive grid (2-3 columns)
- Each card: plain text content preview (truncated), created/updated timestamp
- Click card to expand/edit inline
- "New Note" button (floating or top bar)
- Delete button on each card (with confirmation)

### Data Model (existing)

The server already has full CRUD for notes:
- `StickyNote`: `{ id, content, createdAt, updatedAt }`
- `notes:list` → returns all notes
- `notes:create` → creates a note
- `notes:update` → updates content
- `notes:delete` → deletes a note

**Enhancement needed**: Make notes project-scoped. Currently they appear to be global. Add `projectSlug` to the note model and filter by project.

### UI Interactions
- Click "New Note" → creates an empty note card in edit mode
- Click existing note → toggles edit mode (contenteditable or textarea)
- Click outside or press Escape → saves automatically
- Delete button → inline confirmation then delete
- Notes auto-save on blur after edit

### New Files
- `client/src/components/workspace/NotesView.tsx`
- `client/src/components/workspace/NoteCard.tsx`

### Modified Files
- `shared/src/models.ts` — add `projectSlug` to `StickyNote` (if making per-project)
- `server/src/features/sticky-notes.ts` — filter by project
- `server/src/handlers/notes.ts` — pass projectSlug

---

## Feature 4: Scheduled Tasks

### Description

View, create, edit, delete, and toggle scheduled tasks (cron jobs that run Claude prompts). Minimal + expandable card view.

### UI Layout

**Task list**:
- Each task as a card: name, human-readable schedule description, enabled/disabled toggle, last run time, next run time
- Click to expand: shows prompt content, run history
- "New Task" button at top

**Create/Edit modal**:
- Name input
- Prompt textarea (the Claude prompt to run)
- Cron expression input with human-readable preview (e.g., "Every 5 minutes" / "Daily at 9 AM")
- Project selector (which project context to run in)
- Save / Cancel

### Data Model (existing)

- `ScheduledTask`: `{ id, name, prompt, cron, enabled, projectSlug, createdAt, updatedAt, lastRunAt, nextRunAt }`
- `scheduler:list` → returns all tasks
- `scheduler:create` → creates a task
- `scheduler:delete` → deletes a task
- `scheduler:toggle` → enables/disables

**Enhancement needed**: Add `scheduler:update` for editing existing tasks (name, prompt, cron).

### Cron Helper

Use `cronstrue` npm package to convert cron expressions to human-readable strings for display.

### New Files
- `client/src/components/workspace/ScheduledTasksView.tsx`
- `client/src/components/workspace/TaskCard.tsx`
- `client/src/components/workspace/TaskEditModal.tsx`

### Modified Files
- `shared/src/messages.ts` — add `scheduler:update` message
- `server/src/handlers/scheduler.ts` — add update handler
- `server/src/features/scheduler.ts` — support update

---

## Design Principles (from .impeccable.md + ui-ux-pro-max)

- **Dark-first** with theme-native colors (base-100/200/300, base-content)
- **Dense but breathable** — information-rich without clutter
- **Earn every pixel** — no decorative elements
- **JetBrains Mono** for code/headings, IBM Plex Sans for body
- **WCAG AA** — keyboard navigation, focus rings, proper labels
- **Cursor pointer** on all interactive elements (global CSS rule handles this)
- **Modals at root level** with z-[9999]
- **Transitions** 120-300ms, no gratuitous animation
- **Lucide-react** for all icons
- **DaisyUI** components where applicable (toggle, btn, etc.)

## Implementation Order

These are independent features that can be built in any order. Recommended:

1. **Tab system** first (shared infrastructure)
2. **Terminal** (highest value, xterm.js is self-contained)
3. **File Browser** (needs Shiki setup, tree view)
4. **Sticky Notes** (simplest)
5. **Scheduled Tasks** (needs cron helper, update handler)
