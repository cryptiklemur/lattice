import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";

interface DragState {
  draggedTabId: string | null;
  sourcePaneId: string | null;
  isDragging: boolean;
  startDrag: (tabId: string, paneId: string) => void;
  endDrag: () => void;
}

var DragCtx = createContext<DragState>({
  draggedTabId: null,
  sourcePaneId: null,
  isDragging: false,
  startDrag: function () {},
  endDrag: function () {},
});

export function DragProvider({ children }: { children: ReactNode }) {
  var [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  var [sourcePaneId, setSourcePaneId] = useState<string | null>(null);

  var startDrag = useCallback(function (tabId: string, paneId: string) {
    setDraggedTabId(tabId);
    setSourcePaneId(paneId);
  }, []);

  var endDrag = useCallback(function () {
    setDraggedTabId(null);
    setSourcePaneId(null);
  }, []);

  return (
    <DragCtx.Provider value={{
      draggedTabId: draggedTabId,
      sourcePaneId: sourcePaneId,
      isDragging: draggedTabId !== null,
      startDrag: startDrag,
      endDrag: endDrag,
    }}>
      {children}
    </DragCtx.Provider>
  );
}

export function useTabDrag(): DragState {
  return useContext(DragCtx);
}
