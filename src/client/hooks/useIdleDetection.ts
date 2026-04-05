import { useEffect, useRef, useState } from "react";

var IDLE_TIMEOUT = 60 * 1000;

export function useIdleDetection(): boolean {
  var [isIdle, setIsIdle] = useState(false);
  var timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(function () {
    var lastReset = 0;

    function resetTimer() {
      var now = Date.now();
      if (now - lastReset < 500) return;
      lastReset = now;

      if (timerRef.current) clearTimeout(timerRef.current);
      setIsIdle(false);
      timerRef.current = setTimeout(function () {
        setIsIdle(true);
      }, IDLE_TIMEOUT);
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        setIsIdle(true);
      } else {
        resetTimer();
      }
    }

    var events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach(function (event) {
      document.addEventListener(event, resetTimer, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    resetTimer();

    return function () {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(function (event) {
        document.removeEventListener(event, resetTimer);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return isIdle;
}
