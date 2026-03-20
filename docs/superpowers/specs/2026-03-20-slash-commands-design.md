# Slash Commands Design

## Overview

Add support for Claude Code slash commands in the Lattice chat input. When the user types `/` in the chat input, show a filterable command palette. Some commands are handled client-side, some are sent to Claude as regular messages (Claude handles them), and some need custom server-side handling.

## Command Categories

### Client-Side Commands (handled entirely in the UI)

| Command | Action |
|---------|--------|
| `/clear` | Clear conversation, create new session. Aliases: `/reset`, `/new` |
| `/compact [instructions]` | Send as a regular message — Claude handles compaction |
| `/cost` | Show token usage popup (data already available from `contextUsage` state) |
| `/model [model]` | Open model selector dropdown, or switch directly if model specified |
| `/effort [level]` | Set effort level (low/medium/high/max/auto) |
| `/help` | Show available commands in a modal or inline |
| `/fast [on\|off]` | Toggle fast mode |
| `/exit` | Not applicable in web UI — hide or ignore |
| `/theme` | Navigate to appearance settings |
| `/config` | Navigate to global settings. Alias: `/settings` |
| `/permissions` | Navigate to project permissions settings. Alias: `/allowed-tools` |
| `/memory` | Navigate to project memory settings |
| `/skills` | Navigate to project skills settings |
| `/diff` | Not feasible in web UI without terminal — could show last git diff inline |
| `/plan` | Enter plan mode (send permission mode change) |
| `/rename [name]` | Rename current session |
| `/copy` | Copy last assistant response to clipboard |
| `/export` | Export conversation as text, download as file |
| `/context` | Show context breakdown (data already available from `contextBreakdown` state) |

### Pass-Through Commands (sent to Claude as regular messages)

These are sent as normal chat messages — Claude interprets them:

| Command | Reason |
|---------|--------|
| `/compact [instructions]` | Claude handles context compaction |
| `/init` | Claude generates CLAUDE.md |
| `/pr-comments [PR]` | Claude fetches and shows PR comments |
| `/security-review` | Claude reviews git diff |
| `/review` | Claude reviews code |
| `/btw <question>` | Claude handles as side question |

### Not Applicable in Web UI

| Command | Reason |
|---------|--------|
| `/exit`, `/quit` | No CLI to exit |
| `/vim` | No terminal editing mode |
| `/voice` | Would need Web Speech API — future feature |
| `/terminal-setup` | Not applicable |
| `/statusline` | Not applicable |
| `/desktop`, `/mobile` | Not applicable |
| `/chrome` | Not applicable |
| `/stickers`, `/passes` | Not applicable |
| `/login`, `/logout` | Handled by Lattice's own auth |
| `/upgrade`, `/extra-usage`, `/privacy-settings` | Account management, not in scope |
| `/remote-control`, `/remote-env` | Not applicable |
| `/sandbox` | Not applicable |
| `/install-github-app`, `/install-slack-app` | Not applicable |
| `/add-dir` | Could implement later |
| `/branch`, `/fork` | Could implement later |
| `/resume`, `/continue` | Already handled by session list UI |

## Chat Input Slash Command Flow

### Current State

The chat input already has a basic slash command system for skills:
- Typing `/` shows a filtered list of skills
- Selecting a skill inserts it as a message

### Enhanced Flow

1. User types `/` in the chat input
2. A command palette dropdown appears (above the input, like autocomplete)
3. As user types, list filters in real-time
4. Commands are grouped: "Commands" (built-in) and "Skills" (custom)
5. Each entry shows: command name, brief description
6. Arrow keys navigate, Tab/Enter selects
7. Selecting a command:
   - **Client-side**: executes immediately (e.g., `/clear` creates new session)
   - **With args**: inserts the command prefix, waits for user to complete args and press Enter
   - **Pass-through**: sends as a regular chat message

### Command Palette Data

```typescript
interface SlashCommand {
  name: string;
  description: string;
  aliases?: string[];
  args?: string; // e.g., "[instructions]", "<model>"
  category: "command" | "skill";
  handler: "client" | "passthrough";
}
```

Built-in commands are defined as a static array. Skills come from the existing `skills:list` data.

## Client-Side Command Implementations

### `/clear` (+ `/reset`, `/new`)
- Create a new session via `session:create`
- Clear current messages
- Switch to the new session

### `/cost`
- Show an inline card below the input (or a modal) with:
  - Input tokens, output tokens, cache read/creation
  - Estimated cost from `lastResponseCost`
  - Context window usage percentage
- Data already available in session store's `contextUsage`

### `/model [model]`
- Without arg: open the existing model selector dropdown
- With arg: switch model directly (use existing `ModelSelector` component logic)

### `/effort [level]`
- Set effort level, store in session state
- Pass to subsequent `chat:send` messages

### `/compact [instructions]`
- Send as a regular message: the text `"/compact " + instructions`
- Claude handles the compaction

### `/help`
- Show a modal listing all available commands with descriptions

### `/copy`
- Find last assistant message, copy text to clipboard
- Show toast "Copied to clipboard"

### `/export`
- Serialize all messages to plain text
- Trigger browser download as `.txt` file

### `/rename [name]`
- Without arg: prompt user for name (inline input or modal)
- With arg: send `session:rename` with the name

### `/context`
- Show context breakdown visualization
- Data available from `contextBreakdown` in session store

### `/theme`
- Navigate to `/settings/appearance`

### `/config`
- Navigate to `/settings/appearance` (or whichever is the default settings page)

### `/permissions`
- Navigate to `/$projectSlug/settings/permissions`

### `/memory`
- Navigate to `/$projectSlug/settings/memory`

### `/plan`
- Send `chat:set_permission_mode` with mode `"plan"`

### `/fast`
- Toggle model between standard and fast variant (if applicable)

### `/diff`
- Could send a `chat:send` with text "/diff" for Claude to handle
- Or implement a client-side git diff viewer (future)

## Server Changes

Minimal — most commands are client-side. No new message types needed beyond what already exists. The command palette is purely a client-side UI feature.

## Files Changed

### Modified Files
- `client/src/components/chat/ChatInput.tsx` — enhance slash command system with built-in commands, command palette UI, client-side handlers
- `client/src/stores/session.ts` — may need new actions for clear, rename, etc.

### New Files
- `client/src/commands.ts` — static command definitions and client-side handlers
- `client/src/components/chat/CommandPalette.tsx` — if extracting the palette UI from ChatInput (there may already be a CommandPalette component)

## Design Notes

- Command palette follows the same visual style as the existing skill autocomplete
- Use existing design tokens (base-200/300, base-content, monospace font)
- Keyboard-first: arrow keys, Tab/Enter to select, Escape to close
- Commands should feel instant — no loading spinners for client-side operations
- Toast notifications for actions like `/copy` and `/export`
