import type { Tab, Pane, TabType, WorkspaceState } from "../stores/workspace";

const TAB_TYPES: Set<string> = new Set(["chat", "files", "terminal", "notes", "tasks", "bookmarks", "analytics", "specs"]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function shortSessionId(uuid: string): string {
  return uuid.slice(0, 8);
}

export function encodeWorkspaceUrl(
  state: WorkspaceState,
  tabs: Tab[],
  primaryProjectSlug: string | null,
): string {
  if (tabs.length === 0) return "";
  if (tabs.length === 1 && tabs[0].id === "chat" && !tabs[0].sessionId) return "";

  const panes = state.panes;
  const activePaneId = state.activePaneId;

  function encodeTab(tab: Tab, isActive: boolean): string {
    let token = tab.type;
    if (tab.type === "chat" && tab.sessionId) {
      const shortId = shortSessionId(tab.sessionId);
      if (tab.projectSlug && tab.projectSlug !== primaryProjectSlug) {
        token += ":" + shortId + "." + tab.projectSlug;
      } else {
        token += ":" + shortId;
      }
    } else if (tab.type === "specs" && tab.specId) {
      token += ":" + tab.specId;
    }
    if (isActive) {
      token += "*";
    }
    return token;
  }

  const paneTokens: string[] = [];
  for (let pi = 0; pi < panes.length; pi++) {
    const pane = panes[pi];
    const tabTokens: string[] = [];
    for (let ti = 0; ti < pane.tabIds.length; ti++) {
      const tabId = pane.tabIds[ti];
      const tab = tabs.find(function (t) { return t.id === tabId; });
      if (!tab) continue;
      const isActive = tabId === pane.activeTabId;
      tabTokens.push(encodeTab(tab, isActive));
    }
    paneTokens.push(tabTokens.join(","));
  }

  let result = paneTokens.join("|");

  if (panes.length > 1 && state.splitDirection) {
    const dirChar = state.splitDirection === "horizontal" ? "h" : "v";
    let activePaneIndex = 0;
    for (let i = 0; i < panes.length; i++) {
      if (panes[i].id === activePaneId) {
        activePaneIndex = i;
        break;
      }
    }
    result += "|" + dirChar + activePaneIndex;
  }

  return result;
}

export interface DecodedWorkspace {
  tabs: Tab[];
  panes: Pane[];
  activePaneId: string;
  splitDirection: "horizontal" | "vertical" | null;
}

export function decodeWorkspaceUrl(
  tParam: string,
  primaryProjectSlug: string | null,
  resolveFullId: (shortId: string, projectSlug: string) => string | null,
): DecodedWorkspace {
  const segments = tParam.split("|");
  const tabs: Tab[] = [];
  const panes: Pane[] = [];
  let splitDirection: "horizontal" | "vertical" | null = null;
  let activePaneIndex = 0;

  const labels: Record<TabType, string> = {
    chat: "Chat",
    files: "Files",
    terminal: "Terminal",
    notes: "Notes",
    tasks: "Tasks",
    bookmarks: "Bookmarks",
    analytics: "Analytics",
    brainstorm: "Brainstorm",
    specs: "Specs",
    context: "Context",
  };

  let splitMeta: string | null = null;
  const paneSegments: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.length <= 3 && /^[hv]\d$/.test(seg)) {
      splitMeta = seg;
    } else {
      paneSegments.push(seg);
    }
  }

  if (splitMeta) {
    splitDirection = splitMeta[0] === "h" ? "horizontal" : "vertical";
    activePaneIndex = parseInt(splitMeta[1], 10);
  }

  for (let pi = 0; pi < paneSegments.length; pi++) {
    const paneId = "pane-" + (pi + 1);
    const tabTokens = paneSegments[pi].split(",").filter(function (s) { return s.length > 0; });
    const paneTabIds: string[] = [];
    let paneActiveTabId = "";

    for (let ti = 0; ti < tabTokens.length; ti++) {
      let token = tabTokens[ti];
      const isActive = token.endsWith("*");
      if (isActive) {
        token = token.slice(0, -1);
      }

      const colonIdx = token.indexOf(":");
      let tabType: TabType;
      let sessionShortId: string | null = null;
      let projectSlug: string | null = null;

      if (colonIdx !== -1) {
        tabType = token.slice(0, colonIdx) as TabType;
        const rest = token.slice(colonIdx + 1);
        const dotIdx = rest.indexOf(".");
        if (dotIdx !== -1) {
          sessionShortId = rest.slice(0, dotIdx);
          projectSlug = rest.slice(dotIdx + 1);
        } else {
          sessionShortId = rest;
          projectSlug = primaryProjectSlug;
        }
      } else {
        tabType = token as TabType;
      }

      if (!TAB_TYPES.has(tabType)) continue;

      let tab: Tab;
      if (tabType === "chat" && sessionShortId && projectSlug) {
        const fullId = resolveFullId(sessionShortId, projectSlug);
        const resolvedId = fullId || sessionShortId;
        const tabId = "chat-" + resolvedId;
        tab = {
          id: tabId,
          type: "chat",
          label: "Session",
          closeable: true,
          pinned: true,
          sessionId: resolvedId,
          projectSlug: projectSlug,
        };
      } else if (tabType === "specs" && sessionShortId) {
        tab = {
          id: "specs",
          type: "specs",
          label: "Specs",
          closeable: true,
          pinned: true,
          specId: sessionShortId,
        };
      } else if (tabType === "chat") {
        tab = { id: "chat", type: "chat", label: "Chat", closeable: true, pinned: true };
      } else {
        tab = {
          id: tabType,
          type: tabType,
          label: labels[tabType],
          closeable: true,
          pinned: true,
        };
      }

      const existingIdx = tabs.findIndex(function (t) { return t.id === tab.id; });
      if (existingIdx === -1) {
        tabs.push(tab);
      }
      paneTabIds.push(tab.id);

      if (isActive) {
        paneActiveTabId = tab.id;
      }
    }

    if (paneTabIds.length > 0) {
      if (!paneActiveTabId) {
        paneActiveTabId = paneTabIds[0];
      }
      panes.push({ id: paneId, tabIds: paneTabIds, activeTabId: paneActiveTabId });
    }
  }

  if (panes.length === 0) {
    panes.push({ id: "pane-1", tabIds: [], activeTabId: "" });
  }

  const resolvedActivePaneIndex = Math.min(activePaneIndex, panes.length - 1);
  const activePaneId = panes[resolvedActivePaneIndex].id;

  if (panes.length < 2) {
    splitDirection = null;
  }

  return { tabs, panes, activePaneId, splitDirection };
}

export function isLegacySessionUrl(pathname: string): { projectSlug: string; sessionId: string } | null {
  const parts = pathname.split("/").filter(function (p) { return p.length > 0; });
  if (parts.length < 2) return null;
  if (parts[0] === "settings") return null;
  if (parts[1] === "settings") return null;
  if (UUID_PATTERN.test(parts[1])) {
    return { projectSlug: parts[0], sessionId: parts[1] };
  }
  return null;
}
