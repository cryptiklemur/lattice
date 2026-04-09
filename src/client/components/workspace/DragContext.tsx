import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";

interface DragState {
  draggedTabId: string | null;
  sourcePaneId: string | null;
  isDragging: boolean;
  startDrag: (tabId: string, paneId: string) => void;
  endDrag: () => void;
}

const DragCtx = createContext<DragState>({
  draggedTabId: null,
  sourcePaneId: null,
  isDragging: false,
  startDrag: function () {},
  endDrag: function () {},
});

export function DragProvider({ children }: { children: ReactNode }) {
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [sourcePaneId, setSourcePaneId] = useState<string | null>(null);

  const startDrag = useCallback(function (tabId: string, paneId: string) {
    setDraggedTabId(tabId);
    setSourcePaneId(paneId);
  }, []);

  const endDrag = useCallback(function () {
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
