import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AnalyticsPayload, AnalyticsPeriod, AnalyticsScope, AnalyticsSectionName } from "#shared";
import { estimateCost, projectPathToHash } from "../project/session";
import { loadConfig } from "../config";

interface ResponseTimeDatum {
  tokens: number;
  duration: number;
  model: string;
}

interface ContextMessage {
  messageIndex: number;
  inputTokens: number;
  model: string;
}

interface SessionData {
  id: string;
  title: string;
  project: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  models: Map<string, { cost: number; tokens: number }>;
  tools: Map<string, number>;
  startTime: number;
  endTime: number;
  responseTimePoints: ResponseTimeDatum[];
  contextMessages: ContextMessage[];
}

interface CacheEntry {
  data: AnalyticsPayload;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;
const inflight = new Map<string, Promise<AnalyticsPayload>>();

export const SECTION_KEYS: Record<AnalyticsSectionName, Array<keyof AnalyticsPayload>> = {
  summary: ["totalCost", "totalSessions", "totalTokens", "cacheHitRate", "avgSessionCost", "avgSessionDuration", "costOverTime", "cumulativeCost", "sessionsOverTime", "tokensOverTime", "cacheHitRateOverTime"],
  spending: ["costDistribution", "sessionBubbles", "modelUsage", "projectBreakdown"],
  usage: ["toolUsage", "responseTimeData", "contextUtilization", "tokenFlowSankey"],
  activity: ["activityCalendar", "hourlyHeatmap", "sessionTimeline", "dailySummaries"],
  projects: ["toolTreemap", "toolSunburst", "permissionStats", "projectRadar", "sessionComplexity"],
};

function bucketModel(model: string): "opus" | "sonnet" | "haiku" | "other" {
  if (model.includes("opus")) return "opus";
  if (model.includes("haiku")) return "haiku";
  if (model.includes("sonnet")) return "sonnet";
  return "other";
}

function getPeriodCutoff(period: AnalyticsPeriod): number {
  if (period === "all") return 0;
  const now = Date.now();
  const hours: Record<string, number> = { "24h": 24, "7d": 168, "30d": 720, "90d": 2160 };
  return now - (hours[period] || 0) * 60 * 60 * 1000;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function getCostBucket(cost: number): string | null {
  if (cost <= 0) return null;
  if (cost < 0.01) return "<$0.01";
  if (cost < 0.05) return "$0.01-0.05";
  if (cost < 0.10) return "$0.05-0.10";
  if (cost < 0.50) return "$0.10-0.50";
  if (cost < 1.00) return "$0.50-1.00";
  if (cost < 5.00) return "$1.00-5.00";
  return "$5.00+";
}

function parseSessionText(text: string, sessionId: string, projectSlug: string): SessionData | null {
  try {
    const lines = text.split("\n");
    const data: SessionData = {
      id: sessionId,
      title: "",
      project: projectSlug,
      cost: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      models: new Map(),
      tools: new Map(),
      startTime: 0,
      endTime: 0,
      responseTimePoints: [],
      contextMessages: [],
    };

    let lastUserTimestamp = 0;
    let assistantIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }

      let timestamp = 0;
      if (typeof parsed.timestamp === "string") {
        const ts = new Date(parsed.timestamp as string).getTime();
        if (!isNaN(ts)) timestamp = ts;
      }

      if (timestamp > 0) {
        if (data.startTime === 0 || timestamp < data.startTime) data.startTime = timestamp;
        if (timestamp > data.endTime) data.endTime = timestamp;
      }

      if (parsed.type === "assistant") {
        const message = parsed.message as Record<string, unknown> | undefined;
        if (!message) continue;

        const usage = message.usage as Record<string, number> | undefined;
        const model = (message.model as string) || "";

        if (usage) {
          const inTok = usage.input_tokens || 0;
          const outTok = usage.output_tokens || 0;
          const cacheRead = usage.cache_read_input_tokens || 0;
          const cacheCreation = usage.cache_creation_input_tokens || 0;

          data.inputTokens += inTok;
          data.outputTokens += outTok;
          data.cacheReadTokens += cacheRead;
          data.cacheCreationTokens += cacheCreation;

          const cost = estimateCost(model, inTok, outTok, cacheRead, cacheCreation);
          data.cost += cost;

          const bucket = bucketModel(model);
          const existing = data.models.get(bucket);
          if (existing) {
            existing.cost += cost;
            existing.tokens += inTok + outTok;
          } else {
            data.models.set(bucket, { cost: cost, tokens: inTok + outTok });
          }

          if (outTok > 0 && timestamp > 0 && lastUserTimestamp > 0) {
            const dur = timestamp - lastUserTimestamp;
            if (dur > 0 && dur < 600000) {
              data.responseTimePoints.push({ tokens: outTok, duration: dur, model: bucket });
            }
          }

          data.contextMessages.push({ messageIndex: assistantIndex, inputTokens: inTok + cacheRead + cacheCreation, model: bucket });
          assistantIndex++;
        }

        if (!data.title && message.content) {
          if (typeof message.content === "string" && message.content.length > 0) {
            data.title = message.content.slice(0, 80);
          }
        }
      } else if (parsed.type === "user") {
        if (timestamp > 0) lastUserTimestamp = timestamp;
        const userMsg = parsed.message as Record<string, unknown> | undefined;
        if (!userMsg || !Array.isArray(userMsg.content)) continue;

        const contentArr = userMsg.content as Array<Record<string, unknown>>;
        for (let j = 0; j < contentArr.length; j++) {
          const block = contentArr[j];
          if (block.type === "tool_result" && typeof block.tool_use_id === "string") {
            const toolName = (block.name as string) || "unknown";
            data.tools.set(toolName, (data.tools.get(toolName) || 0) + 1);
          }
        }

        if (!data.title && Array.isArray(userMsg.content)) {
          for (let k = 0; k < contentArr.length; k++) {
            if (contentArr[k].type === "text" && typeof contentArr[k].text === "string") {
              data.title = (contentArr[k].text as string).slice(0, 80);
              break;
            }
          }
        }
      }
    }

    if (!data.title) data.title = "Session " + sessionId.slice(0, 8);

    return data;
  } catch {
    return null;
  }
}

