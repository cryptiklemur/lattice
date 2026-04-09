import { useWebSocket } from "./useWebSocket";

export function useOnline(): boolean {
  const ws = useWebSocket();
  return ws.status === "connected";
}
