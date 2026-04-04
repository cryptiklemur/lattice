import { useEffect } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { WebSocketProvider } from "./providers/WebSocketProvider";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { Toast, useToastState } from "./components/ui/Toast";
import { CommandPalette } from "./components/ui/CommandPalette";
import { KeyboardShortcuts } from "./components/ui/KeyboardShortcuts";
import { UpdatePrompt } from "./components/ui/UpdatePrompt";

function AppInner() {
  var { items, dismiss } = useToastState();

  useEffect(function () {
    function blockContextMenu(e: MouseEvent) {
      if ((e.target as HTMLElement).closest("[data-allow-context-menu]")) return;
      e.preventDefault();
    }
    document.addEventListener("contextmenu", blockContextMenu);
    return function () { document.removeEventListener("contextmenu", blockContextMenu); };
  }, []);

  return (
    <>
      <RouterProvider router={router} />
      <CommandPalette />
      <KeyboardShortcuts />
      <Toast items={items} onDismiss={dismiss} />
      <UpdatePrompt />
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