function parseSessionFile(filePath: string, sessionId: string, projectSlug: string): SessionData | null {
  try {
    const text = readFileSync(filePath, "utf-8");
    return parseSessionText(text, sessionId, projectSlug);
  } catch {
    return null;
  }
}

async function parseSessionFileAsync(filePath: string, sessionId: string, projectSlug: string): Promise<SessionData | null> {
  try {
    const text = await readFile(filePath, "utf-8");
    return parseSessionText(text, sessionId, projectSlug);
  } catch {
    return null;
  }
}

function getSessionFilesForProject(projectPath: string, cutoff?: number): Array<{ path: string; id: string }> {
  const hash = projectPathToHash(projectPath);
  const dir = join(homedir(), ".claude", "projects", hash);
  if (!existsSync(dir)) return [];

  const files: Array<{ path: string; id: string }> = [];
  try {
    const entries = readdirSync(dir);
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].endsWith(".jsonl")) continue;
      const filePath = join(dir, entries[i]);
      if (cutoff && cutoff > 0) {
        try {
          const mtime = statSync(filePath).mtimeMs;
          if (mtime < cutoff) continue;
        } catch {
          // include if stat fails
        }
      }
      files.push({ path: filePath, id: entries[i].replace(".jsonl", "") });
    }
  } catch {
    return [];
  }
  return files;
}

