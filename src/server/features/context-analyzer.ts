import type { TokenDelta, ToolBaseline } from "#shared";

interface UsageSnapshot {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

function snapshotTotal(s: UsageSnapshot): number {
  return s.inputTokens + s.outputTokens + s.cacheReadTokens + s.cacheCreationTokens;
}

function diffSnapshots(before: UsageSnapshot, after: UsageSnapshot): TokenDelta {
  const input = after.inputTokens - before.inputTokens;
  const output = after.outputTokens - before.outputTokens;
  const cacheRead = after.cacheReadTokens - before.cacheReadTokens;
  const cacheCreation = after.cacheCreationTokens - before.cacheCreationTokens;
  return {
    inputTokens: Math.max(0, input),
    outputTokens: Math.max(0, output),
    cacheReadTokens: Math.max(0, cacheRead),
    cacheCreationTokens: Math.max(0, cacheCreation),
    total: Math.max(0, input + output + cacheRead + cacheCreation),
  };
}

const ROLLING_WINDOW = 20;
const MIN_STDDEV = 100;
const ANOMALY_THRESHOLD = 2.0;
const ANOMALY_COOLDOWN_MS = 30_000;
const MIN_SAMPLES_FOR_ANOMALY = 3;

interface BaselineState {
  samples: number[];
  count: number;
  mean: number;
  m2: number;
  min: number;
  max: number;
}

function createBaselineState(): BaselineState {
  return { samples: [], count: 0, mean: 0, m2: 0, min: Infinity, max: -Infinity };
}

function addSample(state: BaselineState, value: number): void {
  state.samples.push(value);
  if (state.samples.length > ROLLING_WINDOW) {
    state.samples.shift();
    recomputeFromSamples(state);
    return;
  }
  state.count = state.samples.length;
  const delta = value - state.mean;
  state.mean += delta / state.count;
  const delta2 = value - state.mean;
  state.m2 += delta * delta2;
  state.min = Math.min(state.min, value);
  state.max = Math.max(state.max, value);
}

function recomputeFromSamples(state: BaselineState): void {
  const arr = state.samples;
  state.count = arr.length;
  if (state.count === 0) {
    state.mean = 0;
    state.m2 = 0;
    state.min = Infinity;
    state.max = -Infinity;
    return;
  }
  let mean = 0;
  let m2 = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    const x = arr[i];
    const n = i + 1;
    const d = x - mean;
    mean += d / n;
    const d2 = x - mean;
    m2 += d * d2;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  state.mean = mean;
  state.m2 = m2;
  state.min = min;
  state.max = max;
}

function getStddev(state: BaselineState): number {
  if (state.count < 2) return 0;
  return Math.sqrt(state.m2 / state.count);
}

function toBaseline(state: BaselineState): ToolBaseline {
  return {
    count: state.count,
    mean: Math.round(state.mean),
    stddev: Math.round(getStddev(state)),
    min: state.min === Infinity ? 0 : state.min,
    max: state.max === -Infinity ? 0 : state.max,
  };
}

interface PendingTool {
  toolId: string;
  toolName: string;
  snapshot: UsageSnapshot;
  startedAt: number;
}

interface AnomalyResult {
  toolId: string;
  toolName: string;
  observed: number;
  expected: number;
  stddev: number;
  zScore: number;
  timestamp: number;
}

interface BurnRatePoint {
  timestamp: number;
  totalTokens: number;
}

export type AnalyzerCallback = (msg: Record<string, unknown>) => void;

export class ContextAnalyzer {
  private baselines = new Map<string, BaselineState>();
  private pendingTools = new Map<string, PendingTool>();
  private lastCooldown = new Map<string, number>();
  private burnRatePoints: BurnRatePoint[] = [];
  private contextWindow = 0;
  private autocompactAt = 0;
  private lastUsage: UsageSnapshot = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
  private sendCallback: AnalyzerCallback;
  private sessionStartTime: number;

  constructor(sendCallback: AnalyzerCallback) {
    this.sendCallback = sendCallback;
    this.sessionStartTime = Date.now();
  }

  updateUsage(usage: UsageSnapshot, contextWindow?: number): void {
    this.lastUsage = { ...usage };
    if (contextWindow && contextWindow > 0) {
      this.contextWindow = contextWindow;
    }
    this.recordBurnRate(usage);
    this.resolvePendingDeltas(usage);
  }

  updateAutocompact(autocompactAt: number, contextWindow: number): void {
    this.autocompactAt = autocompactAt;
    if (contextWindow > 0) {
      this.contextWindow = contextWindow;
    }
  }

