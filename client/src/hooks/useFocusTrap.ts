import { useEffect, useRef } from "react";

var FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  active: boolean = true,
): void {
  var previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(function () {
    if (!active) return;

    var container = containerRef.current;
    if (!container) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    var focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusable.length > 0) {
      focusable[0].focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      var currentContainer = containerRef.current;
      if (!currentContainer) return;

      var elements = currentContainer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (elements.length === 0) return;

      var first = elements[0];
      var last = elements[elements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    var el = container;
    el.addEventListener("keydown", handleKeyDown);

    return function () {
      el.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocusedRef.current && typeof previouslyFocusedRef.current.focus === "function") {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [containerRef, onClose, active]);
}
