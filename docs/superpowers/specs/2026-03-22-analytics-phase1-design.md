# Analytics Phase 1+2: Data Layer + Cost Visualizations

## Overview

Add a full analytics system to Lattice with:
- **Server-side analytics aggregation** — parse session JSONL files, compute metrics, cache results
- **Dashboard quick stats row** — sparkline cards for cost, sessions, tokens, cache rate
- **Analytics sidebar tab** — dedicated full-page analytics view with time period selector
- **5 cost visualizations** — stacked area, cumulative line, donut breakdown, distribution curve, session bubble chart

## Phasing Context

This is Phase 1+2 of a 6-phase analytics rollout. This phase builds the data layer and cost charts. Future phases add: token/performance charts (Phase 3), activity/pattern charts (Phase 4), tool/project charts (Phase 5), fleet overview (Phase 6). The data layer built here must support all future phases.

## Architecture

### Data Flow

```
JSONL session files (~/.claude/projects/{hash}/{sessionId}.jsonl)
  → Server analytics handler parses + aggregates
  → In-memory cache with TTL (5 min)
  → WebSocket: client requests analytics → server responds with computed data
  → Client renders with Recharts
```

### Server-Side Analytics Engine

New file: `server/src/analytics/engine.ts`

Responsibilities:
- Parse all session JSONL files directly using `Bun.file()` + line splitting (NOT via SDK utilities — too slow for bulk reads)
- Extract per-message metrics from `assistant`-type JSONL lines: `message.usage.input_tokens`, `message.usage.output_tokens`, `message.usage.cache_read_input_tokens`, `message.usage.cache_creation_input_tokens`, `message.model`
- **Compute cost at parse time** using the same `estimateCost()` logic from `server/src/project/session.ts` (import and reuse it). Cost is NOT stored in JSONL — it must be computed from token counts + model pricing. The pricing cache is async-loaded from LiteLLM; the engine must await pricing readiness before computing.
- Aggregate into time-bucketed summaries (hourly, daily, weekly)
- Cache results in memory with 5-minute TTL
- Accept `forceRefresh` flag to invalidate cache on demand (client sends this after `chat:done`)
- Known limitation: during active sessions, stats may be stale until the session completes or the cache TTL expires

**Computed Metrics:**

Per-session:
- `totalCost` — sum of all costEstimate values
- `totalInputTokens`, `totalOutputTokens`, `totalCacheReadTokens`, `totalCacheCreationTokens`
- `duration` — last message timestamp - first message timestamp
- `messageCount` — total messages
- `toolCalls` — Map of tool name → count
- `model` — primary model used (most frequent)
- `startedAt`, `endedAt` — first/last timestamp

Aggregated (across sessions):
- `costByDay` — Array of `{ date, cost, costByModel: { opus, sonnet, haiku } }`
- `cumulativeCost` — running total array
- `costDistribution` — histogram buckets for session cost distribution
- `sessionsByDay` — session counts per day
- `tokensByDay` — token counts per day (input, output, cache)
- `cacheHitRate` — `cacheReadTokens / (inputTokens + cacheReadTokens)` per day
- `modelUsage` — `{ model: { sessions, cost, tokens } }`
- `toolUsage` — `{ tool: { count, avgCostPerCall } }`
- `projectBreakdown` — per-project cost, sessions, tokens

### WebSocket Messages

```typescript
// Client → Server
interface AnalyticsRequestMessage {
  type: "analytics:request";
  requestId: string;
  scope: "global" | "project" | "session";
  projectSlug?: string;
  sessionId?: string;
  period: "24h" | "7d" | "30d" | "90d" | "all";
  forceRefresh?: boolean;
}

// Server → Client
interface AnalyticsDataMessage {
  type: "analytics:data";
  requestId: string;
  scope: "global" | "project" | "session";
  period: "24h" | "7d" | "30d" | "90d" | "all";
  data: AnalyticsPayload;
}
```

**AnalyticsPayload shape:**

```typescript
interface AnalyticsPayload {
  // Summary stats
  totalCost: number;
  totalSessions: number;
  totalTokens: { input: number; output: number; cacheRead: number; cacheCreation: number };
  cacheHitRate: number;
  avgSessionCost: number;
  avgSessionDuration: number;

  // Time series (for charts)
  costOverTime: Array<{ date: string; total: number; opus: number; sonnet: number; haiku: number; other: number }>;
  cumulativeCost: Array<{ date: string; total: number }>;
  sessionsOverTime: Array<{ date: string; count: number }>;
  tokensOverTime: Array<{ date: string; input: number; output: number; cacheRead: number }>;
  cacheHitRateOverTime: Array<{ date: string; rate: number }>;

  // Distributions
  costDistribution: Array<{ bucket: string; count: number }>;
  sessionBubbles: Array<{ id: string; title: string; cost: number; tokens: number; timestamp: number; project: string }>;

  // Breakdowns
  modelUsage: Array<{ model: string; sessions: number; cost: number; tokens: number; percentage: number }>;
  projectBreakdown: Array<{ project: string; cost: number; sessions: number; tokens: number }>;
  toolUsage: Array<{ tool: string; count: number; avgCost: number }>;
}
```

