import { useState } from "react";
import { useTabDrag } from "./DragContext";
import { useWorkspace } from "../../hooks/useWorkspace";

interface DropZoneOverlayProps {
  paneId: string;
}

type Zone = "top" | "left" | "center" | "right" | "bottom";

export function DropZoneOverlay({ paneId }: DropZoneOverlayProps) {
  var drag = useTabDrag();
  var workspace = useWorkspace();
  var [activeZone, setActiveZone] = useState<Zone | null>(null);

  if (!drag.isDragging) return null;
  if (drag.sourcePaneId === paneId && workspace.panes.length < 2) {
    var sourcePane = workspace.panes.find(function (p) { return p.id === paneId; });
    if (sourcePane && sourcePane.tabIds.length < 2) return null;
  }

  var isSplitMode = workspace.panes.length >= 2;
  var isSourcePane = drag.sourcePaneId === paneId;
  var showEdgeZones: boolean;
  var showCenterZone: boolean;

  if (isSplitMode) {
    showEdgeZones = false;
    showCenterZone = !isSourcePane;
  } else {
    showEdgeZones = true;
    showCenterZone = false;
  }

  if (isSourcePane && !isSplitMode) {
    var srcPane = workspace.panes.find(function (p) { return p.id === drag.sourcePaneId; });
    if (srcPane && srcPane.tabIds.length < 2) {
      showEdgeZones = false;
    }
  }

  if (!showEdgeZones && !showCenterZone) return null;

  function handleDragOver(e: React.DragEvent, zone: Zone) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setActiveZone(zone);
  }

  function handleDragLeave(e: React.DragEvent) {
    var relatedTarget = e.relatedTarget as HTMLElement | null;
    if (relatedTarget && e.currentTarget.contains(relatedTarget)) return;
    setActiveZone(null);
  }

  function handleDrop(e: React.DragEvent, zone: Zone) {
    e.preventDefault();
    e.stopPropagation();
    if (!drag.draggedTabId || !drag.sourcePaneId) return;

    if (zone === "center" && !isSourcePane) {
      workspace.moveTabToPane(drag.draggedTabId, drag.sourcePaneId, paneId);
    } else if (zone === "left") {
      workspace.splitPane(drag.draggedTabId, "horizontal", "before");
    } else if (zone === "right") {
      workspace.splitPane(drag.draggedTabId, "horizontal", "after");
    } else if (zone === "top") {
      workspace.splitPane(drag.draggedTabId, "vertical", "before");
    } else if (zone === "bottom") {
      workspace.splitPane(drag.draggedTabId, "vertical", "after");
    }

    setActiveZone(null);
    drag.endDrag();
  }

  var zoneBase = "flex items-center justify-center rounded-lg border-2 border-dashed transition-colors duration-150 text-xs font-semibold font-mono pointer-events-auto";
  var edgeIdle = "border-primary/30 bg-primary/5 text-primary/40";
  var edgeActive = "border-primary/60 bg-primary/20 text-primary/80";
  var centerIdle = "border-info/30 bg-info/5 text-info/40";
  var centerActive = "border-info/60 bg-info/20 text-info/80";

  return (
    <div
      className="absolute inset-0 z-50 pointer-events-none"
      onDragLeave={handleDragLeave}
    >
      <div
        className="w-full h-full grid gap-1 p-2"
        style={{
          gridTemplateColumns: showEdgeZones ? "48px 1fr 48px" : "1fr",
          gridTemplateRows: showEdgeZones ? "40px 1fr 40px" : "1fr",
        }}
      >
        {showEdgeZones && (
          <div
            className={zoneBase + " col-span-3 " + (activeZone === "top" ? edgeActive : edgeIdle)}
            onDragOver={function (e) { handleDragOver(e, "top"); }}
            onDrop={function (e) { handleDrop(e, "top"); }}
          >
            Split Up
          </div>
        )}
        {showEdgeZones && (
          <div
            className={zoneBase + " " + (activeZone === "left" ? edgeActive : edgeIdle)}
            style={{ writingMode: "vertical-lr" }}
            onDragOver={function (e) { handleDragOver(e, "left"); }}
            onDrop={function (e) { handleDrop(e, "left"); }}
          >
            Split Left
          </div>
        )}
        {(showEdgeZones || showCenterZone) && (
          <div
            className={zoneBase + " " + (activeZone === "center" ? centerActive : centerIdle)}
            onDragOver={function (e) { handleDragOver(e, "center"); }}
            onDrop={function (e) { handleDrop(e, "center"); }}
          >
            {showCenterZone ? "Move Here" : ""}
          </div>
        )}
        {showEdgeZones && (
          <div
            className={zoneBase + " " + (activeZone === "right" ? edgeActive : edgeIdle)}
            style={{ writingMode: "vertical-lr" }}
            onDragOver={function (e) { handleDragOver(e, "right"); }}
            onDrop={function (e) { handleDrop(e, "right"); }}
          >
            Split Right
          </div>
        )}
        {showEdgeZones && (
          <div
            className={zoneBase + " col-span-3 " + (activeZone === "bottom" ? edgeActive : edgeIdle)}
            onDragOver={function (e) { handleDragOver(e, "bottom"); }}
            onDrop={function (e) { handleDrop(e, "bottom"); }}
          >
            Split Down
          </div>
        )}
      </div>
    </div>
  );
}
