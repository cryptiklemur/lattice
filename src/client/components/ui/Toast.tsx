import { useEffect, useState, useCallback } from "react";
import { X, Info, AlertTriangle, AlertCircle } from "lucide-react";

export interface ToastOptions {
  persistent?: boolean;
  duration?: number;
}

export interface ToastItem {
  id: string;
  message: string;
  type: "info" | "error" | "warning";
  persistent?: boolean;
  duration?: number;
}

interface ToastProps {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}

const ICON_MAP = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
};

const ACCENT_MAP = {
  info: "bg-primary",
  warning: "bg-warning",
  error: "bg-error",
};

const ICON_COLOR_MAP = {
  info: "text-primary",
  warning: "text-warning",
  error: "text-error",
};

export function Toast(props: ToastProps) {
  if (props.items.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-3 right-3 z-[9999] flex flex-col gap-2 max-w-[340px]" role="status" aria-live="polite" aria-atomic="false">
      {props.items.map(function (item) {
        const Icon = ICON_MAP[item.type];
        return (
          <div
            key={item.id}
            className="flex items-start gap-2.5 bg-base-300 border border-base-content/10 rounded-lg shadow-xl px-3 py-2.5 animate-[toast-in_0.18s_ease]"
          >
            <div className={"w-0.5 self-stretch rounded-full flex-shrink-0 " + ACCENT_MAP[item.type]} />
            <Icon size={14} className={"flex-shrink-0 mt-0.5 " + ICON_COLOR_MAP[item.type]} />
            <span className="flex-1 text-[13px] text-base-content/80 leading-snug">{item.message}</span>
            <button
              onClick={function () { props.onDismiss(item.id); }}
              aria-label="Dismiss"
              className="flex-shrink-0 text-base-content/30 hover:text-base-content/60 transition-colors mt-0.5"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

let toastListeners: Array<(item: ToastItem) => void> = [];

export function showToast(message: string, type: ToastItem["type"] = "info", options?: ToastOptions): void {
  let persistent = options?.persistent;
  const duration = options?.duration;

  if (type === "error" && persistent === undefined && duration === undefined) {
    persistent = true;
  }

  const item: ToastItem = {
    id: Math.random().toString(36).slice(2),
    message,
    type,
    persistent,
    duration,
  };
  toastListeners.forEach(function (listener) {
    listener(item);
  });
}

export function useToastState(): { items: ToastItem[]; dismiss: (id: string) => void } {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback(function (id: string) {
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

      if (item.persistent) return;

      const timeout = item.duration ?? 5000;
      setTimeout(function () {
        setItems(function (prev) {
          return prev.filter(function (i) {
            return i.id !== item.id;
          });
        });
      }, timeout);
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
