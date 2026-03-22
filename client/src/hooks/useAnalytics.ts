import { useEffect, useRef } from "react";
import { useStore } from "@tanstack/react-store";
import { useWebSocket } from "./useWebSocket";
import type { ServerMessage } from "@lattice/shared";
import type { AnalyticsPeriod, AnalyticsScope } from "@lattice/shared";
import {
  getAnalyticsStore,
  setAnalyticsData,
  setAnalyticsLoading,
  setAnalyticsError,
  setAnalyticsPeriod,
  setAnalyticsScope,
} from "../stores/analytics";
import type { AnalyticsState } from "../stores/analytics";

export function useAnalytics(): AnalyticsState & {
  setPeriod: (period: AnalyticsPeriod) => void;
  setScope: (scope: AnalyticsScope, projectSlug?: string) => void;
  refresh: () => void;
} {
  var store = getAnalyticsStore();
  var state = useStore(store, function (s) { return s; });
  var { send, subscribe, unsubscribe } = useWebSocket();
  var sendRef = useRef(send);
  sendRef.current = send;

  function requestAnalytics(forceRefresh?: boolean) {
    var s = getAnalyticsStore().state;
    setAnalyticsLoading(true);
    sendRef.current({
      type: "analytics:request",
      requestId: crypto.randomUUID(),
      scope: s.scope,
      projectSlug: s.projectSlug || undefined,
      period: s.period,
      forceRefresh: forceRefresh,
    } as any);
  }

  useEffect(function () {
    function handleData(msg: ServerMessage) {
      var m = msg as { type: string; data: any };
      setAnalyticsData(m.data);
    }

    function handleError(msg: ServerMessage) {
      var m = msg as { type: string; message: string };
      setAnalyticsError(m.message);
    }

    subscribe("analytics:data", handleData);
    subscribe("analytics:error", handleError);

    return function () {
      unsubscribe("analytics:data", handleData);
      unsubscribe("analytics:error", handleError);
    };
  }, [subscribe, unsubscribe]);

  useEffect(function () {
    requestAnalytics();
  }, [state.period, state.scope, state.projectSlug]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    period: state.period,
    scope: state.scope,
    projectSlug: state.projectSlug,
    setPeriod: setAnalyticsPeriod,
    setScope: setAnalyticsScope,
    refresh: function () { requestAnalytics(true); },
  };
}
