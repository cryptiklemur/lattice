import { useWebSocket } from "./useWebSocket";

export function useOnline(): boolean {
  var ws = useWebSocket();
  return ws.status === "connected";
}