### Model Bucketing

Model IDs from JSONL are versioned strings like `claude-opus-4-6`, `claude-sonnet-4-5-20250514`, `claude-3-5-haiku-20241022`. The engine must bucket them:

```typescript
function bucketModel(model: string): "opus" | "sonnet" | "haiku" | "other" {
  if (model.includes("opus")) return "opus";
  if (model.includes("haiku")) return "haiku";
  if (model.includes("sonnet")) return "sonnet";
  return "other";
}
```

Charts must render a fourth area/segment for "other" to avoid silent data loss. If "other" is empty, it simply doesn't appear.

### Error Response

```typescript
interface AnalyticsErrorMessage {
  type: "analytics:error";
  scope: "global" | "project" | "session";
  message: string;
}
```

Add to `ServerMessage` union. The `useAnalytics` hook sets `error` state on receipt and clears `loading`.

### Session Scope Behavior

For `scope: "session"`, the full `AnalyticsPayload` is returned with zeroed/empty aggregate fields. Only per-session metrics are populated. This keeps the interface simple — the client ignores empty charts.

### Duration Exclusion

Sessions where `startedAt === 0 || endedAt === 0` (missing timestamps) are excluded from `avgSessionDuration`. Duration unit is milliseconds.

### Session Bubbles Cap

`sessionBubbles` is capped at 200 entries, sorted by most recent. For `period: "all"` with many sessions, only the 200 most recent are included.

### Client-Side Components

**Dashboard Quick Stats** — `client/src/components/analytics/QuickStats.tsx`
- 4 compact cards in a row: Cost (period), Sessions, Tokens, Cache Hit Rate
- Each has a sparkline (tiny line chart via Recharts) and delta vs previous period
- Fetches analytics data on mount, re-fetches on period change

**Analytics View** — `client/src/components/analytics/AnalyticsView.tsx`
- Full-page view rendered when Analytics tab is selected in sidebar
- Time period selector (24h / 7d / 30d / 90d / All)
- Scope selector (All Projects / specific project)
- Grid layout for chart cards

**Chart Components** (each in its own file):

1. **CostAreaChart** — `components/analytics/charts/CostAreaChart.tsx`
   - Stacked area chart (Recharts `<AreaChart>`)
   - 3 stacked areas: Opus (purple), Sonnet (blue), Haiku (green)
   - X-axis: dates, Y-axis: cost in dollars
   - Tooltip shows breakdown per model on hover
   - Responsive, fills container width

2. **CumulativeCostChart** — `components/analytics/charts/CumulativeCostChart.tsx`
   - Single line chart (Recharts `<LineChart>`)
   - Monotonically increasing line showing running total
   - Gradient fill below the line
   - Tooltip shows total at that point

3. **CostDonutChart** — `components/analytics/charts/CostDonutChart.tsx`
   - Ring chart (Recharts `<PieChart>` with `innerRadius`)
   - Center text shows total cost
   - Segments colored by model (or project, toggleable)
   - Legend below with percentage + dollar amount
   - Toggle buttons: "By Model" / "By Project"

4. **CostDistributionChart** — `components/analytics/charts/CostDistributionChart.tsx`
   - Smooth area curve (Recharts `<AreaChart>` with `type="monotone"`)
   - X-axis: cost buckets ($0-0.01, $0.01-0.05, $0.05-0.10, etc.)
   - Y-axis: session count
   - Vertical reference lines for p50, p90, p99

5. **SessionBubbleChart** — `components/analytics/charts/SessionBubbleChart.tsx`
   - Scatter chart (Recharts `<ScatterChart>`)
   - X-axis: timestamp, Y-axis: token count
   - Bubble size: cost, Bubble color: project
   - Tooltip shows session title, cost, tokens

### Analytics Store

New file: `client/src/stores/analytics.ts`

```typescript
interface AnalyticsState {
  data: AnalyticsPayload | null;
  loading: boolean;
  error: string | null;
  period: "24h" | "7d" | "30d" | "90d" | "all";
  scope: "global" | "project";
  projectSlug: string | null;
}
```

### Hook: useAnalytics

New file: `client/src/hooks/useAnalytics.ts`

- Subscribes to `analytics:data` WebSocket messages
- Sends `analytics:request` when period/scope changes
- Returns `{ data, loading, error, period, setPeriod, scope, setScope }`

## New Files

