import { useState, useEffect, useRef, createContext, useContext, useCallback } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { Maximize2, Minimize2 } from "lucide-react";
import type { ReactNode } from "react";

const ChartFullscreenContext = createContext<number | false>(false);

export function useChartFullscreen(): number | false {
  return useContext(ChartFullscreenContext);
}

function useViewportChartHeight(): number {
  const [h, setH] = useState(Math.round(window.innerHeight * 0.5));
  useEffect(function () {
    function onResize() { setH(Math.round(window.innerHeight * 0.5)); }
    window.addEventListener("resize", onResize);
    return function () { window.removeEventListener("resize", onResize); };
  }, []);
  return h;
}

interface ChartCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function ChartCard(props: ChartCardProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartHeight = useViewportChartHeight();
  const cardRef = useRef<HTMLDivElement>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const [animating, setAnimating] = useState(false);
  const fullscreenModalRef = useRef<HTMLDivElement>(null);
  const closeFullscreenCb = useCallback(function () { closeFullscreen(); }, []);
  useFocusTrap(fullscreenModalRef, closeFullscreenCb, isFullscreen);

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
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return function () { document.body.style.overflow = ""; };
  }, [isFullscreen]);

  const cardContent = (
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
            className="opacity-0 group-hover:opacity-100 text-base-content/20 hover:text-base-content/50 transition-all duration-200 cursor-pointer p-0.5 rounded hover:bg-base-content/5"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>
      <div role="img" aria-label={props.title}>
        {props.children}
      </div>
    </>
  );

  if (isFullscreen) {
    const overlayStyle: React.CSSProperties = {
      transition: "opacity 250ms cubic-bezier(0.4, 0, 0.2, 1)",
      opacity: animating ? 0 : 1,
    };

    const modalStyle: React.CSSProperties = {
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
          aria-label={props.title}
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
          ref={fullscreenModalRef}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-8"
          style={{ pointerEvents: "none" }}
          role="dialog"
          aria-modal="true"
          aria-label={props.title + " (fullscreen)"}
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
            <div className="flex-1 p-6 overflow-auto min-h-0">
              <ChartFullscreenContext.Provider value={chartHeight}>
                <div style={{ height: chartHeight + "px" }}>
                  {props.children}
                </div>
              </ChartFullscreenContext.Provider>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      ref={cardRef}
      aria-label={props.title}
      className={"group rounded-xl border border-base-content/8 bg-base-300/50 p-4 cursor-pointer hover:border-base-content/12 transition-all duration-200 " + (props.className || "")}
    >
      {cardContent}
    </div>
  );
}
