# Lattice UI Redesign — Design Specification

Date: 2026-03-17

## Summary

A design overhaul addressing the critique findings: establish visual identity through the lattice metaphor, upgrade the chat to handle rich content, scale the sidebar for real usage, add real-time processing feedback, and fix visual hierarchy issues.

## 1. Visual Identity — The Lattice Motif

### 1.1 Topological NodeRail

The NodeRail transforms from a flat avatar list into a mini network visualization.

**Layout:**
- Each node remains a clickable circle (36px) in the vertical rail
- Connected nodes show thin SVG lines (1px, `base-content/15`) between them
- When a node comes online, its connection line animates in (200ms opacity fade)
- When offline, the line becomes dotted stroke with reduced opacity
- The local node sits at the top with a subtle ring indicator

**Interaction:**
- Active node selection highlights the node AND its connections with primary color
- Unselected nodes use `base-content/30`
- The "ALL" button at the bottom becomes a small lattice icon (4 dots with connecting lines) instead of text

**Data source:** Uses existing `NodeInfo` connections from `useMesh()`. Connection lines drawn between nodes that are both online.

### 1.2 Background Grid Motif

- The chat area (message scroll region only) gets a faint dot-grid background
- Dots use `base-content/5` opacity — barely visible, adds texture
- Grid spacing: 24px consistent rhythm
- Sidebar and input area remain solid surfaces — grid only in the "stage"
- Implemented via CSS `radial-gradient` on the scroll container

### 1.3 Branding

- Sidebar header: LatticeLogomark SVG (20px) renders inline next to "lattice" text
- Text moves from `text-base-content/60` to `text-base-content/80` with `font-bold`
- Reuse the existing `LatticeLogomark` component from SetupWizard (extract to shared)

## 2. Chat Experience — Hybrid Rendering

### 2.1 Message Block Types

Each assistant message is a sequence of typed blocks. The `HistoryMessage` type stays as-is on the wire, but the renderer parses content into blocks:

| Block Type | Source | Renderer |
|-----------|--------|----------|
| Text | `chat:delta` accumulated text | Markdown renderer (headings, code blocks w/ syntax highlighting, lists, tables, links) |
| Image | Markdown `![](url)` or base64 in content | Inline image with max-width, click-to-expand lightbox |
| Code | Fenced code blocks in markdown | Syntax-highlighted block with copy button + language label |
| Tool Call | `chat:tool_start` + `chat:tool_result` | Collapsible block with tool name, summary, args/result, elapsed time |
| Permission | `chat:permission_request` | Alert block with Allow/Deny buttons |
| Error | `chat:error` | Error block with type, message, and suggestion |

### 2.2 Visual Treatment

**User messages:**
- Right-aligned bubble (keep current pattern)
- Tighter padding, max-width 75%

**Assistant messages:**
- Full-width, no bubble
- 2px left border accent (primary color) with 16px left padding
- Content renders at full width — important for code blocks and images that need horizontal space

**Tool calls:**
- Render as compact, indented blocks (additional 12px left margin from assistant baseline)
- Visually nested under the assistant's "thought process"
- Running tools: 2px animated left border (primary color, subtle pulse)
- Completed tools: show elapsed time next to "done" badge
- Collapsed by default, showing: tool icon + name + one-line summary

**Streaming text:**
- Characters from `chat:delta` appear progressively in the assistant message block
- No waiting for completion

### 2.3 Dependencies

- Markdown renderer: `react-markdown` or lightweight custom parser
- Syntax highlighting: `shiki` or `prism-react-renderer`
- Image lightbox: minimal custom component (no heavy library)

## 3. Sidebar Scaling

### 3.1 Session Controls

The "Sessions" section label row gets right-aligned icon buttons (`btn-ghost btn-xs btn-square`, ~24px):

- **Plus** (`Plus` icon) — Create new session
- **Download** (`Download` icon) — Open import panel
- **Search** (`Search` icon) — Toggle search filter input

Same pattern for Projects section label: **Plus** (add project) + **Search** (filter projects).

### 3.2 Session Search

- Toggled by the Search icon button or `Cmd+K` / `Ctrl+K` global shortcut
- Compact 28px-height input slides in below the section label
- Filters session list by title match
- `Escape` or clicking search icon again closes and clears
- `text-[13px]`, magnifying glass icon prefix

### 3.3 Time-Grouped Sessions

Sessions grouped under time headers:
- "Today", "Yesterday", "This Week", "This Month", "Older"
- Headers: `text-[10px] uppercase tracking-widest text-base-content/30`
- Empty groups hidden
- Chronological within each group, newest first

### 3.4 Project Search

- Same toggle pattern as session search
- Filters project list by title/slug match

### 3.5 Session Import

**Trigger:** Download icon button in session controls.

**Import Panel:**
- Slides down inline within the sidebar's session area (not a modal)
- Lists detected Claude Code sessions for the current project directory
- Each entry shows: title, context snippet (2 lines), date, message count
- Already-imported sessions shown grayed with "Already imported" label
- Manual import field at bottom: "Import by session ID" text input
- Selecting a session or submitting an ID triggers import

**Protocol additions:**

```typescript
// Client → Server
{ type: "session:list_importable", projectSlug: string }
{ type: "session:import", projectSlug: string, sessionId: string }

// Server → Client
{ type: "session:importable_list", projectSlug: string, sessions: ImportableSession[] }
// Reuses existing: { type: "session:created", session: SessionSummary }
```

**New shared type:**
```typescript
interface ImportableSession {
  id: string;
  title: string;
  context: string;
  createdAt: number;
  messageCount: number;
  alreadyImported: boolean;
}
```

