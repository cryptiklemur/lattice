# Add Project Design

## Overview

Add the ability to add projects to Lattice through a modal triggered from the project rail's `+` button. Features path autocomplete with directory browsing and auto-detection of project names from manifest files.

## Modal UI

**Trigger:** The `+` button in the project rail (currently disabled with "coming soon"). Remove the disabled state and wire it to open the modal.

**Layout:** Centered modal with backdrop overlay, following `NodeSettingsModal` patterns (fixed overlay, backdrop click to close, X button, rounded-2xl).

### Fields

**Project Path** (required):
- Text input with monospace font
- As user types, debounced (200ms) request to server for directory completions
- The client splits the typed value into a parent directory and a filter prefix. For example, typing `/home/user/my` browses `/home/user/` and client-side filters entries starting with `my`. Typing `/home/user/myproject/` (with trailing slash) browses `/home/user/myproject/` with no filter.
- Dropdown below input shows matching directories at the current path level
- Directories containing `CLAUDE.md` get a subtle badge in the dropdown
- Directories with a detected `projectName` show the name in the dropdown
- Clicking a directory fills the path to that directory (with trailing `/`) and fetches its children
- Supports `~` expansion — server resolves to homedir on browse, client resolves `~` to the server-reported homedir path before sending `settings:update`
- Shows hidden directories (dotfiles) — users may need to add projects in `.config/` etc.
- Shows validation state: path must exist, be a directory, not already added

**Title** (optional):
- Text input, pre-filled with auto-detected project name from manifest files
- If no manifest found, auto-derived from the last path segment
- User can override

### Buttons

- **Cancel** — closes modal
- **Add Project** — disabled until path is valid. On click: sends `settings:update` with `projects: [{ path, title }]`, closes modal on success

### Validation Feedback

- Info state: "Select a directory to add as a project"
- Error state: "Directory not found" / "Already added as a project"
- Success state: "Ready to add" (with detected manifest info if applicable)

## Server Changes

### New message: `browse:list`

Uses the `browse` prefix instead of `fs` because `fs` is in `PROXIED_PREFIXES` (server/src/ws/router.ts line 9) and would be forwarded to remote nodes. `browse:list` must always run on the local server since the user is browsing their local filesystem to add a project.

**Request:** `{ type: "browse:list", path: string }`
- `path` is the directory to list. If empty or `~`, resolve to homedir.
- Expand `~` prefix to homedir.

**Response:** `{ type: "browse:list_result", path: string, homedir: string, entries: BrowseEntry[] }`

The `homedir` field is included so the client can resolve `~` in paths before sending to `settings:update`.

```typescript
interface BrowseEntry {
  name: string;
  path: string;
  hasClaudeMd: boolean;
  projectName: string | null;
}
```

Note: `isDirectory` field omitted — all entries are directories (files are filtered out).

**`projectName` detection** — for each directory entry, check (in order, first match wins):
1. `package.json` → parse JSON, return `name` field
2. `Cargo.toml` → find `name = "..."` in `[package]` section
3. `composer.json` → parse JSON, return `name` field
4. `pyproject.toml` → find `name = "..."` in `[project]` section
5. `go.mod` → first line `module <name>`, return last path segment
6. `*.sln` → return filename without extension
7. `*.csproj` → return filename without extension

Only check manifest files for direct children directories, not recursively. This keeps the browse response fast.

**Error handling:** If the path doesn't exist or is unreadable, return `{ type: "browse:list_result", path, homedir, entries: [] }`. No separate error type needed — empty entries with a non-existent path signals "not found" to the client.

### Handler location

New handler registered with prefix `"browse"` in `server/src/handlers/fs.ts` (or a new `server/src/handlers/browse.ts`). Using a separate `registerHandler("browse", ...)` call avoids the proxy routing issue.

### Path expansion in addProject

The existing `addProject()` in `server/src/project/registry.ts` calls `existsSync(path)` directly. Paths containing `~` will fail. The client must resolve `~` to the absolute homedir path (using the `homedir` field from `browse:list_result`) before sending `settings:update`. This keeps the server simple — it always receives absolute paths.

