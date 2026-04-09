import webpush from "web-push";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getLatticeHome } from "./config";
import { log } from "./logger";

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

let vapidKeys: VapidKeys | null = null;
const subscriptions = new Map<string, PushSubscription>();

function getVapidPath(): string {
  return join(getLatticeHome(), "vapid.json");
}

function getSubscriptionsPath(): string {
  return join(getLatticeHome(), "push-subs.json");
}

function ensureVapidKeys(): VapidKeys {
  if (vapidKeys) return vapidKeys;

  const vapidPath = getVapidPath();
  if (existsSync(vapidPath)) {
    try {
      vapidKeys = JSON.parse(readFileSync(vapidPath, "utf-8"));
      if (vapidKeys) return vapidKeys;
    } catch {}
  }

  const generated = webpush.generateVAPIDKeys();
  vapidKeys = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
  };

  const dir = getLatticeHome();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(vapidPath, JSON.stringify(vapidKeys, null, 2), "utf-8");
  log.server("Generated VAPID keys for push notifications");
  return vapidKeys;
}

function loadSubscriptions(): void {
  const subsPath = getSubscriptionsPath();
  if (!existsSync(subsPath)) return;
  try {
    const data = JSON.parse(readFileSync(subsPath, "utf-8")) as PushSubscription[];
    for (let i = 0; i < data.length; i++) {
      subscriptions.set(data[i].endpoint, data[i]);
    }
  } catch {}
}

function saveSubscriptions(): void {
  const arr: PushSubscription[] = [];
  subscriptions.forEach(function (sub) {
    arr.push(sub);
  });
  writeFileSync(getSubscriptionsPath(), JSON.stringify(arr), "utf-8");
}

export function initPush(): void {
  const keys = ensureVapidKeys();
  webpush.setVapidDetails(
    "mailto:lattice@localhost",
    keys.publicKey,
    keys.privateKey,
  );
  loadSubscriptions();
  log.server("Push notifications ready (%d subscription(s))", subscriptions.size);
}

export function getVapidPublicKey(): string {
  return ensureVapidKeys().publicKey;
}

export function addPushSubscription(sub: PushSubscription): void {
  subscriptions.set(sub.endpoint, sub);
  saveSubscriptions();
}

export function removePushSubscription(endpoint: string): void {
  subscriptions.delete(endpoint);
  saveSubscriptions();
}

export interface PushPayload {
  type: "done" | "permission_request" | "elicitation" | "error";
  title: string;
  body: string;
  sessionId?: string;
  projectSlug?: string;
}

export function sendPush(payload: PushPayload): void {
  if (subscriptions.size === 0) return;

  const json = JSON.stringify(payload);
  subscriptions.forEach(function (sub, endpoint) {
    webpush.sendNotification(sub, json).catch(function (err: { statusCode?: number }) {
      if (err.statusCode === 410 || err.statusCode === 404 || err.statusCode === 403) {
        subscriptions.delete(endpoint);
        saveSubscriptions();
      }
    });
  });
}
