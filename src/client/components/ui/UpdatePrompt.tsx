import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export function UpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(function () {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then(function (reg) {
      reg.addEventListener("updatefound", function () {
        const newWorker = reg.installing;
        if (!newWorker) return;
        const worker: ServiceWorker = newWorker;
        worker.addEventListener("statechange", function () {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setRegistration(reg);
            setShowUpdate(true);
          }
        });
      });
    });
  }, []);

  function handleReload() {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    window.location.reload();
  }

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9998] bg-base-300 border border-base-content/15 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 max-w-sm">
      <RefreshCw size={16} className="text-primary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-base-content font-semibold">Update available</div>
        <div className="text-[11px] text-base-content/40">A new version of Lattice is ready.</div>
      </div>
      <button onClick={handleReload} className="btn btn-primary btn-xs">
        Reload
      </button>
    </div>
  );
}
