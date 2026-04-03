import { useState } from "react";
import { useNotificationPreference } from "../../hooks/useNotifications";
import { usePushNotifications } from "../../hooks/usePushNotifications";

var NOTIFICATION_TYPES = [
  { key: "responses", label: "Claude responses", description: "When Claude finishes a response" },
  { key: "mesh", label: "Mesh node changes", description: "When nodes come online or go offline" },
  { key: "connection", label: "Connection events", description: "WebSocket connect and disconnect" },
] as const;

function loadTypePrefs(): Record<string, boolean> {
  try {
    var stored = localStorage.getItem("lattice-notification-types");
    if (stored) return JSON.parse(stored);
  } catch {}
  return { responses: true, mesh: true, connection: true };
}

function saveTypePrefs(prefs: Record<string, boolean>): void {
  localStorage.setItem("lattice-notification-types", JSON.stringify(prefs));
}

export function Notifications() {
  var notifPref = useNotificationPreference();
  var push = usePushNotifications();
  var [typePrefs, setTypePrefs] = useState<Record<string, boolean>>(loadTypePrefs);

  function toggleType(key: string) {
    setTypePrefs(function (prev) {
      var next = { ...prev, [key]: !prev[key] };
      saveTypePrefs(next);
      return next;
    });
  }

  return (
    <div className="py-2 space-y-6">
      <div>
        <h2 className="text-[12px] font-semibold text-base-content/40 mb-3">
          Browser Notifications
        </h2>
        <div className="flex items-center justify-between py-2 px-3 bg-base-300 border border-base-content/15 rounded-xl">
          <div>
            <div className="text-[13px] text-base-content">Enable notifications</div>
            <div className="text-[11px] text-base-content/30 mt-0.5">
              {notifPref.permission === "denied"
                ? "Blocked by browser — update in browser settings"
                : "Get notified about events in Lattice"}
            </div>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-sm toggle-primary"
            checked={notifPref.enabled}
            onChange={notifPref.toggle}
            disabled={notifPref.permission === "denied"}
          />
        </div>
      </div>

      {push.status !== "unsupported" && (
        <div>
          <h2 className="text-[12px] font-semibold text-base-content/40 mb-3">
            Push Notifications
          </h2>
          <div className="flex items-center justify-between py-2 px-3 bg-base-300 border border-base-content/15 rounded-xl">
            <div>
              <div className="text-[13px] text-base-content">Enable push notifications</div>
              <div className="text-[11px] text-base-content/30 mt-0.5">
                {push.status === "denied"
                  ? "Blocked by browser — update in browser settings"
                  : push.status === "subscribed"
                    ? "Receiving push notifications even when the tab is closed"
                    : "Get notified even when Lattice is not open"}
              </div>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary"
              checked={push.status === "subscribed"}
              onChange={function () {
                if (push.status === "subscribed") {
                  void push.unsubscribe();
                } else {
                  void push.subscribe();
                }
              }}
              disabled={push.status === "denied"}
            />
          </div>
        </div>
      )}

      <div>
        <h2 className="text-[12px] font-semibold text-base-content/40 mb-3">
          Notification Types
        </h2>
        <div className="flex flex-col gap-2">
          {NOTIFICATION_TYPES.map(function (nt) {
            return (
              <div
                key={nt.key}
                className="flex items-center justify-between py-2 px-3 bg-base-300 border border-base-content/15 rounded-xl"
              >
                <div>
                  <div className="text-[13px] text-base-content">{nt.label}</div>
                  <div className="text-[11px] text-base-content/30 mt-0.5">{nt.description}</div>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-sm toggle-primary"
                  checked={typePrefs[nt.key] !== false}
                  onChange={function () { toggleType(nt.key); }}
                  disabled={!notifPref.enabled}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
