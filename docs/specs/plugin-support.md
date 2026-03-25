# Plugin Support — Design Spec

## Overview

Add full plugin management to Lattice: view, install, uninstall, update plugins from the UI, search marketplaces, and load plugin skills/hooks/rules into chat sessions.

## Plugin System Architecture (from Claude Code CLI)

### File Layout

```
~/.claude/plugins/
├── installed_plugins.json     # Manifest of all installed plugins
├── known_marketplaces.json    # Registry of marketplace sources
├── config.json                # Plugin system config
├── blocklist.json             # Blocked plugins
├── install-counts-cache.json  # Download counts for display
├── cache/                     # Installed plugin files
│   ├── claude-plugins-official/
│   │   ├── superpowers/5.0.5/.claude/skills/
│   │   ├── frontend-design/b10b583de281/.claude/skills/
│   │   └── ...
│   ├── impeccable/
│   │   └── impeccable/1.5.1/.claude/skills/
│   └── ...
├── marketplaces/              # Cloned marketplace repos
│   ├── claude-plugins-official/
│   ├── claude-code-marketplace/
│   └── ...
└── data/                      # Plugin data storage
```

### Key Data Structures

**installed_plugins.json**:
```json
{
  "version": 2,
  "plugins": {
    "<plugin-name>@<marketplace>": [{
      "scope": "user",
      "installPath": "/home/.../.claude/plugins/cache/<marketplace>/<plugin>/<version>",
      "version": "5.0.5",
      "installedAt": "2026-03-17T19:22:50.208Z",
      "lastUpdated": "2026-03-17T23:39:27.268Z",
      "gitCommitSha": "78497c..."
    }]
  }
}
```

**Plugin contents** — each plugin at its install path contains:
- `.claude/skills/` — Skill definitions (SKILL.md files)
- `.claude/rules/` — Rule files loaded into sessions
- `.claude/settings.json` — Hooks and permissions
- `PLUGIN.md` — Plugin metadata

### Marketplaces

Git repos containing plugin definitions. Known marketplaces:
- `anthropics/claude-plugins-official` — Official Anthropic plugins
- `severity1/claude-code-marketplace` — Community marketplace
- Third-party repos

## Implementation Plan

### Phase 1: Server — Plugin Data Access

**New handler**: `server/src/handlers/plugins.ts`

Messages:
- `plugin:list` → returns all installed plugins with metadata
- `plugin:marketplaces` → returns known marketplaces
- `plugin:search` → searches marketplace(s) for plugins by keyword
- `plugin:install` → installs a plugin from a marketplace
- `plugin:uninstall` → removes a plugin
- `plugin:update` → updates a plugin to latest version
- `plugin:details` → returns full details of a specific plugin (skills, hooks, rules)

Implementation:
- Read `~/.claude/plugins/installed_plugins.json` for installed list
- Read `~/.claude/plugins/known_marketplaces.json` for marketplaces
- For install/uninstall/update: shell out to `claude plugin install/uninstall/update` CLI commands (safest approach — reuses CLI's git clone + version resolution logic)
- For search: read marketplace repo's plugin index files
- For details: read the plugin's `.claude/` directory for skills/hooks/rules

### Phase 2: Client — Plugin Management UI

**New settings section**: "Plugins" in SettingsSidebar

Components:
- `PluginList` — grid of installed plugins with name, marketplace, version, update available indicator
- `PluginDetail` — expanded view showing skills, hooks, rules, description
- `PluginMarketplace` — browse/search marketplace with install buttons
- `PluginCard` — compact card for each plugin (icon, name, description, install/update/remove buttons)

Location: Global Settings → Plugins (new section after Skills)

### Phase 3: Session Integration

When Lattice starts a chat session via the SDK bridge, it needs to:

1. **Load plugin skills**: Read each installed plugin's `.claude/skills/` directory and inject them into the session context. The SDK's `startConversation` options may support a `skills` parameter — check the SDK API.

2. **Load plugin rules**: Read each plugin's `.claude/rules/` files and include them in the system prompt / CLAUDE.md context.

3. **Load plugin hooks**: Read each plugin's `.claude/settings.json` for hook definitions and register them alongside the project's own hooks.

4. **Load plugin MCP servers**: Some plugins define MCP servers. These need to be started and connected when the session starts.

### Phase 4: Per-Project Plugin Configuration

Allow enabling/disabling plugins per project:
- Project settings → Plugins tab
- Toggle individual plugins on/off for this project
- Override plugin settings per project
- Store in project's `.claude/settings.json` or Lattice config

## UI Design

### Plugin List (Settings → Plugins)

```
INSTALLED PLUGINS

┌────────────────────────────────────────────┐
│ ⚡ superpowers          v5.0.5  ✓ Updated  │
│   claude-plugins-official                   │
│   12 skills, 0 hooks, 0 rules             │
│                         [Update] [Remove]   │
├────────────────────────────────────────────┤
│ 🎨 impeccable            v1.5.1  ✓ Updated │
│   impeccable                                │
│   18 skills, 0 hooks, 0 rules             │
│                         [Update] [Remove]   │
├────────────────────────────────────────────┤
│ 📝 prompt-improver      v0.5.1  ⬆ Update  │
│   claude-code-marketplace                   │
│   1 skill, 1 hook, 0 rules                │
│                         [Update] [Remove]   │
└────────────────────────────────────────────┘

BROWSE MARKETPLACE

[Search plugins...]

Popular:
┌──────────────────────────────────────┐
│ skill-creator    ⬇ 1,234            │
│ Create and test custom skills        │
│                          [Install]   │
└──────────────────────────────────────┘
```

### Plugin Detail View

Clicking a plugin opens a detail panel showing:
- Full description from PLUGIN.md
- List of skills with descriptions
- List of hooks with event types
- List of rules
- Marketplace source + git commit
- Install date, last update date
- Per-project enable/disable toggle

## Technical Considerations

1. **CLI delegation**: For install/uninstall/update, shell out to `claude plugin` commands rather than reimplementing the git clone + version resolution. This ensures compatibility with the CLI's plugin format.

2. **Marketplace caching**: The marketplace repos are already cloned locally. Read from the local clone and pull periodically (or on-demand when user opens the marketplace browser).

3. **Session context injection**: The SDK bridge (`sdk-bridge.ts`) already builds the system prompt. Plugin skills/rules need to be added to this context. Check if the SDK supports a `plugins` or `additionalContext` parameter.

4. **Hot reload**: When plugins are installed/updated, active sessions won't pick up the changes. New sessions will. Document this behavior.

5. **Plugin conflicts**: Multiple plugins may define skills with the same name. Show a warning in the UI but let the user decide (last-installed wins, or per-project override).

## Estimated Effort

| Phase | Effort | Dependencies |
|-------|--------|-------------|
| Phase 1: Server handler | Medium | None |
| Phase 2: Plugin UI | Medium | Phase 1 |
| Phase 3: Session integration | Large | Phase 1, SDK investigation |
| Phase 4: Per-project config | Small | Phase 2 |