function aggregate(sessions: SessionData[], period: AnalyticsPeriod): AnalyticsPayload {
  const cutoff = getPeriodCutoff(period);
  const filtered: SessionData[] = [];
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const sessionTime = s.endTime > 0 ? s.endTime : s.startTime;
    if (sessionTime >= cutoff) filtered.push(s);
  }

  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalCacheCreation = 0;
  let totalDuration = 0;
  let durationCount = 0;

  const dailyCost = new Map<string, { total: number; opus: number; sonnet: number; haiku: number; other: number }>();
  const dailySessions = new Map<string, number>();
  const dailyTokens = new Map<string, { input: number; output: number; cacheRead: number }>();
  const dailyCacheHit = new Map<string, { cacheRead: number; totalInput: number }>();

  const modelStats = new Map<string, { sessions: number; cost: number; tokens: number }>();
  const projectStats = new Map<string, { cost: number; sessions: number; tokens: number }>();
  const toolStats = new Map<string, { count: number; totalCost: number; sessions: number }>();

  const costBuckets = new Map<string, number>();
  const bucketOrder = ["<$0.01", "$0.01-0.05", "$0.05-0.10", "$0.10-0.50", "$0.50-1.00", "$1.00-5.00", "$5.00+"];
  for (let b = 0; b < bucketOrder.length; b++) {
    costBuckets.set(bucketOrder[b], 0);
  }

  for (let si = 0; si < filtered.length; si++) {
    const sess = filtered[si];
    totalCost += sess.cost;
    totalInput += sess.inputTokens;
    totalOutput += sess.outputTokens;
    totalCacheRead += sess.cacheReadTokens;
    totalCacheCreation += sess.cacheCreationTokens;

    if (sess.startTime > 0 && sess.endTime > 0 && sess.endTime > sess.startTime) {
      totalDuration += sess.endTime - sess.startTime;
      durationCount++;
    }

    const date = formatDate(sess.endTime > 0 ? sess.endTime : sess.startTime);

    let dc = dailyCost.get(date);
    if (!dc) {
      dc = { total: 0, opus: 0, sonnet: 0, haiku: 0, other: 0 };
      dailyCost.set(date, dc);
    }
    dc.total += sess.cost;
    sess.models.forEach(function (val, key) {
      dc![key as "opus" | "sonnet" | "haiku" | "other"] += val.cost;
    });

    dailySessions.set(date, (dailySessions.get(date) || 0) + 1);

    let dt = dailyTokens.get(date);
    if (!dt) {
      dt = { input: 0, output: 0, cacheRead: 0 };
      dailyTokens.set(date, dt);
    }
    dt.input += sess.inputTokens;
    dt.output += sess.outputTokens;
    dt.cacheRead += sess.cacheReadTokens;

    let dch = dailyCacheHit.get(date);
    if (!dch) {
      dch = { cacheRead: 0, totalInput: 0 };
      dailyCacheHit.set(date, dch);
    }
    dch.cacheRead += sess.cacheReadTokens;
    dch.totalInput += sess.inputTokens;

    sess.models.forEach(function (val, key) {
      let ms = modelStats.get(key);
      if (!ms) {
        ms = { sessions: 0, cost: 0, tokens: 0 };
        modelStats.set(key, ms);
      }
      ms.sessions++;
      ms.cost += val.cost;
      ms.tokens += val.tokens;
    });

    let ps = projectStats.get(sess.project);
    if (!ps) {
      ps = { cost: 0, sessions: 0, tokens: 0 };
      projectStats.set(sess.project, ps);
    }
    ps.cost += sess.cost;
    ps.sessions++;
    ps.tokens += sess.inputTokens + sess.outputTokens;

    sess.tools.forEach(function (count, tool) {
      let ts = toolStats.get(tool);
      if (!ts) {
        ts = { count: 0, totalCost: 0, sessions: 0 };
        toolStats.set(tool, ts);
      }
      ts.count += count;
      ts.totalCost += sess.cost;
      ts.sessions++;
    });

    const bucket = getCostBucket(sess.cost);
    if (bucket) {
      costBuckets.set(bucket, (costBuckets.get(bucket) || 0) + 1);
    }
  }

  const totalTokensAll = totalInput + totalOutput + totalCacheRead + totalCacheCreation;
  const cacheHitRate = (totalInput + totalCacheRead) > 0 ? totalCacheRead / (totalInput + totalCacheRead) : 0;

  const dates = Array.from(dailyCost.keys()).sort();

  const costOverTime: AnalyticsPayload["costOverTime"] = [];
  const cumulativeCost: AnalyticsPayload["cumulativeCost"] = [];
  const sessionsOverTime: AnalyticsPayload["sessionsOverTime"] = [];
  const tokensOverTime: AnalyticsPayload["tokensOverTime"] = [];
  const cacheHitRateOverTime: AnalyticsPayload["cacheHitRateOverTime"] = [];

  let cumTotal = 0;
  for (let di = 0; di < dates.length; di++) {
    const d = dates[di];
    const dcEntry = dailyCost.get(d)!;
    cumTotal += dcEntry.total;

    costOverTime.push({
      date: d,
      total: dcEntry.total,
      opus: dcEntry.opus,
      sonnet: dcEntry.sonnet,
      haiku: dcEntry.haiku,
      other: dcEntry.other,
    });
    cumulativeCost.push({ date: d, total: cumTotal });
    sessionsOverTime.push({ date: d, count: dailySessions.get(d) || 0 });

    const dtEntry = dailyTokens.get(d);
    tokensOverTime.push({
      date: d,
      input: dtEntry ? dtEntry.input : 0,
      output: dtEntry ? dtEntry.output : 0,
      cacheRead: dtEntry ? dtEntry.cacheRead : 0,
    });

    const dchEntry = dailyCacheHit.get(d);
    const rate = dchEntry && (dchEntry.totalInput + dchEntry.cacheRead) > 0 ? dchEntry.cacheRead / (dchEntry.totalInput + dchEntry.cacheRead) : 0;
    cacheHitRateOverTime.push({ date: d, rate: rate });
  }

  const costDistribution: AnalyticsPayload["costDistribution"] = [];
  for (let bi = 0; bi < bucketOrder.length; bi++) {
    costDistribution.push({
      bucket: bucketOrder[bi],
      count: costBuckets.get(bucketOrder[bi]) || 0,
    });
  }

  const sessionBubbles: AnalyticsPayload["sessionBubbles"] = [];
  const nonZeroCost = filtered.filter(function (s) { return s.cost > 0; });
  const sorted = nonZeroCost.slice().sort(function (a, b) {
    return (b.endTime || b.startTime) - (a.endTime || a.startTime);
  });
  const bubbleCap = Math.min(sorted.length, 200);
  for (let sbi = 0; sbi < bubbleCap; sbi++) {
    const sb = sorted[sbi];
    sessionBubbles.push({
      id: sb.id,
      title: sb.title,
      cost: sb.cost,
      tokens: sb.inputTokens + sb.outputTokens,
      timestamp: sb.endTime > 0 ? sb.endTime : sb.startTime,
      project: sb.project,
    });
  }

  const modelUsage: AnalyticsPayload["modelUsage"] = [];
  const totalModelCost = totalCost || 1;
  modelStats.forEach(function (val, key) {
    modelUsage.push({
      model: key,
      sessions: val.sessions,
      cost: val.cost,
      tokens: val.tokens,
      percentage: (val.cost / totalModelCost) * 100,
    });
  });
  modelUsage.sort(function (a: typeof modelUsage[number], b: typeof modelUsage[number]) { return b.cost - a.cost; });

  const projectBreakdown: AnalyticsPayload["projectBreakdown"] = [];
  projectStats.forEach(function (val, key) {
    projectBreakdown.push({
      project: key,
      cost: val.cost,
      sessions: val.sessions,
      tokens: val.tokens,
    });
  });
  projectBreakdown.sort(function (a: typeof projectBreakdown[number], b: typeof projectBreakdown[number]) { return b.cost - a.cost; });

  const toolUsage: AnalyticsPayload["toolUsage"] = [];
  toolStats.forEach(function (val, key) {
    toolUsage.push({
      tool: key,
      count: val.count,
      avgCost: val.sessions > 0 ? val.totalCost / val.sessions : 0,
    });
  });
  toolUsage.sort(function (a: typeof toolUsage[number], b: typeof toolUsage[number]) { return b.count - a.count; });

  const responseTimeData: AnalyticsPayload["responseTimeData"] = [];
  for (let rti = 0; rti < filtered.length; rti++) {
    const rtSess = filtered[rti];
    for (let rtj = 0; rtj < rtSess.responseTimePoints.length; rtj++) {
      const rtp = rtSess.responseTimePoints[rtj];
      responseTimeData.push({ tokens: rtp.tokens, duration: rtp.duration, model: rtp.model, sessionId: rtSess.id });
    }
    if (responseTimeData.length >= 200) break;
  }
  if (responseTimeData.length > 200) responseTimeData.length = 200;

  const contextWindowSizes: Record<string, number> = { opus: 200000, sonnet: 200000, haiku: 200000, other: 200000 };
  const contextUtilization: AnalyticsPayload["contextUtilization"] = [];
  const recentSessions = sorted.slice(0, 5);
  for (let cui = 0; cui < recentSessions.length; cui++) {
    const cuSess = recentSessions[cui];
    let runningTokens = 0;
    let primaryModel = "other";
    let maxModelTokens = 0;
    cuSess.models.forEach(function (val, key) {
      if (val.tokens > maxModelTokens) {
        maxModelTokens = val.tokens;
        primaryModel = key;
      }
    });
    const windowSize = contextWindowSizes[primaryModel] || 200000;
    for (let cmj = 0; cmj < cuSess.contextMessages.length; cmj++) {
      const cm = cuSess.contextMessages[cmj];
      runningTokens += cm.inputTokens;
      contextUtilization.push({
        messageIndex: cm.messageIndex,
        contextPercent: Math.min((runningTokens / windowSize) * 100, 100),
        sessionId: cuSess.id,
        title: cuSess.title,
      });
    }
  }

  const sankeyNodes = [
    { name: "Input Tokens" },
    { name: "Cache Read" },
    { name: "Cache Creation" },
    { name: "Opus" },
    { name: "Sonnet" },
    { name: "Haiku" },
    { name: "Other" },
    { name: "Output Tokens" },
  ];
  const modelNodeMap: Record<string, number> = { opus: 3, sonnet: 4, haiku: 5, other: 6 };
  const sankeyLinks: Array<{ source: number; target: number; value: number }> = [];
  const modelInputTotals = new Map<string, number>();
  const modelCacheTotals = new Map<string, number>();
  const modelCacheCreationTotals = new Map<string, number>();
  const modelOutputTotals = new Map<string, number>();

  for (let ski = 0; ski < filtered.length; ski++) {
    const skSess = filtered[ski];
    const skTotal = skSess.inputTokens + skSess.cacheReadTokens + skSess.cacheCreationTokens;
    if (skTotal === 0) continue;
    skSess.models.forEach(function (val, key) {
      const proportion = val.tokens / (skTotal + skSess.outputTokens || 1);
      modelInputTotals.set(key, (modelInputTotals.get(key) || 0) + skSess.inputTokens * proportion);
      modelCacheTotals.set(key, (modelCacheTotals.get(key) || 0) + skSess.cacheReadTokens * proportion);
      modelCacheCreationTotals.set(key, (modelCacheCreationTotals.get(key) || 0) + skSess.cacheCreationTokens * proportion);
      modelOutputTotals.set(key, (modelOutputTotals.get(key) || 0) + skSess.outputTokens * proportion);
    });
  }

  ["opus", "sonnet", "haiku", "other"].forEach(function (model) {
    const nodeIdx = modelNodeMap[model];
    const inputVal = Math.round(modelInputTotals.get(model) || 0);
    const cacheVal = Math.round(modelCacheTotals.get(model) || 0);
    const cacheCreationVal = Math.round(modelCacheCreationTotals.get(model) || 0);
    const outputVal = Math.round(modelOutputTotals.get(model) || 0);
    if (inputVal > 0) sankeyLinks.push({ source: 0, target: nodeIdx, value: inputVal });
    if (cacheVal > 0) sankeyLinks.push({ source: 1, target: nodeIdx, value: cacheVal });
    if (cacheCreationVal > 0) sankeyLinks.push({ source: 2, target: nodeIdx, value: cacheCreationVal });
    if (outputVal > 0) sankeyLinks.push({ source: nodeIdx, target: 7, value: outputVal });
  });

  const tokenFlowSankey: AnalyticsPayload["tokenFlowSankey"] = { nodes: sankeyNodes, links: sankeyLinks };

  const activityCalendarMap = new Map<string, { count: number; tokens: number; cost: number }>();
  for (let aci = 0; aci < filtered.length; aci++) {
    const acSess = filtered[aci];
    const acDate = formatDate(acSess.endTime > 0 ? acSess.endTime : acSess.startTime);
    let acEntry = activityCalendarMap.get(acDate);
    if (!acEntry) {
      acEntry = { count: 0, tokens: 0, cost: 0 };
      activityCalendarMap.set(acDate, acEntry);
    }
    acEntry.count++;
    acEntry.tokens += acSess.inputTokens + acSess.outputTokens;
    acEntry.cost += acSess.cost;
  }

  const activityCalendar: AnalyticsPayload["activityCalendar"] = [];
  if (dates.length > 0) {
    const calStart = new Date(dates[0]);
    const calEnd = new Date(dates[dates.length - 1]);
    const calCursor = new Date(calStart);
    while (calCursor <= calEnd) {
      const calKey = formatDate(calCursor.getTime());
      const calData = activityCalendarMap.get(calKey);
      activityCalendar.push({
        date: calKey,
        count: calData ? calData.count : 0,
        tokens: calData ? calData.tokens : 0,
        cost: calData ? calData.cost : 0,
      });
      calCursor.setDate(calCursor.getDate() + 1);
    }
  }

  const hourlyHeatmap: AnalyticsPayload["hourlyHeatmap"] = [];
  const heatmapGrid = new Map<string, number>();
  for (let hmi = 0; hmi < filtered.length; hmi++) {
    const hmSess = filtered[hmi];
    if (hmSess.startTime <= 0) continue;
    const hmDate = new Date(hmSess.startTime);
    const hmDay = hmDate.getDay();
    const hmHour = hmDate.getHours();
    const hmKey = hmDay + ":" + hmHour;
    heatmapGrid.set(hmKey, (heatmapGrid.get(hmKey) || 0) + 1);
  }
  for (let hd = 0; hd < 7; hd++) {
    for (let hh = 0; hh < 24; hh++) {
      const hhKey = hd + ":" + hh;
      hourlyHeatmap.push({ day: hd, hour: hh, count: heatmapGrid.get(hhKey) || 0 });
    }
  }

  const sessionTimeline: AnalyticsPayload["sessionTimeline"] = [];
  const tlSorted = filtered
    .filter(function (s) { return s.startTime > 0 && s.endTime > 0 && s.cost > 0; })
    .sort(function (a, b) { return b.startTime - a.startTime; });
  const tlCap = Math.min(tlSorted.length, 50);
  for (let tli = 0; tli < tlCap; tli++) {
    const tlSess = tlSorted[tli];
    sessionTimeline.push({
      id: tlSess.id,
      title: tlSess.title,
      project: tlSess.project,
      start: tlSess.startTime,
      end: tlSess.endTime,
      cost: tlSess.cost,
    });
  }

  const dailySummaryMap = new Map<string, { sessions: number; cost: number; tokens: number; tools: Map<string, number>; models: Map<string, number> }>();
  for (let dsi = 0; dsi < filtered.length; dsi++) {
    const dsSess = filtered[dsi];
    const dsDate = formatDate(dsSess.endTime > 0 ? dsSess.endTime : dsSess.startTime);
    let dsEntry = dailySummaryMap.get(dsDate);
    if (!dsEntry) {
      dsEntry = { sessions: 0, cost: 0, tokens: 0, tools: new Map(), models: new Map() };
      dailySummaryMap.set(dsDate, dsEntry);
    }
    dsEntry.sessions++;
    dsEntry.cost += dsSess.cost;
    dsEntry.tokens += dsSess.inputTokens + dsSess.outputTokens;
    dsSess.tools.forEach(function (count, tool) {
      dsEntry!.tools.set(tool, (dsEntry!.tools.get(tool) || 0) + count);
    });
    dsSess.models.forEach(function (val, key) {
      dsEntry!.models.set(key, (dsEntry!.models.get(key) || 0) + val.cost);
    });
  }

  const dailySummaries: AnalyticsPayload["dailySummaries"] = [];
  const dsSortedDates = Array.from(dailySummaryMap.keys()).sort();
  for (let dsdi = 0; dsdi < dsSortedDates.length; dsdi++) {
    const dsd = dsSortedDates[dsdi];
    const dsData = dailySummaryMap.get(dsd)!;
    let topTool = "";
    let topToolCount = 0;
    dsData.tools.forEach(function (count, tool) {
      if (count > topToolCount) {
        topToolCount = count;
        topTool = tool;
      }
    });
    const modelMix: Record<string, number> = {};
    let modelTotal = 0;
    dsData.models.forEach(function (cost) { modelTotal += cost; });
    if (modelTotal > 0) {
      dsData.models.forEach(function (cost, model) {
        modelMix[model] = Math.round((cost / modelTotal) * 100) / 100;
      });
    }
    dailySummaries.push({
      date: dsd,
      sessions: dsData.sessions,
      cost: dsData.cost,
      tokens: dsData.tokens,
      topTool: topTool,
      modelMix: modelMix,
    });
  }

  const toolTreemap: AnalyticsPayload["toolTreemap"] = [];
  toolStats.forEach(function (val, key) {
    toolTreemap.push({
      name: key,
      count: val.count,
      avgCost: val.sessions > 0 ? val.totalCost / val.sessions : 0,
    });
  });
  toolTreemap.sort(function (a: typeof toolTreemap[number], b: typeof toolTreemap[number]) { return b.count - a.count; });

  const toolCategoryMap: Record<string, string> = {
    Read: "Read", Glob: "Read", Grep: "Read", LS: "Read",
    Edit: "Write", Write: "Write", MultiEdit: "Write",
    Bash: "Execute",
    Agent: "AI", Skill: "AI",
  };
  const toolSunburst: AnalyticsPayload["toolSunburst"] = [];
  toolStats.forEach(function (val, key) {
    const category = toolCategoryMap[key] || "Other";
    toolSunburst.push({ name: key, category: category, count: val.count });
  });
  toolSunburst.sort(function (a: typeof toolSunburst[number], b: typeof toolSunburst[number]) { return b.count - a.count; });

  let totalToolCalls = 0;
  toolStats.forEach(function (val) { totalToolCalls += val.count; });
  const permissionStats: AnalyticsPayload["permissionStats"] = {
    allowed: totalToolCalls,
    denied: 0,
    alwaysAllowed: 0,
  };

  const projectRadarMap = new Map<string, { cost: number; sessions: number; totalDuration: number; durationCount: number; tools: Set<string>; totalTokens: number }>();
  for (let pri = 0; pri < filtered.length; pri++) {
    const prSess = filtered[pri];
    let prEntry = projectRadarMap.get(prSess.project);
    if (!prEntry) {
      prEntry = { cost: 0, sessions: 0, totalDuration: 0, durationCount: 0, tools: new Set(), totalTokens: 0 };
      projectRadarMap.set(prSess.project, prEntry);
    }
    prEntry.cost += prSess.cost;
    prEntry.sessions++;
    prEntry.totalTokens += prSess.inputTokens + prSess.outputTokens;
    if (prSess.startTime > 0 && prSess.endTime > prSess.startTime) {
      prEntry.totalDuration += prSess.endTime - prSess.startTime;
      prEntry.durationCount++;
    }
    prSess.tools.forEach(function (_count, tool) { prEntry!.tools.add(tool); });
  }
  const projectRadar: AnalyticsPayload["projectRadar"] = [];
  projectRadarMap.forEach(function (val, key) {
    projectRadar.push({
      project: key,
      cost: val.cost,
      sessions: val.sessions,
      avgDuration: val.durationCount > 0 ? val.totalDuration / val.durationCount : 0,
      toolDiversity: val.tools.size,
      tokensPerSession: val.sessions > 0 ? val.totalTokens / val.sessions : 0,
    });
  });
  projectRadar.sort(function (a: typeof projectRadar[number], b: typeof projectRadar[number]) { return b.cost - a.cost; });
  if (projectRadar.length > 5) projectRadar.length = 5;

  const contextWindowSizesForComplexity: Record<string, number> = { opus: 200000, sonnet: 200000, haiku: 200000, other: 200000 };
  const sessionComplexity: AnalyticsPayload["sessionComplexity"] = [];
  for (let sci = 0; sci < filtered.length; sci++) {
    const scSess = filtered[sci];
    const scUniqueTools = scSess.tools.size;
    const scMessages = scSess.contextMessages.length;
    let scRunning = 0;
    let scPrimaryModel = "other";
    let scMaxTokens = 0;
    scSess.models.forEach(function (val, key) {
      if (val.tokens > scMaxTokens) { scMaxTokens = val.tokens; scPrimaryModel = key; }
    });
    const scWindowSize = contextWindowSizesForComplexity[scPrimaryModel] || 200000;
    for (let scmi = 0; scmi < scSess.contextMessages.length; scmi++) {
      scRunning += scSess.contextMessages[scmi].inputTokens;
    }
    const scContextPercent = Math.min((scRunning / scWindowSize) * 100, 100);
    const scScore = (scMessages * 1) + (scUniqueTools * 5) + (scContextPercent * 0.5);
    sessionComplexity.push({
      id: scSess.id,
      title: scSess.title,
      score: Math.round(scScore * 10) / 10,
      messages: scMessages,
      tools: scUniqueTools,
      contextPercent: Math.round(scContextPercent * 10) / 10,
    });
  }
  sessionComplexity.sort(function (a: typeof sessionComplexity[number], b: typeof sessionComplexity[number]) { return b.score - a.score; });
  if (sessionComplexity.length > 20) sessionComplexity.length = 20;

  return {
    totalCost: totalCost,
    totalSessions: filtered.length,
    totalTokens: {
      input: totalInput,
      output: totalOutput,
      cacheRead: totalCacheRead,
      cacheCreation: totalCacheCreation,
    },
    cacheHitRate: cacheHitRate,
    avgSessionCost: filtered.length > 0 ? totalCost / filtered.length : 0,
    avgSessionDuration: durationCount > 0 ? totalDuration / durationCount : 0,
    costOverTime: costOverTime,
    cumulativeCost: cumulativeCost,
    sessionsOverTime: sessionsOverTime,
    tokensOverTime: tokensOverTime,
    cacheHitRateOverTime: cacheHitRateOverTime,
    costDistribution: costDistribution,
    sessionBubbles: sessionBubbles,
    modelUsage: modelUsage,
    projectBreakdown: projectBreakdown,
    toolUsage: toolUsage,
    responseTimeData: responseTimeData,
    contextUtilization: contextUtilization,
    tokenFlowSankey: tokenFlowSankey,
    activityCalendar: activityCalendar,
    hourlyHeatmap: hourlyHeatmap,
    sessionTimeline: sessionTimeline,
    dailySummaries: dailySummaries,
    toolTreemap: toolTreemap,
    toolSunburst: toolSunburst,
    permissionStats: permissionStats,
    projectRadar: projectRadar,
    sessionComplexity: sessionComplexity,
  };
}

