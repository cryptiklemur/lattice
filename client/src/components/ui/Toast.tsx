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
    <div className="toast-container">
      {props.items.map(function (item) {
        return (
          <div key={item.id} className={"toast toast--" + item.type}>
            <span className="toast-message">{item.message}</span>
            <button
              className="toast-dismiss"
              onClick={function () {
                props.onDismiss(item.id);
              }}
              aria-label="Dismiss"
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
