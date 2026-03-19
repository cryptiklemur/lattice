import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { WebSocketProvider } from "./providers/WebSocketProvider";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { Toast, useToastState } from "./components/ui/Toast";
import { CommandPalette } from "./components/ui/CommandPalette";

function AppInner() {
  var { items, dismiss } = useToastState();

  return (
    <>
      <RouterProvider router={router} />
      <CommandPalette />
      <Toast items={items} onDismiss={dismiss} />
    </>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <WebSocketProvider>
        <AppInner />
      </WebSocketProvider>
    </ErrorBoundary>
  );
}
