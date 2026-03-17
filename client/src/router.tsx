import { createRouter, createRootRoute, createRoute, createMemoryHistory } from "@tanstack/react-router";
import { Outlet } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./components/sidebar/Sidebar";
import { ChatView } from "./components/chat/ChatView";
import { SetupWizard } from "./components/setup/SetupWizard";

function RootLayout() {
  var [setupComplete, setSetupComplete] = useState(function () {
    return localStorage.getItem("lattice-setup-complete") === "1";
  });

  var [sidebarOpen, setSidebarOpen] = useState(false);

  var toggleSidebar = useCallback(function () {
    setSidebarOpen(function (prev) { return !prev; });
  }, []);

  var closeSidebar = useCallback(function () {
    setSidebarOpen(false);
  }, []);

  if (!setupComplete) {
    return (
      <SetupWizard onComplete={function () { setSetupComplete(true); }} />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "var(--bg-primary)",
      }}
    >
      <div
        className={"sidebar-backdrop" + (sidebarOpen ? " sidebar-backdrop--visible" : "")}
        onClick={closeSidebar}
      />

      <div
        className={"sidebar" + (sidebarOpen ? " sidebar--open" : "")}
        style={{
          width: "var(--sidebar-width)",
          minWidth: "var(--sidebar-width)",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Sidebar onSessionSelect={closeSidebar} />
      </div>

      <div
        className="main-content"
        style={{
          flex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "0 12px",
          minHeight: "44px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
        }}>
          <button className="mobile-menu-btn" onClick={toggleSidebar} aria-label="Toggle sidebar">
            <Menu size={18} />
          </button>
          <div style={{ flex: 1 }} />
        </div>
        <Outlet />
      </div>
    </div>
  );
}

function IndexPage() {
  return <ChatView />;
}

var rootRoute = createRootRoute({
  component: RootLayout,
});

var indexRoute = createRoute({
  getParentRoute: function () { return rootRoute; },
  path: "/",
  component: IndexPage,
});

var routeTree = rootRoute.addChildren([indexRoute]);

export var router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