### Shared types

Add to `shared/src/messages.ts`:

```typescript
export interface BrowseListMessage {
  type: "browse:list";
  path: string;
}

export interface BrowseListResultMessage {
  type: "browse:list_result";
  path: string;
  homedir: string;
  entries: Array<{
    name: string;
    path: string;
    hasClaudeMd: boolean;
    projectName: string | null;
  }>;
}
```

Add `BrowseListMessage` to the `ClientMessage` union.
Add `BrowseListResultMessage` to the `ServerMessage` union.

## Client Component

### `AddProjectModal.tsx`

Location: `client/src/components/sidebar/AddProjectModal.tsx`

**State:**
- `path: string` — current path input value
- `entries: BrowseEntry[]` — directory listing from server
- `title: string` — project title (auto-filled or user-overridden)
- `titleManuallySet: boolean` — whether the user has typed in the title field (prevents auto-override)
- `showDropdown: boolean` — whether autocomplete dropdown is visible
- `error: string | null` — validation error
- `adding: boolean` — loading state during add
- `homedir: string` — server's home directory (from browse response)

**Effects:**
- On path change (debounced 200ms): split into parent dir + filter prefix, send `browse:list` with parent dir
- Subscribe to `browse:list_result`: update entries, store `homedir`
- When a path is fully resolved (trailing `/` and entries returned): if the typed directory's own entry has a `projectName`, auto-fill title (unless `titleManuallySet`)
- Subscribe to `projects:list`: if `adding` is true and the newly added path appears in the projects list, close the modal. This is more reliable than listening for `settings:data` which fires for all settings changes.

**Interactions:**
- Type in path → autocomplete shows filtered directories
- Click directory in dropdown → set path to `entry.path + "/"`, re-browse, auto-fill title from `entry.projectName`
- Tab/Enter on dropdown item → same as click
- Type in title → sets `titleManuallySet: true`, prevents auto-override
- Clear title → reverts `titleManuallySet` to false, re-applies auto-detected name
- Click "Add Project" → resolve `~` to `homedir`, send `settings:update` with `projects: [{ path, title }]`, set `adding: true`

### ProjectRail changes

- Remove `disabled` and `cursor-not-allowed` from the `+` button
- Remove "coming soon" title
- Wire `onClick` to open the `AddProjectModal`
- Modal state: add `addProjectOpen: boolean` state to `ProjectRail` component (local state, not store)

## Data Flow

```
User clicks + in ProjectRail
  → AddProjectModal opens
  → User types path (e.g., "/home/user/pro")
  → Client splits: parent="/home/user/", filter="pro"
  → Debounced browse:list { path: "/home/user/" } → server
  → Server reads directory, checks manifests for each child dir
  → browse:list_result { path, homedir, entries } → client
  → Client filters entries starting with "pro"
  → Dropdown shows matching directories with badges
  → User clicks "projects/" entry
  → Path becomes "/home/user/projects/", re-browse
  → User clicks "myapp/" entry (has projectName: "my-cool-app")
  → Path becomes "/home/user/projects/myapp/"
  → Title auto-filled with "my-cool-app"
  → User clicks "Add Project"
  → Client resolves ~ if present, sends settings:update { projects: [{ path: "/home/user/projects/myapp", title: "my-cool-app" }] }
  → Server calls addProject(), saves config
  → projects:list broadcast → client
  → Modal sees new project in list while adding=true, closes
  → Project appears in rail
```

## Files Changed

### New Files
- `client/src/components/sidebar/AddProjectModal.tsx`

### Modified Files
- `shared/src/messages.ts` — add `BrowseListMessage`, `BrowseListResultMessage`, union updates
- `server/src/handlers/fs.ts` — add `registerHandler("browse", ...)` with manifest detection
- `client/src/components/sidebar/ProjectRail.tsx` — enable + button, wire to modal
