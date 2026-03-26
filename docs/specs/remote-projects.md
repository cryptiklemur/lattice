# Remote Projects — Design Spec

## Problem

When machines are paired via mesh, each machine only shows its own projects. Remote node projects are invisible — the `buildNodesMessage()` function sends remote nodes with empty `projects: []`, and the `projects:list` broadcast only includes local projects. Users have to manually know what's on each machine.

## Goal

Every paired machine shows ALL projects from ALL connected nodes. Each project in the sidebar rail and project list shows which node it belongs to. Clicking a remote project routes all operations (sessions, files, terminal, etc.) through the existing mesh proxy system.

## Current State

- `buildNodesMessage()` → remote nodes have `projects: []` (connector stores them but they're not included)
- `projects:list` → only local projects broadcast
- ProjectRail has `groupProjectsBySlug()` that already supports multi-node grouping but never sees remote projects
- Mesh proxy already routes by slug via `findNodeForProject()` — the plumbing exists

## Implementation

### Server Changes

#### 1. Include remote projects in `buildNodesMessage()` (mesh.ts)

Pull projects from `getConnectedPeerProjects()` (new export from connector):

```typescript
var remotes = peers.map(function (peer) {
  var connProjects = getConnectedPeerProjects(peer.id);
  return {
    ...
    projects: connProjects,  // was: []
  };
});
```

#### 2. Include remote projects in `projects:list` broadcast (daemon.ts)

Merge local + remote projects in the heartbeat:

```typescript
var allProjects = localProjects.concat(remoteProjects);
broadcast({ type: "projects:list", projects: allProjects });
```

Remote projects have `isRemote: true` and `nodeId` pointing to the remote node.

#### 3. Export `getConnectedPeerProjects()` from connector.ts

```typescript
export function getConnectedPeerProjects(nodeId: string): ProjectSummary[] {
  var conn = connections.get(nodeId);
  if (!conn || conn.ws.readyState !== WebSocket.OPEN) return [];
  return conn.projects.map(p => ({ slug: p.slug, title: p.title, path: "", nodeId }));
}

export function getAllRemoteProjects(): ProjectInfo[] {
  // Iterate all connected peers, collect their projects as ProjectInfo[]
}
```

### Client Changes

#### 4. ProjectRail — Node indicator on each project button

Already has multi-node support via `groupProjectsBySlug()`. Need to ensure:
- Remote projects appear in the rail
- Each button shows a small node indicator (colored dot matching node status)
- Hover tooltip shows: project title, node name, node status, path

#### 5. Sidebar — Project header shows node name

When a remote project is selected, the project header area should show the node name (e.g., "lattice — on Sovereign").

#### 6. SessionList — Remote sessions load via proxy

When a remote project is active, `session:list_request` messages are proxied to the remote node. This already works via the router's proxy system — no changes needed as long as the `projectSlug` is correct.

### Data Flow After Changes

```
Server boots → connector receives mesh:hello with projects
           → buildNodesMessage() includes them in NodeInfo.projects
           → heartbeat broadcasts projects:list with remote projects (isRemote: true)

Client receives projects:list → sees both local and remote projects
                              → ProjectRail renders all with node indicators
                              → User clicks remote project
                              → session:list_request sent with remote slug
                              → Router detects slug not local
                              → findNodeForProject() routes to remote node
                              → Proxy handles response back to client
```

### Edge Cases

- **Remote node goes offline**: Projects remain visible but marked as offline. Clicking shows "Node offline" message instead of loading sessions.
- **Duplicate slugs**: Two nodes may have a project with the same slug. `groupProjectsBySlug()` already groups these — the UI shows one icon with multiple node indicators.
- **Project added/removed on remote**: When the connector receives an updated `mesh:hello` (reconnect), it updates the project list and the heartbeat broadcasts the change.

## Files to Modify

| File | Change |
|------|--------|
| `server/src/mesh/connector.ts` | Export `getConnectedPeerProjects()`, `getAllRemoteProjects()` |
| `server/src/handlers/mesh.ts` | Include remote projects in `buildNodesMessage()` |
| `server/src/daemon.ts` | Include remote projects in `projects:list` heartbeat |
| `client/src/components/sidebar/ProjectRail.tsx` | Add node indicator tooltip |
| `client/src/components/sidebar/Sidebar.tsx` | Show node name for remote projects |

## Estimated Effort

Small-Medium. The mesh proxy plumbing already exists. Main work is wiring remote projects into the broadcast and adding UI indicators.
