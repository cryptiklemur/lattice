import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Settings, RefreshCw, Power } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";

interface UserMenuProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onOpenNodeSettings: () => void;
}

export function UserMenu(props: UserMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const ws = useWebSocket();
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const [confirmingShutdown, setConfirmingShutdown] = useState(false);

  useEffect(function () {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        props.anchorRef.current &&
        !props.anchorRef.current.contains(e.target as Node)
      ) {
        props.onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        props.onClose();
      }
    }
    function handleScroll() {
      props.onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true);
    return function () {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [props.onClose, props.anchorRef]);

  const style: React.CSSProperties = {};
  if (props.anchorRef.current) {
    const rect = props.anchorRef.current.getBoundingClientRect();
    style.bottom = window.innerHeight - rect.top + 4 + "px";
    let leftPos = rect.left;
    const menuW = 180;
    if (leftPos + menuW > window.innerWidth - 8) leftPos = window.innerWidth - menuW - 8;
    if (leftPos < 8) leftPos = 8;
    style.left = leftPos + "px";
  }

  function handleRestart() {
    if (!confirmingRestart) {
      setConfirmingRestart(true);
      setConfirmingShutdown(false);
      return;
    }
    ws.send({ type: "settings:restart" } as never);
    props.onClose();
  }

  function handleShutdown() {
    if (!confirmingShutdown) {
      setConfirmingShutdown(true);
      setConfirmingRestart(false);
      return;
    }
    fetch("/api/shutdown", { method: "POST" });
    props.onClose();
  }

  const itemClass = "w-full flex items-center gap-2 px-2.5 py-[6px] rounded text-[11px] text-left cursor-pointer transition-colors duration-[120ms] text-base-content/70 hover:bg-base-content/5 hover:text-base-content outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset";
  const dangerClass = "w-full flex items-center gap-2 px-2.5 py-[6px] rounded text-[11px] text-left cursor-pointer transition-colors duration-[120ms] text-error hover:bg-error/10 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset";

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Node menu"
      className="fixed z-[9999] bg-base-300 border border-base-content/10 rounded-lg shadow-xl p-1 min-w-[180px]"
      style={style}
    >
      <button role="menuitem" className={itemClass} onClick={function () { props.onOpenNodeSettings(); props.onClose(); }}>
        <span className="opacity-60 flex-shrink-0"><Settings size={13} /></span>
        Node Settings
      </button>

      <div className="h-px bg-base-content/8 my-1 mx-2" />

      <button role="menuitem" className={dangerClass} onClick={handleRestart}>
        <span className="opacity-60 flex-shrink-0"><RefreshCw size={13} /></span>
        {confirmingRestart ? "Click again to restart" : "Restart"}
      </button>
      <button role="menuitem" className={dangerClass} onClick={handleShutdown}>
        <span className="opacity-60 flex-shrink-0"><Power size={13} /></span>
        {confirmingShutdown ? "Click again to shutdown" : "Shutdown"}
      </button>
    </div>,
    document.body
  );
}
