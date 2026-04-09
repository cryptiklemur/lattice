import { createRouter, createRootRoute, createRoute, createMemoryHistory } from "@tanstack/react-router";
import { Outlet } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { useFocusTrap } from "./hooks/useFocusTrap";
import { Sidebar } from "./components/sidebar/Sidebar";
import { WorkspaceView } from "./components/workspace/WorkspaceView";
import { SetupWizard } from "./components/setup/SetupWizard";
import { SettingsView } from "./components/settings/SettingsView";
import { ProjectSettingsView } from "./components/project-settings/ProjectSettingsView";
import { DashboardView } from "./components/dashboard/DashboardView";
import { ProjectDashboardView } from "./components/dashboard/ProjectDashboardView";
import { AnalyticsView } from "./components/analytics/AnalyticsView";
import { NodeSettingsModal } from "./components/sidebar/NodeSettingsModal";
import { AddProjectModal } from "./components/sidebar/AddProjectModal";
import { useSidebar } from "./hooks/useSidebar";
import { useWorkspace } from "./hooks/useWorkspace";
import { useWebSocket } from "./hooks/useWebSocket";
import { NodeDisconnectedOverlay } from "./components/ui/NodeDisconnectedOverlay";
import { useSwipeDrawer } from "./hooks/useSwipeDrawer";
import { exitSettings, getSidebarStore, handlePopState, closeDrawer, toggleDrawer } from "./stores/sidebar";

