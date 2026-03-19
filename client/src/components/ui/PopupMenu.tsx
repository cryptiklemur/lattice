import { useEffect, useRef } from "react";

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
  var menuRef = useRef<HTMLDivElement>(null);

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

  var style: React.CSSProperties = {};
  if (props.anchorRef.current) {
    var rect = props.anchorRef.current.getBoundingClientRect();
    var pos = props.position ?? "above";
    if (pos === "above") {
      style.bottom = window.innerHeight - rect.top + 4 + "px";
      style.left = rect.left + "px";
    } else if (pos === "below") {
      style.top = rect.bottom + 4 + "px";
      style.left = rect.left + "px";
    } else if (pos === "right") {
      style.top = rect.top + "px";
      style.left = rect.right + 4 + "px";
    }
  }

  return (
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
    </div>
  );
}
