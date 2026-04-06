import { useEffect } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { WebSocketProvider } from "./providers/WebSocketProvider";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { Toast, useToastState } from "./components/ui/Toast";
import { CommandPalette } from "./components/ui/CommandPalette";
import { KeyboardShortcuts } from "./components/ui/KeyboardShortcuts";
import { UpdatePrompt } from "./components/ui/UpdatePrompt";
import { useWebSocket } from "./hooks/useWebSocket";
import { setCustomThemes } from "./stores/theme";
import type { Theme, ThemeEntry } from "./themes/index";
import type { ServerMessage } from "#shared";

function useCustomThemeLoader() {
  var ws = useWebSocket();

  useEffect(function () {
    function handleCustomList(msg: ServerMessage) {
      if ((msg as any).type === "theme:custom_list") {
        var raw = (msg as any).themes || [];
        var entries: ThemeEntry[] = raw.map(function (ct: any): ThemeEntry {
          return {
            id: "custom:" + ct.filename,
            theme: {
              name: ct.name,
              author: ct.author,
              variant: ct.variant as "dark" | "light",
              ...ct.colors,
            } as Theme,
          };
        });
        setCustomThemes(entries);
      }
    }
    function handleChanged(msg: ServerMessage) {
      if ((msg as any).type === "theme:saved" || (msg as any).type === "theme:deleted") {
        ws.send({ type: "theme:list_custom" } as any);
      }
    }
    ws.subscribe("theme:custom_list", handleCustomList);
    ws.subscribe("theme:saved", handleChanged);
    ws.subscribe("theme:deleted", handleChanged);
    ws.send({ type: "theme:list_custom" } as any);
    return function () {
      ws.unsubscribe("theme:custom_list", handleCustomList);
      ws.unsubscribe("theme:saved", handleChanged);
      ws.unsubscribe("theme:deleted", handleChanged);
    };
  }, []);
}

function AppInner() {
  var { items, dismiss } = useToastState();
  useCustomThemeLoader();

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