export async function getAnalytics(
  scope: AnalyticsScope,
  period: AnalyticsPeriod,
  projectSlug?: string,
  sessionId?: string,
  forceRefresh?: boolean,
): Promise<AnalyticsPayload> {
  let cacheKey = scope + ":" + period + ":" + (projectSlug || "all");
  if (sessionId) cacheKey += ":" + sessionId;

  if (!forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return Promise.resolve(cached.data);
    }
    const existing = inflight.get(cacheKey);
    if (existing) return existing;
  }

  const config = loadConfig();
  const cutoff = getPeriodCutoff(period);
  const fileRefs: Array<{ path: string; id: string; slug: string }> = [];

  if (scope === "global") {
    for (let i = 0; i < config.projects.length; i++) {
      const proj = config.projects[i];
      const files = getSessionFilesForProject(proj.path, cutoff);
      for (let j = 0; j < files.length; j++) {
        fileRefs.push({ path: files[j].path, id: files[j].id, slug: proj.slug });
      }
    }
  } else if (scope === "project" && projectSlug) {
    const project = config.projects.find(function (p: typeof config.projects[number]) { return p.slug === projectSlug; });
    if (project) {
      const projFiles = getSessionFilesForProject(project.path, cutoff);
      for (let pf = 0; pf < projFiles.length; pf++) {
        fileRefs.push({ path: projFiles[pf].path, id: projFiles[pf].id, slug: projectSlug });
      }
    }
  } else if (scope === "session" && projectSlug && sessionId) {
    const sessProject = config.projects.find(function (p: typeof config.projects[number]) { return p.slug === projectSlug; });
    if (sessProject) {
      const hash = projectPathToHash(sessProject.path);
      const filePath = join(homedir(), ".claude", "projects", hash, sessionId + ".jsonl");
      if (existsSync(filePath)) {
        fileRefs.push({ path: filePath, id: sessionId, slug: projectSlug });
      }
    }
  }

  const promise = Promise.all(fileRefs.map(function (ref) {
    return parseSessionFileAsync(ref.path, ref.id, ref.slug);
  })).then(function (results) {
    const sessions = results.filter(function (s): s is SessionData { return s !== null; });
    const result = aggregate(sessions, period);
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    inflight.delete(cacheKey);
    return result;
  });

  inflight.set(cacheKey, promise);
  return promise;
}

