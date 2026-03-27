# Node Disconnect Resilience — Design Spec

## Problem

When a remote node disconnects (server restart, network drop), Machine B:
1. Loses the remote node's projects from the rail entirely
2. If actively using a remote project, shows no indication of disconnect
3. On reconnect, doesn't re-sync project/session state

## Goal

Remote projects should persist visually through disconnects (red badge instead of green). Active remote sessions should show a "Node Disconnected" overlay. On reconnect, everything syncs back seamlessly.

## Current Behavior

- Server heartbeat broadcasts `projects:list` every 10s with `getAllRemoteProjects()`
- `getAllRemoteProjects()` only includes projects from CONNECTED peers (checks `ws.readyState === WebSocket.OPEN`)
- When a peer disconnects, its projects vanish from the next heartbeat
- Client `useProjects` hook replaces the entire project list on each `projects:list` message
- No client-side caching of remote projects through disconnects

## Implementation

### Server Changes

#### 1. `getAllRemoteProjects()` — include offline peers (connector.ts)

Change to return projects from ALL peers (connected + disconnected) with an `online` flag:

```typescript
// Before: only returns connected peer projects
// After: returns all peer projects, with online status
export function getAllRemoteProjects(): Array<ProjectInfo & { online: boolean }> {
  var peers = loadPeers();
  var connectedIds = new Set(getConnectedPeerIds());
  // For each peer, use stored projects from last connection OR from peers.json
  // Mark online: connectedIds.has(peer.id)
}
```

The connector already stores `conn.projects` for connected peers. For disconnected peers, we need to cache the last-known project list.

#### 2. Cache last-known projects per peer (connector.ts)

Add a `lastKnownProjects` Map that persists through disconnect/reconnect cycles:

```typescript
var lastKnownProjects = new Map<string, Array<{ slug: string; title: string }>>();
```

- On `mesh:hello` with projects → update `lastKnownProjects`
- On disconnect → `lastKnownProjects` retains the list
- `getAllRemoteProjects()` uses `lastKnownProjects` for offline peers

#### 3. Add `online` field to remote projects in heartbeat (daemon.ts)

The `projects:list` broadcast should include an `online` field for each remote project so the client knows if the node is reachable.

### Shared Type Changes

#### 4. Add `online` to ProjectInfo (models.ts)

```typescript
export interface ProjectInfo extends ProjectSummary {
  nodeName: string;
  isRemote: boolean;
  online?: boolean;  // new — true if remote node is connected
  ideProjectName?: string;
}
```

### Client Changes

#### 5. Project rail — red/green badge based on `online` (ProjectRail.tsx)

The `groupProjectsBySlug` already tracks `online` per node. Just need to ensure it reads from the project's `online` field (which comes from the node status). This should already work since the node info includes `online`.

#### 6. "Node Disconnected" overlay (new component)

When the active project is remote and its node goes offline, show an overlay:

```
┌─────────────────────────────────────┐
│  ⚠ Node Disconnected               │
│  "Work Laptop" is unreachable.      │
│  Attempting to reconnect...         │
│                                     │
│  Session state preserved.           │
│  Operations will resume on          │
│  reconnect.                         │
└─────────────────────────────────────┘
```

- Semi-transparent overlay on the chat/workspace area
- Shown when `activeProject.isRemote && !nodeOnline`
- Does NOT clear the chat, session list, or any state
- Dismisses automatically when node comes back online

**File:** `client/src/components/ui/NodeDisconnectedOverlay.tsx`

**Placement:** In the main content area, conditionally rendered when the active project's remote node is offline.

#### 7. Preserve remote state through project list updates (useProjects hook)

Currently `useProjects` replaces the entire list on each `projects:list` message. Change to merge: keep existing remote projects that aren't in the new list but whose node is known (just mark them offline).

### Reconnection Sync

#### 8. Re-send projects on reconnect (connector.ts)

When a peer reconnects (either direction), both sides exchange `mesh:hello` with their project lists. The connector already does this. The key fix is in #1-2: making sure `getAllRemoteProjects()` always returns all peers' projects.

## Files to Modify

| File | Change |
|------|--------|
| `server/src/mesh/connector.ts` | Cache `lastKnownProjects`, return all peers in `getAllRemoteProjects()` |
| `server/src/daemon.ts` | Pass `online` flag in remote projects |
| `shared/src/models.ts` | Add `online?: boolean` to `ProjectInfo` |
| `client/src/components/sidebar/ProjectRail.tsx` | Already handles multi-node status dots |
| `client/src/components/ui/NodeDisconnectedOverlay.tsx` | New overlay component |
| `client/src/router.tsx` | Add overlay to main content area |
| `client/src/hooks/useProjects.ts` | Merge strategy instead of replace |

## Edge Cases

- **Multiple remote nodes, only one disconnects**: Only that node's projects go red, others stay green
- **Same slug on local + remote**: Local always works, remote shows disconnect independently
- **Node restarts with different projects**: On reconnect, new project list replaces cached one
- **Long disconnect**: Projects stay in the rail indefinitely (until unpairing)
