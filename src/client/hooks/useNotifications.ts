import { useState } from "react";

export function useNotificationPreference() {
  const [enabled, setEnabled] = useState(function () {
    return localStorage.getItem("lattice-notifications-enabled") === "1";
  });

  const permission = typeof Notification !== "undefined" ? Notification.permission : "denied";

  function toggle() {
    if (!enabled) {
      if (permission === "default") {
        Notification.requestPermission().then(function (result) {
          if (result === "granted") {
            setEnabled(true);
            localStorage.setItem("lattice-notifications-enabled", "1");
          }
        });
      } else if (permission === "granted") {
        setEnabled(true);
        localStorage.setItem("lattice-notifications-enabled", "1");
      }
    } else {
      setEnabled(false);
      localStorage.setItem("lattice-notifications-enabled", "0");
    }
  }

  return { enabled: enabled, permission: permission, toggle: toggle };
}

export function sendNotification(title: string, body: string, tag?: string, onClick?: () => void): void {
  const allowed = localStorage.getItem("lattice-notifications-enabled") === "1";
  if (!allowed) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  const notification = new Notification(title, {
    body: body,
    icon: "/icons/icon-192.svg",
    tag: tag || "lattice",
    silent: false,
  });

  const timer = setTimeout(function () {
    notification.close();
  }, 10000);

  notification.onclick = function () {
    clearTimeout(timer);
    window.focus();
    notification.close();
    if (onClick) onClick();
  };
}
