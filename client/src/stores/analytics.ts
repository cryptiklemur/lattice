import { Store } from "@tanstack/react-store";
import type { AnalyticsPayload, AnalyticsPeriod, AnalyticsScope } from "@lattice/shared";

export interface AnalyticsState {
  data: AnalyticsPayload | null;
  loading: boolean;
  error: string | null;
  period: AnalyticsPeriod;
  scope: AnalyticsScope;
  projectSlug: string | null;
}

var analyticsStore = new Store<AnalyticsState>({
  data: null,
  loading: false,
  error: null,
  period: "7d",
  scope: "global",
  projectSlug: null,
});

export function getAnalyticsStore(): Store<AnalyticsState> {
  return analyticsStore;
}

export function setAnalyticsData(data: AnalyticsPayload): void {
  analyticsStore.setState(function (state) {
    return { ...state, data: data, loading: false, error: null };
  });
}

export function setAnalyticsLoading(loading: boolean): void {
  analyticsStore.setState(function (state) {
    return { ...state, loading: loading };
  });
}

export function setAnalyticsError(error: string): void {
  analyticsStore.setState(function (state) {
    return { ...state, error: error, loading: false };
  });
}

export function setAnalyticsPeriod(period: AnalyticsPeriod): void {
  analyticsStore.setState(function (state) {
    return { ...state, period: period };
  });
}

export function setAnalyticsScope(scope: AnalyticsScope, projectSlug?: string): void {
  analyticsStore.setState(function (state) {
    return { ...state, scope: scope, projectSlug: projectSlug || null };
  });
}
