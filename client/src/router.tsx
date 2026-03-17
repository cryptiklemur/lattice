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
    <div className="flex w-full h-full overflow-hidden bg-base-100">
      <div className="drawer lg:drawer-open h-full w-full">
        <input
          id="sidebar-drawer"
          type="checkbox"
          className="drawer-toggle"
          checked={sidebarOpen}
          onChange={function () {}}
        />

        <div className="drawer-content flex flex-col h-full min-w-0">
          <div className="flex items-center gap-2 px-3 min-h-[44px] border-b border-base-300 bg-base-200 lg:hidden flex-shrink-0">
            <label
              htmlFor="sidebar-drawer"
              className="btn btn-ghost btn-sm btn-square"
              aria-label="Toggle sidebar"
              onClick={toggleSidebar}
            >
              <Menu size={18} />
            </label>
          </div>
          <Outlet />
        </div>

        <div className="drawer-side z-50 h-full">
          <label
            htmlFor="sidebar-drawer"
            aria-label="close sidebar"
            className="drawer-overlay"
            onClick={closeSidebar}
          />
          <div className="h-full w-[240px] flex flex-col overflow-hidden bg-base-200 border-r border-base-300">
            <Sidebar onSessionSelect={closeSidebar} />
          </div>
        </div>
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
