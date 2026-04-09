import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface PopupMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  separator?: boolean;
}

interface PopupMenuProps {
  items: PopupMenuItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  position?: "above" | "below" | "right";
}

export function PopupMenu(props: PopupMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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
    const pos = props.position ?? "above";
    const menuWidth = 180;
    const menuHeight = 200;

    if (pos === "above") {
      style.bottom = window.innerHeight - rect.top + 4 + "px";
      let leftAbove = rect.left;
      if (leftAbove + menuWidth > window.innerWidth - 8) leftAbove = window.innerWidth - menuWidth - 8;
      if (leftAbove < 8) leftAbove = 8;
      style.left = leftAbove + "px";
    } else if (pos === "below") {
      const topBelow = rect.bottom + 4;
      if (topBelow + menuHeight > window.innerHeight - 8) {
        style.bottom = window.innerHeight - rect.top + 4 + "px";
      } else {
        style.top = topBelow + "px";
      }
      let leftBelow = rect.left;
      if (leftBelow + menuWidth > window.innerWidth - 8) leftBelow = window.innerWidth - menuWidth - 8;
      if (leftBelow < 8) leftBelow = 8;
      style.left = leftBelow + "px";
    } else if (pos === "right") {
      let topRight = rect.top;
      if (topRight + menuHeight > window.innerHeight - 8) topRight = window.innerHeight - menuHeight - 8;
      if (topRight < 8) topRight = 8;
      style.top = topRight + "px";
      let leftRight = rect.right + 4;
      if (leftRight + menuWidth > window.innerWidth - 8) leftRight = rect.left - menuWidth - 4;
      if (leftRight < 8) leftRight = 8;
      style.left = leftRight + "px";
    }
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Actions"
      className="fixed z-[9999] bg-base-300 border border-base-content/10 rounded-lg shadow-xl p-1 min-w-[180px] max-h-[80vh] overflow-y-auto"
      style={style}
    >
      {props.items.map(function (item) {
        if (item.separator) {
          return <div key={item.id} className="h-px bg-base-content/8 my-1 mx-2" />;
        }
        return (
          <button
            key={item.id}
            role="menuitem"
            onClick={function () { props.onSelect(item.id); }}
            className={
              "w-full flex items-center gap-2 px-2.5 py-[6px] rounded text-[11px] text-left cursor-pointer transition-colors duration-[120ms] outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset " +
              (item.danger
                ? "text-error hover:bg-error/10"
                : "text-base-content/70 hover:bg-base-content/5 hover:text-base-content")
            }
          >
            {item.icon && <span className="opacity-60 flex-shrink-0">{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </div>,
    document.body
  );
}