let dailySpendCache: { value: number; timestamp: number } | null = null;
const DAILY_SPEND_CACHE_TTL = 30 * 1000;

export function getDailySpend(): number {
  if (dailySpendCache && Date.now() - dailySpendCache.timestamp < DAILY_SPEND_CACHE_TTL) {
    return dailySpendCache.value;
  }

  const config = loadConfig();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let totalCost = 0;

  for (let i = 0; i < config.projects.length; i++) {
    const proj = config.projects[i];
    const files = getSessionFilesForProject(proj.path);
    for (let j = 0; j < files.length; j++) {
      const data = parseSessionFile(files[j].path, files[j].id, proj.slug);
      if (!data) continue;
      const sessionTime = data.endTime > 0 ? data.endTime : data.startTime;
      if (sessionTime >= todayStart) {
        totalCost += data.cost;
      }
    }
  }

  dailySpendCache = { value: totalCost, timestamp: Date.now() };
  return totalCost;
}

export function invalidateDailySpendCache(): void {
  dailySpendCache = null;
}

export async function streamAnalyticsSections(
  scope: AnalyticsScope,
  period: AnalyticsPeriod,
  projectSlug: string | undefined,
  sessionId: string | undefined,
  forceRefresh: boolean | undefined,
  onSection: (name: AnalyticsSectionName, data: Partial<AnalyticsPayload>) => void,
): Promise<void> {
  const payload = await getAnalytics(scope, period, projectSlug, sessionId, forceRefresh);
  const sectionNames: AnalyticsSectionName[] = ["summary", "spending", "usage", "activity", "projects"];

  for (let si = 0; si < sectionNames.length; si++) {
    const name = sectionNames[si];
    const keys = SECTION_KEYS[name];
    const sectionData: Partial<AnalyticsPayload> = {};
    for (let ki = 0; ki < keys.length; ki++) {
      const key = keys[ki];
      (sectionData as Record<string, unknown>)[key] = payload[key];
    }
    onSection(name, sectionData);
    await new Promise<void>(function (resolve) { setImmediate(resolve); });
  }
}
