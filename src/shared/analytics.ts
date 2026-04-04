export interface AnalyticsPayload {
  totalCost: number;
  totalSessions: number;
  totalTokens: { input: number; output: number; cacheRead: number; cacheCreation: number };
  cacheHitRate: number;
  avgSessionCost: number;
  avgSessionDuration: number;

  costOverTime: Array<{ date: string; total: number; opus: number; sonnet: number; haiku: number; other: number }>;
  cumulativeCost: Array<{ date: string; total: number }>;
  sessionsOverTime: Array<{ date: string; count: number }>;
  tokensOverTime: Array<{ date: string; input: number; output: number; cacheRead: number }>;
  cacheHitRateOverTime: Array<{ date: string; rate: number }>;

  costDistribution: Array<{ bucket: string; count: number }>;
  sessionBubbles: Array<{ id: string; title: string; cost: number; tokens: number; timestamp: number; project: string }>;

  modelUsage: Array<{ model: string; sessions: number; cost: number; tokens: number; percentage: number }>;
  projectBreakdown: Array<{ project: string; cost: number; sessions: number; tokens: number }>;
  toolUsage: Array<{ tool: string; count: number; avgCost: number }>;

  responseTimeData: Array<{ tokens: number; duration: number; model: string; sessionId: string }>;
  contextUtilization: Array<{ messageIndex: number; contextPercent: number; sessionId: string; title: string }>;
  tokenFlowSankey: { nodes: Array<{ name: string }>; links: Array<{ source: number; target: number; value: number }> };

  activityCalendar: Array<{ date: string; count: number; tokens: number; cost: number }>;
  hourlyHeatmap: Array<{ day: number; hour: number; count: number }>;
  sessionTimeline: Array<{ id: string; title: string; project: string; start: number; end: number; cost: number }>;
  dailySummaries: Array<{ date: string; sessions: number; cost: number; tokens: number; topTool: string; modelMix: Record<string, number> }>;

  toolTreemap: Array<{ name: string; count: number; avgCost: number }>;
  toolSunburst: Array<{ name: string; category: string; count: number }>;
  permissionStats: { allowed: number; denied: number; alwaysAllowed: number };
  projectRadar: Array<{ project: string; cost: number; sessions: number; avgDuration: number; toolDiversity: number; tokensPerSession: number }>;
  sessionComplexity: Array<{ id: string; title: string; score: number; messages: number; tools: number; contextPercent: number }>;
}

export type AnalyticsPeriod = "24h" | "7d" | "30d" | "90d" | "all";
export type AnalyticsScope = "global" | "project" | "session";
