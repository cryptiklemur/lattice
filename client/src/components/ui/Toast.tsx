import { useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";

export interface ToastItem {
  id: string;
  message: string;
  type: "info" | "error" | "warning";
}

interface ToastProps {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}

export function Toast(props: ToastProps) {
  if (props.items.length === 0) {
    return null;
  }

  return (
    <div className="toast toast-top toast-end z-[9999]">
      {props.items.map(function (item) {
        var alertClass =
          item.type === "error"
            ? "alert-error"
            : item.type === "warning"
            ? "alert-warning"
            : "alert-info";

        return (
          <div key={item.id} className={"alert " + alertClass + " flex items-center gap-3 pr-2 shadow-lg max-w-[360px] animate-[toast-in_0.18s_ease]"}>
            <span className="flex-1 text-[13px] font-medium leading-snug">{item.message}</span>
            <button
              onClick={function () { props.onDismiss(item.id); }}
              aria-label="Dismiss"
              className="btn btn-ghost btn-xs btn-square opacity-70 hover:opacity-100"
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
}

var toastListeners: Array<(item: ToastItem) => void> = [];

export function showToast(message: string, type: ToastItem["type"] = "info"): void {
  var item: ToastItem = {
    id: Math.random().toString(36).slice(2),
    message,
    type,
  };
  toastListeners.forEach(function (listener) {
    listener(item);
  });
}

export function useToastState(): { items: ToastItem[]; dismiss: (id: string) => void } {
  var [items, setItems] = useState<ToastItem[]>([]);

  var dismiss = useCallback(function (id: string) {
    setItems(function (prev) {
      return prev.filter(function (item) {
        return item.id !== id;
      });
    });
  }, []);

  useEffect(function () {
    function listener(item: ToastItem) {
      setItems(function (prev) {
        return [...prev, item];
      });
      setTimeout(function () {
        setItems(function (prev) {
          return prev.filter(function (i) {
            return i.id !== item.id;
          });
        });
      }, 5000);
    }

    toastListeners.push(listener);

    return function () {
      toastListeners = toastListeners.filter(function (l) {
        return l !== listener;
      });
    };
  }, []);

  return { items, dismiss };
}
