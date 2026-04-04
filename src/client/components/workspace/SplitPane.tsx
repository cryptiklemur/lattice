import React, { useRef, useCallback, useEffect, useState } from "react";

interface SplitPaneProps {
  direction: "horizontal" | "vertical";
  ratio: number;
  onRatioChange: (ratio: number) => void;
  children: [React.ReactNode, React.ReactNode];
}

export function SplitPane({ direction, ratio, onRatioChange, children }: SplitPaneProps) {
  var containerRef = useRef<HTMLDivElement>(null);
  var [isDragging, setIsDragging] = useState(false);

  var handleMouseDown = useCallback(function (e: React.MouseEvent) {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(function () {
    if (!isDragging) return;

    function handleMouseMove(e: MouseEvent) {
      var container = containerRef.current;
      if (!container) return;
      var rect = container.getBoundingClientRect();
      var newRatio: number;
      if (direction === "horizontal") {
        newRatio = (e.clientX - rect.left) / rect.width;
      } else {
        newRatio = (e.clientY - rect.top) / rect.height;
      }
      onRatioChange(newRatio);
    }

    function handleMouseUp() {
      setIsDragging(false);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return function () {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, direction, onRatioChange]);

  var isHorizontal = direction === "horizontal";
  var firstSize = (ratio * 100) + "%";
  var secondSize = ((1 - ratio) * 100) + "%";

  return (
    <div
      ref={containerRef}
      className={"flex h-full w-full overflow-hidden " + (isHorizontal ? "flex-row" : "flex-col")}
      style={isDragging ? { userSelect: "none" } : undefined}
    >
      <div
        className="overflow-hidden"
        style={isHorizontal ? { width: firstSize, height: "100%" } : { height: firstSize, width: "100%" }}
      >
        {children[0]}
      </div>
      <div
        onMouseDown={handleMouseDown}
        className={
          "flex-shrink-0 bg-base-300 transition-colors " +
          (isHorizontal
            ? "w-1 cursor-col-resize hover:bg-primary/30"
            : "h-1 cursor-row-resize hover:bg-primary/30") +
          (isDragging ? " bg-primary/30" : "")
        }
      />
      <div
        className="overflow-hidden"
        style={isHorizontal ? { width: secondSize, height: "100%" } : { height: secondSize, width: "100%" }}
      >
        {children[1]}
      </div>
    </div>
  );
}
