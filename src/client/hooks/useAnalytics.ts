import { useCallback, useEffect, useRef } from "react";
import { useStore } from "@tanstack/react-store";
import { useWebSocket } from "./useWebSocket";
import type { ServerMessage } from "#shared";
import type { AnalyticsPeriod, AnalyticsScope, AnalyticsSectionName } from "#shared";
import type { AnalyticsPayload } from "#shared";
import {
  getAnalyticsStore,
  mergeAnalyticsSection,
  clearAnalyticsForRequest,
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

  var requestAnalytics = useCallback(function (forceRefresh?: boolean) {
    var s = getAnalyticsStore().state;
    clearAnalyticsForRequest();
    sendRef.current({
      type: "analytics:request",
      requestId: crypto.randomUUID(),
      scope: s.scope,
      projectSlug: s.projectSlug || undefined,
      period: s.period,
      forceRefresh: forceRefresh,
    } as any);
  }, []);

  useEffect(function () {
    function handleSection(msg: ServerMessage) {
      var m = msg as { type: string; section: AnalyticsSectionName; data: Partial<AnalyticsPayload> };
      mergeAnalyticsSection(m.section, m.data);
    }

    function handleComplete() {
      setAnalyticsLoading(false);
    }

    function handleError(msg: ServerMessage) {
      var m = msg as { type: string; message: string };
      setAnalyticsError(m.message);
    }

    subscribe("analytics:section", handleSection);
    subscribe("analytics:complete", handleComplete);
    subscribe("analytics:error", handleError);

    return function () {
      unsubscribe("analytics:section", handleSection);
      unsubscribe("analytics:complete", handleComplete);
      unsubscribe("analytics:error", handleError);
    };
  }, [subscribe, unsubscribe]);

  useEffect(function () {
    requestAnalytics();
  }, [state.period, state.scope, state.projectSlug, requestAnalytics]);

  return {
    data: state.data,
    loadedSections: state.loadedSections,
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
