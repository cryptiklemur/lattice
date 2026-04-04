import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  var rawData = window.atob(base64);
  var outputArray = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushStatus = "unsupported" | "denied" | "prompt" | "subscribed" | "unsubscribed";

export function usePushNotifications() {
  var [status, setStatus] = useState<PushStatus>("unsupported");

  useEffect(function () {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    navigator.serviceWorker.getRegistration("/sw-push.js").then(function (reg) {
      if (!reg) {
        setStatus("unsubscribed");
        return;
      }
      reg.pushManager.getSubscription().then(function (sub) {
        setStatus(sub ? "subscribed" : "unsubscribed");
      });
    });
  }, []);

  async function subscribe(): Promise<boolean> {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

    try {
      var permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return false;
      }

      var reg = await navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      var response = await fetch("/api/vapid-public-key");
      var data = await response.json() as { publicKey: string };

      var subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey) as BufferSource,
      });

      await fetch("/api/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      setStatus("subscribed");
      return true;
    } catch (err) {
      console.error("Push subscription failed:", err);
      return false;
    }
  }

  async function unsubscribe(): Promise<void> {
    try {
      var reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
      if (reg) {
        var sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
        }
      }
      setStatus("unsubscribed");
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    }
  }

  return { status, subscribe, unsubscribe };
}
