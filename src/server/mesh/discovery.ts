import BonjourImport from "bonjour-service";
import type { Service, Browser } from "bonjour-service";

const Bonjour = (typeof BonjourImport === "function" ? BonjourImport : (BonjourImport as any).default) as typeof BonjourImport;

export interface DiscoveredNode {
  nodeId: string;
  name: string;
  address: string;
  port: number;
  discoveredAt: number;
}

let bonjour: InstanceType<typeof Bonjour> | null = null;
let publishedService: Service | null = null;
let browser: Browser | null = null;
const discoveredNodes: Map<string, DiscoveredNode> = new Map();
const discoveredCallbacks: Array<(node: DiscoveredNode) => void> = [];
const lostCallbacks: Array<(nodeId: string) => void> = [];

export function startDiscovery(nodeId: string, name: string, port: number): void {
  if (bonjour !== null) {
    return;
  }

  bonjour = new Bonjour();

  publishedService = bonjour.publish({
    name: name,
    type: "lattice",
    port: port,
    protocol: "tcp",
    probe: false,
    txt: {
      nodeId: nodeId,
      name: name,
    },
  });

  console.log(`[discovery] Published _lattice._tcp as "${name}" on port ${port}`);

  browser = bonjour.find(
    { type: "lattice", protocol: "tcp" },
    function (service: Service) {
      const txt = service.txt as Record<string, string> | undefined;
      if (!txt || !txt.nodeId) {
        return;
      }
      if (txt.nodeId === nodeId) {
        return;
      }

      const address = service.addresses && service.addresses.length > 0
        ? service.addresses[0]
        : (service.referer ? service.referer.address : "");

      if (!address) {
        return;
      }

      const node: DiscoveredNode = {
        nodeId: txt.nodeId,
        name: txt.name || service.name,
        address: address,
        port: service.port,
        discoveredAt: Date.now(),
      };

      discoveredNodes.set(node.nodeId, node);
      console.log(`[discovery] Found node: ${node.name} (${node.nodeId}) at ${node.address}:${node.port}`);

      for (let i = 0; i < discoveredCallbacks.length; i++) {
        discoveredCallbacks[i](node);
      }
    }
  );

  browser.on("down", function (service: Service) {
    const txt = service.txt as Record<string, string> | undefined;
    if (!txt || !txt.nodeId) {
      return;
    }
    const lostId = txt.nodeId;
    if (!discoveredNodes.has(lostId)) {
      return;
    }
    discoveredNodes.delete(lostId);
    console.log(`[discovery] Lost node: ${lostId}`);

    for (let i = 0; i < lostCallbacks.length; i++) {
      lostCallbacks[i](lostId);
    }
  });

  browser.start();
}

export function stopDiscovery(): void {
  if (browser !== null) {
    browser.stop();
    browser = null;
  }
  if (bonjour !== null) {
    bonjour.unpublishAll(function () {
      if (bonjour !== null) {
        bonjour.destroy();
        bonjour = null;
      }
    });
    publishedService = null;
  }
  discoveredNodes.clear();
  console.log("[discovery] Stopped");
}

export function getDiscoveredNodes(): DiscoveredNode[] {
  return Array.from(discoveredNodes.values());
}

export function onNodeDiscovered(callback: (node: DiscoveredNode) => void): void {
  discoveredCallbacks.push(callback);
}

export function onNodeLost(callback: (nodeId: string) => void): void {
  lostCallbacks.push(callback);
}