function LoadingScreen() {
  const ws = useWebSocket();
  const [dataReceived, setDataReceived] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(function () {
    const timer = setTimeout(function () {
      setMinTimeElapsed(true);
    }, 600);
    return function () { clearTimeout(timer); };
  }, []);

  useEffect(function () {
    if (ws.status !== "connected") return;
    function handleProjects() {
      setDataReceived(true);
    }
    ws.subscribe("projects:list", handleProjects);
    return function () { ws.unsubscribe("projects:list", handleProjects); };
  }, [ws]);

  const initialReady = dataReceived && minTimeElapsed;
  const isDisconnected = initialLoadDone && ws.status !== "connected";
  const ready = initialReady && !isDisconnected;
  const visible = !initialReady || isDisconnected;

  useEffect(function () {
    if (initialReady && !initialLoadDone) {
      const timer = setTimeout(function () {
        setInitialLoadDone(true);
      }, 300);
      return function () { clearTimeout(timer); };
    }
  }, [initialReady, initialLoadDone]);

  useEffect(function () {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gridSize = 9;
    const spacing = 26;
    const dotRadius = 3.5;
    const padding = 20;
    const canvasSize = padding * 2 + (gridSize - 1) * spacing;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    canvas.style.width = canvasSize + "px";
    canvas.style.height = canvasSize + "px";
    ctx.scale(dpr, dpr);

    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const logoSquare = 14;
    const logoGap = 4;
    const logoHalf = (logoSquare * 2 + logoGap) / 2;
    const logoLeft = centerX - logoHalf;
    const logoTop = centerY - logoHalf;
    const logoRight = centerX + logoHalf;
    const logoBottom = centerY + logoHalf;

    const computedPrimary = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim();
    const primary = computedPrimary ? "oklch(" + computedPrimary + ")" : "oklch(55% 0.25 280)";

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    type Dot = { x: number; y: number; col: number; row: number; hidden: boolean; brightness: number };
    const dots: Dot[] = [];
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const x = padding + col * spacing;
        const y = padding + row * spacing;
        const hidden = x + dotRadius > logoLeft && x - dotRadius < logoRight &&
                     y + dotRadius > logoTop && y - dotRadius < logoBottom;
        dots.push({ x: x, y: y, col: col, row: row, hidden: hidden, brightness: 0.08 });
      }
    }

    type Connection = {
      a: number; b: number;
      birth: number; duration: number;
      fadeIn: number; fadeOut: number;
    };
    let connections: Connection[] = [];
    const maxConnections = 10;
    let now = performance.now();

    function getNeighbors(idx: number): number[] {
      const d = dots[idx];
      const result: number[] = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = d.row + dr;
          const nc = d.col + dc;
          if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize) {
            const ni = nr * gridSize + nc;
            if (!dots[ni].hidden) result.push(ni);
          }
        }
      }
      return result;
    }

    function drawStatic() {
      ctx!.clearRect(0, 0, canvasSize, canvasSize);
      for (let di = 0; di < dots.length; di++) {
        const dot = dots[di];
        if (dot.hidden) continue;
        ctx!.beginPath();
        ctx!.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2);
        ctx!.fillStyle = primary;
        ctx!.globalAlpha = 0.15;
        ctx!.fill();
        ctx!.globalAlpha = 1.0;
      }
      const squares = [
        [logoLeft, logoTop],
        [logoLeft + logoSquare + logoGap, logoTop],
        [logoLeft, logoTop + logoSquare + logoGap],
        [logoLeft + logoSquare + logoGap, logoTop + logoSquare + logoGap],
      ];
      for (let si = 0; si < squares.length; si++) {
        ctx!.fillStyle = primary;
        ctx!.globalAlpha = 0.9;
        ctx!.fillRect(squares[si][0], squares[si][1], logoSquare, logoSquare);
        ctx!.globalAlpha = 1.0;
      }
    }

    if (prefersReducedMotion) {
      drawStatic();
      return;
    }

    function animate() {
      now = performance.now();
      ctx!.clearRect(0, 0, canvasSize, canvasSize);

      if (connections.length < maxConnections && Math.random() < 0.04) {
        const candidates: number[] = [];
        for (let i = 0; i < dots.length; i++) {
          if (!dots[i].hidden) candidates.push(i);
        }
        let attempts = 0;
        while (attempts < 5 && connections.length < maxConnections) {
          const ai = candidates[Math.floor(Math.random() * candidates.length)];
          const neighbors = getNeighbors(ai);
          if (neighbors.length > 0) {
            const bi = neighbors[Math.floor(Math.random() * neighbors.length)];
            let exists = false;
            for (let j = 0; j < connections.length; j++) {
              if ((connections[j].a === ai && connections[j].b === bi) ||
                  (connections[j].a === bi && connections[j].b === ai)) {
                exists = true;
                break;
              }
            }
            if (!exists) {
              connections.push({
                a: ai, b: bi,
                birth: now,
                duration: 2000 + Math.random() * 3000,
                fadeIn: 400,
                fadeOut: 400,
              });
              break;
            }
          }
          attempts++;
        }
      }

      const connectedSet = new Set<number>();
      const keep: Connection[] = [];
      for (let ci = 0; ci < connections.length; ci++) {
        const c = connections[ci];
        const age = now - c.birth;
        if (age > c.duration) continue;
        keep.push(c);

        let alpha = 1.0;
        if (age < c.fadeIn) {
          alpha = age / c.fadeIn;
        } else if (age > c.duration - c.fadeOut) {
          alpha = (c.duration - age) / c.fadeOut;
        }

        connectedSet.add(c.a);
        connectedSet.add(c.b);

        const da = dots[c.a];
        const db = dots[c.b];
        ctx!.beginPath();
        ctx!.moveTo(da.x, da.y);
        ctx!.lineTo(db.x, db.y);
        ctx!.strokeStyle = primary;
        ctx!.globalAlpha = alpha * 0.35;
        ctx!.lineWidth = 1.5;
        ctx!.stroke();
        ctx!.globalAlpha = 1.0;
      }
      connections = keep;

      for (let di = 0; di < dots.length; di++) {
        const dot = dots[di];
        if (dot.hidden) continue;
        const targetBrightness = connectedSet.has(di) ? 0.7 : 0.08;
        dot.brightness += (targetBrightness - dot.brightness) * 0.08;
        ctx!.beginPath();
        ctx!.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2);
        ctx!.fillStyle = primary;
        ctx!.globalAlpha = dot.brightness;
        ctx!.fill();
        ctx!.globalAlpha = 1.0;
      }

      const pulse = 0.4 + 0.2 * Math.sin(now / 800);
      const squares = [
        [logoLeft, logoTop],
        [logoLeft + logoSquare + logoGap, logoTop],
        [logoLeft, logoTop + logoSquare + logoGap],
        [logoLeft + logoSquare + logoGap, logoTop + logoSquare + logoGap],
      ];
      for (let si = 0; si < squares.length; si++) {
        const sx = squares[si][0];
        const sy = squares[si][1];
        ctx!.save();
        ctx!.shadowColor = primary;
        ctx!.shadowBlur = 8 + pulse * 6;
        ctx!.fillStyle = primary;
        ctx!.globalAlpha = 0.85 + pulse * 0.15;
        ctx!.fillRect(sx, sy, logoSquare, logoSquare);
        ctx!.restore();
      }

      frameRef.current = requestAnimationFrame(animate);
    }

    frameRef.current = requestAnimationFrame(animate);

    return function () {
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  if (!visible && initialReady) {
    return null;
  }

  const statusText = isDisconnected
    ? "Reconnecting..."
    : ws.status === "connecting" ? "Connecting..."
    : "Loading projects...";

  const bgClass = isDisconnected ? "bg-base-100/90" : "bg-base-100";

  return (
    <div
      className={"fixed inset-0 z-[9999] flex flex-col items-center justify-center " + bgClass}
      style={{ opacity: ready ? 0 : 1, transition: "opacity 300ms ease-out", pointerEvents: ready ? "none" : "auto" }}
    >
      <div className="flex flex-col items-center gap-7">
        <canvas ref={canvasRef} />
        <div className="flex flex-col items-center gap-2">
          <span className="text-[16px] font-mono font-bold text-base-content tracking-tight">Lattice</span>
          <span className="text-[12px] text-base-content/40">{statusText}</span>
        </div>
      </div>
    </div>
  );
}

