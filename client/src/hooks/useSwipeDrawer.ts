import { useEffect, useRef } from "react";
import type { RefObject } from "react";

var LOCK_THRESHOLD = 15;
var SNAP_THRESHOLD = 0.35; // fraction of drawer width to snap open/close
var VELOCITY_THRESHOLD = 0.4; // px/ms — fast flick overrides position
var TRANSITION = "translate 0.25s cubic-bezier(0.4, 0, 0.2, 1)";
var OVERLAY_TRANSITION = "opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)";
var CONTENT_TRANSITION = "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)";

/**
 * Discord-style drag-follow drawer. The sidebar follows your finger
 * in real time and snaps open/closed on release based on position + velocity.
 *
 * Works from anywhere on the page. Vertical scrolling is not interrupted.
 */
export function useSwipeDrawer(
  drawerSideRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onOpen: () => void,
  onClose: () => void,
) {
  var stateRef = useRef({ isOpen: isOpen, onOpen: onOpen, onClose: onClose });
  stateRef.current = { isOpen: isOpen, onOpen: onOpen, onClose: onClose };

  useEffect(function () {
    var startX = 0;
    var startY = 0;
    var lastX = 0;
    var lastTime = 0;
    var velocity = 0;
    var tracking = false;
    var dragging = false; // true once direction locked to horizontal
    var direction: "h" | "v" | null = null;

    var panel: HTMLElement | null = null;
    var overlay: HTMLElement | null = null;
    var content: HTMLElement | null = null;
    var drawerWidth = 0;

    function getElements() {
      var side = drawerSideRef.current;
      if (!side) return false;
      // panel = the sidebar content (not the overlay)
      panel = side.querySelector(":scope > *:not(.drawer-overlay)") as HTMLElement | null;
      overlay = side.querySelector(":scope > .drawer-overlay") as HTMLElement | null;
      // content = the main content area (sibling of drawer-side)
      var parent = side.parentElement;
      if (parent) {
        content = parent.querySelector(":scope > .drawer-content") as HTMLElement | null;
      }
      if (panel) {
        drawerWidth = panel.getBoundingClientRect().width;
      }
      return !!panel;
    }

    function setDragStyles(offsetX: number) {
      if (!panel) return;
      // offsetX: 0 = fully open, -drawerWidth = fully closed
      var clamped = Math.max(-drawerWidth, Math.min(0, offsetX));
      var progress = 1 + clamped / drawerWidth; // 0 = closed, 1 = open

      panel.style.transition = "none";
      panel.style.translate = clamped + "px";

      if (overlay) {
        overlay.style.transition = "none";
        overlay.style.opacity = String(progress);
      }

      if (content) {
        var scale = 1 - progress * 0.03;
        content.style.transition = "none";
        content.style.transform = "scale(" + scale + ")";
        content.style.transformOrigin = "left center";
      }
    }

    function clearDragStyles() {
      if (panel) {
        panel.style.transition = "";
        panel.style.translate = "";
      }
      if (overlay) {
        overlay.style.transition = "";
        overlay.style.opacity = "";
      }
      if (content) {
        content.style.transition = "";
        content.style.transform = "";
        content.style.transformOrigin = "";
      }
    }

    function animateToOpen() {
      if (!panel) return;
      panel.style.transition = TRANSITION;
      panel.style.translate = "0%";
      if (overlay) {
        overlay.style.transition = OVERLAY_TRANSITION;
        overlay.style.opacity = "1";
      }
      if (content) {
        content.style.transition = CONTENT_TRANSITION;
        content.style.transform = "scale(0.97)";
        content.style.transformOrigin = "left center";
      }
    }

    function animateToClosed() {
      if (!panel) return;
      panel.style.transition = TRANSITION;
      panel.style.translate = "-100%";
      if (overlay) {
        overlay.style.transition = OVERLAY_TRANSITION;
        overlay.style.opacity = "0";
      }
      if (content) {
        content.style.transition = CONTENT_TRANSITION;
        content.style.transform = "scale(1)";
        content.style.transformOrigin = "left center";
      }
    }

    function cleanupAfterAnimation() {
      // After the CSS transition finishes, remove inline styles
      // so the checkbox-driven DaisyUI styles take over again
      setTimeout(function () {
        clearDragStyles();
      }, 280);
    }

    function onTouchStart(e: TouchEvent) {
      if (window.innerWidth >= 1024) return;
      var t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      lastX = t.clientX;
      lastTime = Date.now();
      velocity = 0;
      tracking = true;
      dragging = false;
      direction = null;
    }

    function onTouchMove(e: TouchEvent) {
      if (!tracking) return;
      var t = e.touches[0];
      var now = Date.now();

      // Calculate velocity
      var dt = now - lastTime;
      if (dt > 0) {
        velocity = (t.clientX - lastX) / dt;
      }
      lastX = t.clientX;
      lastTime = now;

      // Lock direction
      if (direction === null) {
        var dx = Math.abs(t.clientX - startX);
        var dy = Math.abs(t.clientY - startY);
        if (dx >= LOCK_THRESHOLD || dy >= LOCK_THRESHOLD) {
          if (dx > dy) {
            direction = "h";
            dragging = true;
            if (!getElements()) {
              tracking = false;
              return;
            }
            // Make drawer-side visible during drag if it's currently hidden
            var side = drawerSideRef.current;
            if (side) {
              side.style.visibility = "visible";
              side.style.pointerEvents = "auto";
              side.style.opacity = "1";
            }
          } else {
            direction = "v";
            tracking = false;
            return;
          }
        } else {
          return;
        }
      }

      if (!dragging) return;

      var deltaX = t.clientX - startX;
      var isOpen = stateRef.current.isOpen;

      if (isOpen) {
        // Dragging from open position: offset relative to 0 (fully open)
        setDragStyles(Math.min(0, deltaX));
      } else {
        // Dragging from closed position: offset relative to -drawerWidth
        setDragStyles(-drawerWidth + Math.max(0, deltaX));
      }
    }

    function onTouchEnd() {
      if (!tracking || !dragging) {
        tracking = false;
        direction = null;
        return;
      }

      var deltaX = lastX - startX;
      var isOpen = stateRef.current.isOpen;

      tracking = false;
      dragging = false;
      direction = null;

      // Decide: snap open or closed?
      // Fast flick overrides position
      var shouldOpen: boolean;

      if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
        shouldOpen = velocity > 0;
      } else if (isOpen) {
        // Currently open: close if dragged past threshold
        shouldOpen = deltaX > -drawerWidth * SNAP_THRESHOLD;
      } else {
        // Currently closed: open if dragged past threshold
        shouldOpen = deltaX > drawerWidth * SNAP_THRESHOLD;
      }

      if (shouldOpen) {
        animateToOpen();
        if (!isOpen) stateRef.current.onOpen();
      } else {
        animateToClosed();
        if (isOpen) stateRef.current.onClose();
      }

      cleanupAfterAnimation();
    }

    function onTouchCancel() {
      if (dragging) {
        clearDragStyles();
        // Restore drawer-side to CSS-driven state
        var side = drawerSideRef.current;
        if (side) {
          side.style.visibility = "";
          side.style.pointerEvents = "";
          side.style.opacity = "";
        }
        if (content) {
          content.style.transition = "";
          content.style.transform = "";
          content.style.transformOrigin = "";
        }
      }
      tracking = false;
      dragging = false;
      direction = null;
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return function () {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [drawerSideRef]);
}