### 3.6 Scroll Enhancements

- Both project and session lists independently scrollable (already are)
- Project section stays capped at 40% height
- Resizable divider between projects and sessions (drag handle)
- Top/bottom fade gradient (8px) on overflowing lists to indicate scrollability

## 4. Processing Status — Dual-Layer Feedback

### 4.1 Persistent Status Bar

A slim bar (28px) between chat messages and input area.

**When idle:** Collapses to 0px via `grid-template-rows: 0fr` → `1fr` transition (smooth, no layout thrash).

**When processing:**
- Shows current operation: tool icon + tool name + elapsed time counter
- Example: `Read  src/App.tsx  3.2s`
- `text-[12px] font-mono text-base-content/50`
- Subtle left-to-right shimmer on background (`base-content/5` sweep animation)
- "Thinking..." with elapsed time when no active tool

**Transitions:**
- Tool changes: content crossfades (120ms opacity)
- Processing ends: bar collapses smoothly

### 4.2 Protocol Addition

```typescript
// Server → Client
{
  type: "chat:status",
  phase: "thinking" | "tool_call" | "tool_result",
  toolName?: string,
  elapsed?: number,
  summary?: string
}
```

This feeds the status bar independently of the message stream.

## 5. Visual Hierarchy & Polish

### 5.1 Surface Tiers

Three distinct surface tiers:

| Tier | Purpose | Treatment |
|------|---------|-----------|
| Tier 1 (Chrome) | Sidebar, headers, input area | `bg-base-200`, `border-base-300`. Dense, utilitarian. |
| Tier 2 (Stage) | Chat message area | `bg-base-100` (deepest layer). Dot-grid background. Where content lives. |
| Tier 3 (Elevated) | Settings panel, import panel, context menus, tooltips | `bg-base-300`, `shadow-xl`. Floats above. |

### 5.2 Settings: Slide-Out Panel

Replace full-screen modal with a right-edge slide-out panel:
- 400px wide, full height
- Slides in via `translateX` transition (200ms ease-out)
- Backdrop dims main content (`bg-black/40`)
- Escape closes
- Keeps user's spatial context intact

### 5.3 Empty State

Replace icon-in-a-box with contextual content:
- Show connected mesh nodes as a small lattice visualization (reuse NodeRail topology)
- Display active project name
- Clear prompt text to start chatting
- No centered icon-above-heading pattern

### 5.4 Minor Fixes

- **Firefox scrollbars:** Add `scrollbar-width: thin; scrollbar-color: oklch(25% 0.02 280) transparent;`
- **Assistant messages:** Left border accent instead of transparent bubble
- **ModelSelector:** Add chevron-down icon, increase opacity to `text-base-content/60`
- **NodeRail tooltips:** Fix vertical positioning — add `top` computed from button position
- **Permission alert:** Fully custom styling, drop the daisyUI `alert-warning` hybrid
- **Sidebar "lattice" wordmark:** Upgrade visibility per Section 1.3

## 6. Files Affected

### New Files
- `client/src/components/ui/LatticeLogomark.tsx` — Extracted shared logo component
- `client/src/components/chat/StatusBar.tsx` — Persistent processing status bar
- `client/src/components/chat/MarkdownRenderer.tsx` — Markdown block renderer
- `client/src/components/chat/ImageBlock.tsx` — Inline image with lightbox
- `client/src/components/chat/CodeBlock.tsx` — Syntax-highlighted code block
- `client/src/components/sidebar/ImportPanel.tsx` — Session import UI
- `client/src/components/sidebar/SearchFilter.tsx` — Reusable search toggle input
- `shared/src/messages.ts` — Add `session:list_importable`, `session:import`, `session:importable_list`, `chat:status`
- `shared/src/models.ts` — Add `ImportableSession` type

### Modified Files
- `client/src/components/sidebar/NodeRail.tsx` — Topological mesh visualization
- `client/src/components/sidebar/Sidebar.tsx` — Search controls, resizable divider, updated branding
- `client/src/components/sidebar/SessionList.tsx` — Time grouping, icon buttons, import trigger
- `client/src/components/sidebar/ProjectList.tsx` — Search filter, icon buttons, session count badge
- `client/src/components/chat/ChatView.tsx` — Status bar integration, dot-grid background, surface tiers
- `client/src/components/chat/Message.tsx` — Hybrid renderer with block types, left-border assistant style
- `client/src/components/chat/ChatInput.tsx` — Model selector visibility improvements
- `client/src/components/chat/ModelSelector.tsx` — Chevron icon, higher opacity
- `client/src/components/settings/Settings.tsx` — Slide-out panel instead of modal
- `client/src/components/sidebar/UserIsland.tsx` — No changes expected
- `client/src/styles/global.css` — Firefox scrollbar support, status bar animations, dot-grid background
- `client/src/hooks/useSession.ts` — Handle `chat:status` messages
- `server/src/project/session.ts` — Import logic, list importable sessions
- `server/src/ws/router.ts` — Route new message types

## 7. Implementation Order

1. **Visual hierarchy & polish** (surface tiers, Firefox scrollbars, branding) — foundational, affects everything
2. **NodeRail topology** — self-contained component rewrite
3. **Settings slide-out** — self-contained, replaces modal
4. **Sidebar scaling** (search, time groups, icon buttons) — moderate scope
5. **Session import** (UI + protocol + server) — full-stack feature
6. **Chat hybrid renderer** (markdown, code blocks, images) — largest scope
7. **Status bar** (UI + protocol + server) — depends on chat renderer being in place
8. **Empty state** — finishing touch, depends on NodeRail topology being done
