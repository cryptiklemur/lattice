import { createRouter, createRootRoute, createRoute, createMemoryHistory } from "@tanstack/react-router";
import { Outlet } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Sidebar } from "./components/sidebar/Sidebar";
import { WorkspaceView } from "./components/workspace/WorkspaceView";
import { SetupWizard } from "./components/setup/SetupWizard";
import { SettingsView } from "./components/settings/SettingsView";
import { ProjectSettingsView } from "./components/project-settings/ProjectSettingsView";
import { DashboardView } from "./components/dashboard/DashboardView";
import { ProjectDashboardView } from "./components/dashboard/ProjectDashboardView";
import { NodeSettingsModal } from "./components/sidebar/NodeSettingsModal";
import { AddProjectModal } from "./components/sidebar/AddProjectModal";
import { useSidebar } from "./hooks/useSidebar";
import { useWebSocket } from "./hooks/useWebSocket";
import { useSwipeDrawer } from "./hooks/useSwipeDrawer";
import { exitSettings, getSidebarStore, handlePopState, closeDrawer, toggleDrawer } from "./stores/sidebar";

function LoadingScreen() {
  var ws = useWebSocket();
  var [dataReceived, setDataReceived] = useState(false);
  var [minTimeElapsed, setMinTimeElapsed] = useState(false);
  var [initialLoadDone, setInitialLoadDone] = useState(false);
  var canvasRef = useRef<HTMLCanvasElement>(null);
  var frameRef = useRef<number>(0);

  useEffect(function () {
    var timer = setTimeout(function () {
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

  var initialReady = dataReceived && minTimeElapsed;
  var isDisconnected = initialLoadDone && ws.status !== "connected";
  var ready = initialReady && !isDisconnected;
  var visible = !initialReady || isDisconnected;

  useEffect(function () {
    if (initialReady && !initialLoadDone) {
      var timer = setTimeout(function () {
        setInitialLoadDone(true);
      }, 300);
      return function () { clearTimeout(timer); };
    }
  }, [initialReady, initialLoadDone]);

  useEffect(function () {
    var canvas = canvasRef.current;
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var gridSize = 9;
    var spacing = 26;
    var dotRadius = 3.5;
    var padding = 20;
    var canvasSize = padding * 2 + (gridSize - 1) * spacing;
    var dpr = window.devicePixelRatio || 1;

    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    canvas.style.width = canvasSize + "px";
    canvas.style.height = canvasSize + "px";
    ctx.scale(dpr, dpr);

    var centerX = canvasSize / 2;
    var centerY = canvasSize / 2;
    var logoSquare = 14;
    var logoGap = 4;
    var logoHalf = (logoSquare * 2 + logoGap) / 2;
    var logoLeft = centerX - logoHalf;
    var logoTop = centerY - logoHalf;
    var logoRight = centerX + logoHalf;
    var logoBottom = centerY + logoHalf;

    var primary = "oklch(55% 0.25 280)";

    type Dot = { x: number; y: number; col: number; row: number; hidden: boolean; brightness: number };
    var dots: Dot[] = [];
    for (var row = 0; row < gridSize; row++) {
      for (var col = 0; col < gridSize; col++) {
        var x = padding + col * spacing;
        var y = padding + row * spacing;
        var hidden = x + dotRadius > logoLeft && x - dotRadius < logoRight &&
                     y + dotRadius > logoTop && y - dotRadius < logoBottom;
        dots.push({ x: x, y: y, col: col, row: row, hidden: hidden, brightness: 0.08 });
      }
    }

    type Connection = {
      a: number; b: number;
      birth: number; duration: number;
      fadeIn: number; fadeOut: number;
    };
    var connections: Connection[] = [];
    var maxConnections = 10;
    var now = performance.now();

    function getNeighbors(idx: number): number[] {
      var d = dots[idx];
      var result: number[] = [];
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          var nr = d.row + dr;
          var nc = d.col + dc;
          if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize) {
            var ni = nr * gridSize + nc;
            if (!dots[ni].hidden) result.push(ni);
          }
        }
      }
      return result;
    }

    function animate() {
      now = performance.now();
      ctx!.clearRect(0, 0, canvasSize, canvasSize);

      if (connections.length < maxConnections && Math.random() < 0.04) {
        var candidates: number[] = [];
        for (var i = 0; i < dots.length; i++) {
          if (!dots[i].hidden) candidates.push(i);
        }
        var attempts = 0;
        while (attempts < 5 && connections.length < maxConnections) {
          var ai = candidates[Math.floor(Math.random() * candidates.length)];
          var neighbors = getNeighbors(ai);
          if (neighbors.length > 0) {
            var bi = neighbors[Math.floor(Math.random() * neighbors.length)];
            var exists = false;
            for (var j = 0; j < connections.length; j++) {
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

      var connectedSet = new Set<number>();
      var keep: Connection[] = [];
      for (var ci = 0; ci < connections.length; ci++) {
        var c = connections[ci];
        var age = now - c.birth;
        if (age > c.duration) continue;
        keep.push(c);

        var alpha = 1.0;
        if (age < c.fadeIn) {
          alpha = age / c.fadeIn;
        } else if (age > c.duration - c.fadeOut) {
          alpha = (c.duration - age) / c.fadeOut;
        }

        connectedSet.add(c.a);
        connectedSet.add(c.b);

        var da = dots[c.a];
        var db = dots[c.b];
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

      for (var di = 0; di < dots.length; di++) {
        var dot = dots[di];
        if (dot.hidden) continue;
        var targetBrightness = connectedSet.has(di) ? 0.7 : 0.08;
        dot.brightness += (targetBrightness - dot.brightness) * 0.08;
        ctx!.beginPath();
        ctx!.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2);
        ctx!.fillStyle = primary;
        ctx!.globalAlpha = dot.brightness;
        ctx!.fill();
        ctx!.globalAlpha = 1.0;
      }

      var pulse = 0.4 + 0.2 * Math.sin(now / 800);
      var squares = [
        [logoLeft, logoTop],
        [logoLeft + logoSquare + logoGap, logoTop],
        [logoLeft, logoTop + logoSquare + logoGap],
        [logoLeft + logoSquare + logoGap, logoTop + logoSquare + logoGap],
      ];
      for (var si = 0; si < squares.length; si++) {
        var sx = squares[si][0];
        var sy = squares[si][1];
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

  var statusText = isDisconnected
    ? "Reconnecting..."
    : ws.status === "connecting" ? "Connecting..."
    : "Loading projects...";

  var bgClass = isDisconnected ? "bg-base-100/90" : "bg-base-100";

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
  var sidebar = useSidebar();
  var ws = useWebSocket();
  var slug = sidebar.confirmRemoveSlug;

  if (!slug) return null;

  var projects = (function () {
    try {
      var store = getSidebarStore();
      return store.state;
    } catch {
      return null;
    }
  })();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={sidebar.closeConfirmRemove} />
      <div className="relative bg-base-200 border border-base-content/15 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
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
  var [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  var ws = useWebSocket();

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

  var sidebar = useSidebar();
  var drawerSideRef = useRef<HTMLDivElement>(null);

  useSwipeDrawer(drawerSideRef, sidebar.drawerOpen, toggleDrawer, closeDrawer);

  useEffect(function () {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        var state = getSidebarStore().state;
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
      <LoadingScreen />
      <div className="drawer lg:drawer-open h-full w-full">
        <input
          id="sidebar-drawer"
          type="checkbox"
          className="drawer-toggle"
          checked={sidebar.drawerOpen}
          onChange={function () {}}
        />

        <div className="drawer-content flex flex-col h-full min-w-0 overflow-hidden">
          <Outlet />
        </div>

        <div ref={drawerSideRef} className="drawer-side z-50 h-full">
          <label
            htmlFor="sidebar-drawer"
            aria-label="close sidebar"
            className="drawer-overlay"
            onClick={closeDrawer}
          />
          <div className="h-full w-full lg:w-[284px] flex flex-col overflow-hidden">
            <Sidebar onSessionSelect={closeDrawer} />
          </div>
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

function IndexPage() {
  var sidebar = useSidebar();
  if (sidebar.activeView.type === "dashboard") {
    return <DashboardView />;
  }
  if (sidebar.activeView.type === "settings") {
    return <SettingsView />;
  }
  if (sidebar.activeView.type === "project-settings") {
    return <ProjectSettingsView />;
  }
  if (sidebar.activeView.type === "project-dashboard") {
    return <ProjectDashboardView />;
  }
  return <WorkspaceView />;
}

var rootRoute = createRootRoute({
  component: RootLayout,
});

var indexRoute = createRoute({
  getParentRoute: function () { return rootRoute; },
  path: "/",
  component: IndexPage,
});

var projectRoute = createRoute({
  getParentRoute: function () { return rootRoute; },
  path: "/$projectSlug",
  component: IndexPage,
});

var sessionRoute = createRoute({
  getParentRoute: function () { return rootRoute; },
  path: "/$projectSlug/$sessionId",
  component: IndexPage,
});

var settingsRoute = createRoute({
  getParentRoute: function () { return rootRoute; },
  path: "/settings/$section",
  component: IndexPage,
});

var settingsIndexRoute = createRoute({
  getParentRoute: function () { return rootRoute; },
  path: "/settings",
  component: IndexPage,
});

var projectSettingsRoute = createRoute({
  getParentRoute: function () { return rootRoute; },
  path: "/$projectSlug/settings/$section",
  component: IndexPage,
});

var projectSettingsIndexRoute = createRoute({
  getParentRoute: function () { return rootRoute; },
  path: "/$projectSlug/settings",
  component: IndexPage,
});

var routeTree = rootRoute.addChildren([indexRoute, settingsIndexRoute, settingsRoute, projectSettingsIndexRoute, projectSettingsRoute, projectRoute, sessionRoute]);

export var router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
