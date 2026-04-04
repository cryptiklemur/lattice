import { useState, useEffect } from "react";

var globalTick = 0;
var listeners = new Set<() => void>();
var interval: ReturnType<typeof setInterval> | null = null;

function startTicker() {
  if (interval) return;
  interval = setInterval(function () {
    globalTick++;
    listeners.forEach(function (cb) { cb(); });
  }, 60000);
}

function stopTicker() {
  if (listeners.size > 0) return;
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export function useTimeTick(): number {
  var [tick, setTick] = useState(globalTick);
  useEffect(function () {
    function update() { setTick(globalTick); }
    listeners.add(update);
    startTicker();
    return function () {
      listeners.delete(update);
      stopTicker();
    };
  }, []);
  return tick;
}
