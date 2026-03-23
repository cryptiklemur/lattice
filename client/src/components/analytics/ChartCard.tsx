import { useState, useEffect, useRef } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import type { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function ChartCard(props: ChartCardProps) {
  var [isFullscreen, setIsFullscreen] = useState(false);
  var cardRef = useRef<HTMLDivElement>(null);
  var [originRect, setOriginRect] = useState<DOMRect | null>(null);
  var [animating, setAnimating] = useState(false);

  function openFullscreen() {
    if (cardRef.current) {
      setOriginRect(cardRef.current.getBoundingClientRect());
    }
    setAnimating(true);
    setIsFullscreen(true);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        setAnimating(false);
      });
    });
  }

  function closeFullscreen() {
    setAnimating(true);
    setTimeout(function () {
      setIsFullscreen(false);
      setAnimating(false);
      setOriginRect(null);
    }, 250);
  }

  useEffect(function () {
    if (!isFullscreen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeFullscreen();
    }
    document.addEventListener("keydown", handleKeyDown);
    return function () { document.removeEventListener("keydown", handleKeyDown); };
  }, [isFullscreen]);

  useEffect(function () {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return function () { document.body.style.overflow = ""; };
  }, [isFullscreen]);

  var cardContent = (
    <>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-base-content/35">
          {props.title}
        </span>
        <div className="flex items-center gap-2">
          {props.action && <div>{props.action}</div>}
          <button
            onClick={function () {
              if (isFullscreen) {
                closeFullscreen();
              } else {
                openFullscreen();
              }
            }}
            className="text-base-content/20 hover:text-base-content/50 transition-colors cursor-pointer p-0.5 rounded hover:bg-base-content/5"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>
      {props.children}
    </>
  );

  if (isFullscreen) {
    var overlayStyle: React.CSSProperties = {
      transition: "opacity 250ms cubic-bezier(0.4, 0, 0.2, 1)",
      opacity: animating ? 0 : 1,
    };

    var modalStyle: React.CSSProperties = {
      transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)",
    };

    if (animating && originRect) {
      modalStyle.position = "fixed";
      modalStyle.top = originRect.top + "px";
      modalStyle.left = originRect.left + "px";
      modalStyle.width = originRect.width + "px";
      modalStyle.height = originRect.height + "px";
      modalStyle.opacity = 0;
    }

    return (
      <>
        <div
          ref={cardRef}
          className={"rounded-xl border border-base-content/8 bg-base-300/50 p-4 invisible " + (props.className || "")}
        >
          {cardContent}
        </div>

        <div
          className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
          style={overlayStyle}
          onClick={closeFullscreen}
        />
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-8"
          style={{ pointerEvents: "none" }}
        >
          <div
            className="w-full max-w-[1100px] rounded-2xl border border-base-content/10 bg-base-200 shadow-2xl overflow-hidden flex flex-col"
            style={Object.assign(
              { maxHeight: "65vh", pointerEvents: "auto" as const },
              animating
                ? { opacity: 0, transform: "scale(0.95)", transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)" }
                : { opacity: 1, transform: "scale(1)", transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)" }
            )}
          >
            <div className="flex items-center justify-between px-6 py-3 border-b border-base-content/8 flex-shrink-0">
              <span className="text-[12px] font-mono font-bold uppercase tracking-widest text-base-content/50">
                {props.title}
              </span>
              <div className="flex items-center gap-3">
                {props.action && <div>{props.action}</div>}
                <button
                  onClick={closeFullscreen}
                  className="text-base-content/30 hover:text-base-content/60 transition-colors cursor-pointer p-1 rounded-lg hover:bg-base-content/5"
                  aria-label="Exit fullscreen"
                >
                  <Minimize2 size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 p-6 overflow-auto min-h-0 fullscreen-chart-container">
              {props.children}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      ref={cardRef}
      className={"rounded-xl border border-base-content/8 bg-base-300/50 p-4 " + (props.className || "")}
    >
      {cardContent}
    </div>
  );
}