function RemoveProjectConfirm() {
  const sidebar = useSidebar();
  const ws = useWebSocket();
  const slug = sidebar.confirmRemoveSlug;
  const removeModalRef = useRef<HTMLDivElement>(null);
  const stableCloseRemove = useCallback(function () { sidebar.closeConfirmRemove(); }, [sidebar.closeConfirmRemove]);
  useFocusTrap(removeModalRef, stableCloseRemove, !!slug);

  if (!slug) return null;

  const projects = (function () {
    try {
      const store = getSidebarStore();
      return store.state;
    } catch {
      return null;
    }
  })();

  return (
    <div ref={removeModalRef} className="fixed inset-0 z-[9999] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Remove Project">
      <div className="absolute inset-0 bg-base-content/50" onClick={sidebar.closeConfirmRemove} />
      <div className="relative bg-base-200 border border-base-content/15 rounded-xl shadow-lg w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-base-content/15">
          <h2 className="text-[15px] font-mono font-bold text-base-content">Remove Project</h2>
        </div>
        <div className="px-5 py-4">
          <p className="text-[13px] text-base-content/60">
            Remove <span className="font-semibold text-base-content">{slug}</span> from Lattice? This won't delete any files on disk.
          </p>
        </div>
        <div className="px-5 py-3 border-t border-base-content/15 flex justify-end gap-2">
          <button
            onClick={sidebar.closeConfirmRemove}
            className="btn btn-ghost btn-sm text-[12px]"
          >
            Cancel
          </button>
          <button
            onClick={function () {
              ws.send({
                type: "settings:update",
                settings: { removeProject: slug },
              } as any);
              if (sidebar.activeProjectSlug === slug) {
                sidebar.goToDashboard();
              }
              sidebar.closeConfirmRemove();
            }}
            className="btn btn-error btn-sm text-[12px]"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function RootLayout() {
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const ws = useWebSocket();

  useEffect(function () {
    function handleSettingsData(msg: { type: string; config?: { setupComplete?: boolean } }) {
      if (msg.type !== "settings:data") return;
      setSetupComplete(msg.config?.setupComplete === true);
    }
    ws.subscribe("settings:data", handleSettingsData as any);
    if (ws.status === "connected") {
      ws.send({ type: "settings:get" });
    }
    return function () {
      ws.unsubscribe("settings:data", handleSettingsData as any);
    };
  }, [ws.status]);

  const sidebar = useSidebar();
  const drawerSideRef = useRef<HTMLDivElement>(null);

  useSwipeDrawer(drawerSideRef, sidebar.drawerOpen, toggleDrawer, closeDrawer);

  useEffect(function () {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        const state = getSidebarStore().state;
        if (state.sidebarMode === "settings") {
          exitSettings();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("popstate", handlePopState);
    return function () {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  if (setupComplete === null) {
    return <LoadingScreen />;
  }

  if (!setupComplete) {
    return (
      <SetupWizard onComplete={function () { setSetupComplete(true); }} />
    );
  }

  return (
    <div className="flex w-full h-full overflow-hidden bg-base-100">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[99999] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-content focus:rounded-lg focus:text-sm focus:font-semibold">
        Skip to content
      </a>
      <LoadingScreen />
      <div className="drawer lg:drawer-open h-full w-full">
        <input
          id="sidebar-drawer"
          type="checkbox"
          className="drawer-toggle"
          checked={sidebar.drawerOpen}
          readOnly
        />

        <main id="main-content" className="drawer-content flex flex-col h-full min-w-0 overflow-hidden relative">
          <Outlet />
          <NodeDisconnectedOverlay />
        </main>

        <div ref={drawerSideRef} className="drawer-side z-50 h-full">
          <label
            htmlFor="sidebar-drawer"
            aria-label="close sidebar"
            className="drawer-overlay"
            onClick={closeDrawer}
          />
          <nav aria-label="Sidebar navigation" className="h-full w-full lg:w-[284px] flex flex-col overflow-hidden">
            <Sidebar onSessionSelect={closeDrawer} />
          </nav>
        </div>
      </div>
      <NodeSettingsModal
        isOpen={sidebar.nodeSettingsOpen}
        onClose={sidebar.closeNodeSettings}
      />
      <AddProjectModal
        isOpen={sidebar.addProjectOpen}
        onClose={sidebar.closeAddProject}
      />
      <RemoveProjectConfirm />
    </div>
  );
}

import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

class ViewErrorBoundary extends Component<{ children: ReactNode; viewName: string }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode; viewName: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[lattice] View error in " + this.props.viewName + ":", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      const self = this;
      return (
        <div className="flex flex-col items-center justify-center h-full bg-base-100 bg-lattice-grid gap-4 p-8">
          <AlertTriangle size={32} className="text-warning/50" />
          <div className="text-center max-w-[500px]">
            <p className="text-[14px] font-mono text-base-content/60 mb-1">
              Error in {this.props.viewName}
            </p>
            <p className="text-[12px] text-base-content/30 mb-4 font-mono break-all">
              {this.state.error?.message || "Unknown error"}
            </p>
            <button
              onClick={function () { self.setState({ hasError: false, error: null }); }}
              className="btn btn-ghost btn-sm text-[12px] gap-1.5"
            >
              <RefreshCw size={12} />
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function IndexPage() {
  const sidebar = useSidebar();
  const workspace = useWorkspace();
  const viewName = sidebar.activeView.type;

  const activePane = workspace.panes.find(function (p) { return p.id === workspace.activePaneId; });
  const activeTab = activePane
    ? workspace.tabs.find(function (t) { return t.id === activePane!.activeTabId; })
    : null;
  const hasWorkspaceTab = activeTab && activeTab.id !== "chat";

  let content;
  if (viewName === "settings") {
    content = <SettingsView />;
  } else if (viewName === "project-settings") {
    content = <ProjectSettingsView />;
  } else if (viewName === "dashboard") {
    content = <DashboardView />;
  } else if (viewName === "project-dashboard") {
    content = <ProjectDashboardView />;
  } else if (viewName === "analytics") {
    content = <AnalyticsView />;
  } else if (viewName === "context") {
    content = <WorkspaceView />;
  } else {
    content = <WorkspaceView />;
  }
  return (
    <ViewErrorBoundary viewName={viewName}>
      {content}
    </ViewErrorBoundary>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: function () { return rootRoute; },
  path: "/",
  component: IndexPage,
});

const projectRoute = createRoute({
  getParentRoute: function () { return rootRoute; },
  path: "/$projectSlug",
  component: IndexPage,
});

const settingsRoute = createRoute({
  getParentRoute: function () { return rootRoute; },
  path: "/settings/$section",
  component: IndexPage,
});

const settingsIndexRoute = createRoute({
  getParentRoute: function () { return rootRoute; },
  path: "/settings",
  component: IndexPage,
});

const projectSettingsRoute = createRoute({
  getParentRoute: function () { return rootRoute; },
  path: "/$projectSlug/settings/$section",
  component: IndexPage,
});

const projectSettingsIndexRoute = createRoute({
  getParentRoute: function () { return rootRoute; },
  path: "/$projectSlug/settings",
  component: IndexPage,
});

const routeTree = rootRoute.addChildren([indexRoute, settingsIndexRoute, settingsRoute, projectSettingsIndexRoute, projectSettingsRoute, projectRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