  onToolStart(toolId: string, toolName: string): void {
    this.pendingTools.set(toolId, {
      toolId,
      toolName,
      snapshot: { ...this.lastUsage },
      startedAt: Date.now(),
    });
  }

  onToolResult(toolId: string): void {
    // Tool result arrived; delta will be computed on next usage update
    // The pending tool stays in the map until resolved
  }

  getBaselineStats(): Record<string, ToolBaseline> {
    const result: Record<string, ToolBaseline> = {};
    for (const [name, state] of this.baselines) {
      result[name] = toBaseline(state);
    }
    return result;
  }

  reset(): void {
    this.baselines.clear();
    this.pendingTools.clear();
    this.lastCooldown.clear();
    this.burnRatePoints = [];
    this.lastUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
    this.contextWindow = 0;
    this.autocompactAt = 0;
    this.sessionStartTime = Date.now();
  }

  private resolvePendingDeltas(currentUsage: UsageSnapshot): void {
    if (this.pendingTools.size === 0) return;

    const now = Date.now();
    const resolved: string[] = [];

    for (const [toolId, pending] of this.pendingTools) {
      const delta = diffSnapshots(pending.snapshot, currentUsage);
      if (delta.total === 0) continue;

      resolved.push(toolId);

      this.sendCallback({
        type: "context:tool_delta",
        toolId: pending.toolId,
        toolName: pending.toolName,
        delta,
        timestamp: now,
      });

      let baseline = this.baselines.get(pending.toolName);
      if (!baseline) {
        baseline = createBaselineState();
        this.baselines.set(pending.toolName, baseline);
      }
      addSample(baseline, delta.total);

      const anomaly = this.checkAnomaly(pending.toolId, pending.toolName, delta.total, baseline, now);
      if (anomaly) {
        this.sendCallback({
          type: "context:anomaly",
          ...anomaly,
        });
      }

      this.sendCallback({
        type: "context:baseline_stats",
        tools: this.getBaselineStats(),
      });
    }

    for (const id of resolved) {
      this.pendingTools.delete(id);
    }

    if (resolved.length > 0) {
      this.sendBurnRate();
    }
  }

  private checkAnomaly(toolId: string, toolName: string, observed: number, baseline: BaselineState, now: number): AnomalyResult | null {
    if (baseline.count < MIN_SAMPLES_FOR_ANOMALY) return null;

    const stddev = Math.max(getStddev(baseline), MIN_STDDEV);
    const zScore = (observed - baseline.mean) / stddev;

    if (zScore < ANOMALY_THRESHOLD) return null;

    const lastCooldownTime = this.lastCooldown.get(toolName) || 0;
    if (now - lastCooldownTime < ANOMALY_COOLDOWN_MS) return null;

    this.lastCooldown.set(toolName, now);

    return {
      toolId,
      toolName,
      observed,
      expected: Math.round(baseline.mean),
      stddev: Math.round(stddev),
      zScore: Math.round(zScore * 100) / 100,
      timestamp: now,
    };
  }

  private recordBurnRate(usage: UsageSnapshot): void {
    const total = snapshotTotal(usage);
    const now = Date.now();
    this.burnRatePoints.push({ timestamp: now, totalTokens: total });

    // Keep last 5 minutes of data points
    const cutoff = now - 5 * 60_000;
    while (this.burnRatePoints.length > 1 && this.burnRatePoints[0].timestamp < cutoff) {
      this.burnRatePoints.shift();
    }
  }

  private sendBurnRate(): void {
    if (this.burnRatePoints.length < 2) return;

    const first = this.burnRatePoints[0];
    const last = this.burnRatePoints[this.burnRatePoints.length - 1];
    const elapsedMs = last.timestamp - first.timestamp;
    if (elapsedMs <= 0) return;

    const tokensDelta = last.totalTokens - first.totalTokens;
    const tokensPerMinute = Math.round((tokensDelta / elapsedMs) * 60_000);

    let estimatedSecondsToCompact: number | null = null;
    const threshold = this.autocompactAt > 0 ? this.autocompactAt : Math.round(this.contextWindow * 0.9);
    if (tokensPerMinute > 0 && threshold > 0 && last.totalTokens < threshold) {
      const remaining = threshold - last.totalTokens;
      estimatedSecondsToCompact = Math.round((remaining / tokensPerMinute) * 60);
    }

    this.sendCallback({
      type: "context:burn_rate",
      tokensPerMinute,
      estimatedSecondsToCompact,
      currentUsage: last.totalTokens,
      compactThreshold: threshold,
    });
  }
}
