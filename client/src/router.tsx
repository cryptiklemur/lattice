import { createRouter, createRootRoute, createRoute, createMemoryHistory } from "@tanstack/react-router";
import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./components/sidebar/Sidebar";
import { ChatView } from "./components/chat/ChatView";

function RootLayout() {
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
        className="sidebar"
        style={{
          width: "var(--sidebar-width)",
          minWidth: "var(--sidebar-width)",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Sidebar />
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
