import { Store } from "@tanstack/react-store";
import type { AnalyticsPayload, AnalyticsPeriod, AnalyticsScope, AnalyticsSectionName } from "#shared";

export interface AnalyticsState {
  data: Partial<AnalyticsPayload>;
  loadedSections: AnalyticsSectionName[];
  loading: boolean;
  error: string | null;
  period: AnalyticsPeriod;
  scope: AnalyticsScope;
  projectSlug: string | null;
}

const analyticsStore = new Store<AnalyticsState>({
  data: {},
  loadedSections: [],
  loading: false,
  error: null,
  period: "30d",
  scope: "global",
  projectSlug: null,
});

export function getAnalyticsStore(): Store<AnalyticsState> {
  return analyticsStore;
}

export function mergeAnalyticsSection(section: AnalyticsSectionName, sectionData: Partial<AnalyticsPayload>): void {
  analyticsStore.setState(function (state) {
    return {
      ...state,
      data: { ...state.data, ...sectionData },
      loadedSections: state.loadedSections.includes(section)
        ? state.loadedSections
        : [...state.loadedSections, section],
    };
  });
}

export function clearAnalyticsForRequest(): void {
  analyticsStore.setState(function (state) {
    return { ...state, data: {}, loadedSections: [], loading: true, error: null };
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
