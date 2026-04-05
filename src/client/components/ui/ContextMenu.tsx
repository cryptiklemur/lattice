import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}

export interface ContextMenuDivider {
  type: "divider";
  hidden?: boolean;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuDivider;

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
  label?: string;
}

export function ContextMenu(props: ContextMenuProps) {
  var menuRef = useRef<HTMLDivElement>(null);
  var [focusIndex, setFocusIndex] = useState(-1);
  var visibleItems = props.items.filter(function (item) { return !item.hidden; });

  useEffect(function () {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        props.onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex(function (prev) {
          var next = prev + 1;
          while (next < visibleItems.length && (visibleItems[next] as ContextMenuDivider).type === "divider") next++;
          return next < visibleItems.length ? next : prev;
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex(function (prev) {
          var next = prev - 1;
          while (next >= 0 && (visibleItems[next] as ContextMenuDivider).type === "divider") next--;
          return next >= 0 ? next : prev;
        });
        return;
      }
      if (e.key === "Enter" && focusIndex >= 0) {
        e.preventDefault();
        var item = visibleItems[focusIndex] as ContextMenuItem;
        if (item && !item.disabled && (item as unknown as ContextMenuDivider).type !== "divider") {
          item.onClick();
          props.onClose();
        }
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return function () {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [props.onClose, focusIndex, visibleItems]);

  useEffect(function () {
    if (!menuRef.current) return;
    var rect = menuRef.current.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    if (rect.right > vw) {
      menuRef.current.style.left = Math.max(4, props.x - rect.width) + "px";
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = Math.max(4, props.y - rect.height) + "px";
    }
  }, [props.x, props.y]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={props.label || "Context menu"}
      onMouseDown={function (e) { e.stopPropagation(); }}
      className="fixed z-[99999] bg-base-200 border border-base-content/20 rounded-lg shadow-xl p-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
      style={{ top: props.y, left: props.x }}
    >
      {visibleItems.map(function (entry, i) {
        if ((entry as ContextMenuDivider).type === "divider") {
          return <div key={"d-" + i} className="my-1 border-t border-base-content/10" />;
        }
        var item = entry as ContextMenuItem;
        var isFocused = i === focusIndex;
        return (
          <button
            key={i}
            role="menuitem"
            tabIndex={isFocused ? 0 : -1}
            disabled={item.disabled}
            onClick={function () {
              if (!item.disabled) {
                item.onClick();
                props.onClose();
              }
            }}
            onMouseEnter={function () { setFocusIndex(i); }}
            className={
              "flex items-center gap-2 w-full px-2.5 py-1.5 rounded text-[13px] text-left transition-colors duration-[80ms] cursor-pointer " +
              (item.disabled ? "opacity-40 cursor-not-allowed " : "") +
              (item.danger ? "text-error hover:bg-error/10 " : "text-base-content/70 hover:bg-base-300 hover:text-base-content ") +
              (isFocused ? (item.danger ? "bg-error/10" : "bg-base-300 text-base-content") : "")
            }
          >
            {item.icon && <span className="w-4 h-4 opacity-60 shrink-0">{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

export function useContextMenu<T>() {
  var [state, setState] = useState<{ x: number; y: number; data: T } | null>(null);

  function open(e: React.MouseEvent, data: T) {
    e.preventDefault();
    e.stopPropagation();
    setState({ x: e.clientX, y: e.clientY, data });
  }

  function close() {
    setState(null);
  }

  return { state, open, close };
}