| File | Purpose |
|------|---------|
| `server/src/analytics/engine.ts` | Parse JSONL, compute metrics, cache results |
| `server/src/handlers/analytics.ts` | WebSocket handler for analytics:request/data |
| `client/src/stores/analytics.ts` | Analytics state store |
| `client/src/hooks/useAnalytics.ts` | Analytics data fetching hook |
| `client/src/components/analytics/QuickStats.tsx` | Dashboard sparkline cards |
| `client/src/components/analytics/AnalyticsView.tsx` | Full analytics page with layout |
| `client/src/components/analytics/PeriodSelector.tsx` | Time period toggle buttons |
| `client/src/components/analytics/charts/CostAreaChart.tsx` | Stacked area by model |
| `client/src/components/analytics/charts/CumulativeCostChart.tsx` | Running total line |
| `client/src/components/analytics/charts/CostDonutChart.tsx` | Ring chart breakdown |
| `client/src/components/analytics/charts/CostDistributionChart.tsx` | Cost histogram curve |
| `client/src/components/analytics/charts/SessionBubbleChart.tsx` | Session scatter/bubble |

## Modified Files

| File | Changes |
|------|---------|
| `shared/src/models.ts` | Add AnalyticsPayload interface and related types |
| `shared/src/messages.ts` | Add AnalyticsRequestMessage to ClientMessage, AnalyticsDataMessage + AnalyticsErrorMessage to ServerMessage |
| `server/src/daemon.ts` | Import analytics handler |
| `client/src/router.tsx` | Add Analytics route/tab |
| `client/src/components/chat/ChatView.tsx` or sidebar | Add Analytics nav item |

## Charting Library

Install `recharts` in the client package:
```bash
bun add recharts --cwd client
```

Recharts components used:
- `AreaChart`, `Area` — for stacked cost and distribution
- `LineChart`, `Line` — for cumulative cost
- `PieChart`, `Pie`, `Cell` — for donut
- `ScatterChart`, `Scatter` — for bubble chart
- `ResponsiveContainer` — for responsive sizing
- `Tooltip`, `Legend`, `XAxis`, `YAxis` — axes and interaction

## Chart Styling

All charts follow the Lattice design system:
- Dark background: transparent (inherits from card `bg-base-300/60`)
- Grid lines: `oklch(from var(--color-base-content) l c h / 0.06)`
- Axis text: `oklch(from var(--color-base-content) l c h / 0.3)`, 10px, monospace
- Tooltip: `bg-base-300` with `border border-base-content/10`, monospace text
- Colors: use OKLCH theme variables, NOT hardcoded hex
  - Primary (Sonnet): `oklch(from var(--color-primary) l c h)`
  - Purple (Opus): `oklch(55% 0.2 310)`
  - Green (Haiku): `oklch(70% 0.2 150)`
  - Amber (warning): `oklch(80% 0.2 85)`

## Chart Card Component

Each chart sits in a standardized card:

```
┌──────────────────────────────────────┐
│ CHART TITLE              [?] [⤢]    │  ← monospace uppercase header
├──────────────────────────────────────┤
│                                      │
│         [Chart Content]              │  ← Recharts component
│                                      │
└──────────────────────────────────────┘
```

- `rounded-xl border border-base-content/8 bg-base-300/50`
- Header: `px-4 py-2.5 border-b border-base-content/5`
- Title: `text-[10px] font-mono font-bold uppercase tracking-widest text-base-content/35`
- Optional info icon and fullscreen toggle
- Chart area: `px-4 py-4` with `<ResponsiveContainer width="100%" height={200}>`

## Analytics Page Layout

```
┌─────────────────────────────────────────────┐
│ ANALYTICS          [All Projects ▼] [7d ▼]  │
├─────────────────────────────────────────────┤
│ [Cost] [Sessions] [Tokens] [Cache]          │  ← QuickStats row
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ COST OVER TIME (stacked area)           │ │  ← full width
│ └─────────────────────────────────────────┘ │
│ ┌──────────────────┐ ┌────────────────────┐ │
│ │ COST BREAKDOWN   │ │ CUMULATIVE COST    │ │  ← 2-column
│ │ (donut)          │ │ (line)             │ │
│ └──────────────────┘ └────────────────────┘ │
│ ┌──────────────────┐ ┌────────────────────┐ │
│ │ COST DIST.       │ │ SESSION BUBBLES    │ │  ← 2-column
│ │ (histogram)      │ │ (scatter)          │ │
│ └──────────────────┘ └────────────────────┘ │
└─────────────────────────────────────────────┘
```

Responsive: 2-column → 1-column on mobile.

## Error Handling

- **No data**: Show empty state with "No analytics data yet" message
- **Loading**: Skeleton shimmer on chart cards
- **Parse error**: Skip malformed JSONL lines, log warning, continue
- **Large datasets**: Downsample to max 365 data points per chart for performance

## Accessibility

- Charts have `aria-label` describing the data
- Tooltips accessible via keyboard focus
- Color is not the only differentiator — patterns/labels available
- Sparkline cards use `role="img"` with descriptive `aria-label`
- Period selector uses `role="radiogroup"` with `role="radio"` items
