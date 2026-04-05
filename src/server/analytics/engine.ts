import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AnalyticsPayload, AnalyticsPeriod, AnalyticsScope, AnalyticsSectionName } from "@lattice/shared";
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

var cache = new Map<string, CacheEntry>();
var CACHE_TTL = 5 * 60 * 1000;
var inflight = new Map<string, Promise<AnalyticsPayload>>();

export var SECTION_KEYS: Record<AnalyticsSectionName, Array<keyof AnalyticsPayload>> = {
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
  var now = Date.now();
  var hours: Record<string, number> = { "24h": 24, "7d": 168, "30d": 720, "90d": 2160 };
  return now - (hours[period] || 0) * 60 * 60 * 1000;
}

function formatDate(ts: number): string {
  var d = new Date(ts);
  var year = d.getFullYear();
  var month = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
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
    var lines = text.split("\n");
    var data: SessionData = {
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

    var lastUserTimestamp = 0;
    var assistantIndex = 0;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      var parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }

      var timestamp = 0;
      if (typeof parsed.timestamp === "string") {
        var ts = new Date(parsed.timestamp as string).getTime();
        if (!isNaN(ts)) timestamp = ts;
      }

      if (timestamp > 0) {
        if (data.startTime === 0 || timestamp < data.startTime) data.startTime = timestamp;
        if (timestamp > data.endTime) data.endTime = timestamp;
      }

      if (parsed.type === "assistant") {
        var message = parsed.message as Record<string, unknown> | undefined;
        if (!message) continue;

        var usage = message.usage as Record<string, number> | undefined;
        var model = (message.model as string) || "";

        if (usage) {
          var inTok = usage.input_tokens || 0;
          var outTok = usage.output_tokens || 0;
          var cacheRead = usage.cache_read_input_tokens || 0;
          var cacheCreation = usage.cache_creation_input_tokens || 0;

          data.inputTokens += inTok;
          data.outputTokens += outTok;
          data.cacheReadTokens += cacheRead;
          data.cacheCreationTokens += cacheCreation;

          var cost = estimateCost(model, inTok, outTok, cacheRead, cacheCreation);
          data.cost += cost;

          var bucket = bucketModel(model);
          var existing = data.models.get(bucket);
          if (existing) {
            existing.cost += cost;
            existing.tokens += inTok + outTok;
          } else {
            data.models.set(bucket, { cost: cost, tokens: inTok + outTok });
          }

          if (outTok > 0 && timestamp > 0 && lastUserTimestamp > 0) {
            var dur = timestamp - lastUserTimestamp;
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
        var userMsg = parsed.message as Record<string, unknown> | undefined;
        if (!userMsg || !Array.isArray(userMsg.content)) continue;

        var contentArr = userMsg.content as Array<Record<string, unknown>>;
        for (var j = 0; j < contentArr.length; j++) {
          var block = contentArr[j];
          if (block.type === "tool_result" && typeof block.tool_use_id === "string") {
            var toolName = (block.name as string) || "unknown";
            data.tools.set(toolName, (data.tools.get(toolName) || 0) + 1);
          }
        }

        if (!data.title && Array.isArray(userMsg.content)) {
          for (var k = 0; k < contentArr.length; k++) {
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
    var text = readFileSync(filePath, "utf-8");
    return parseSessionText(text, sessionId, projectSlug);
  } catch {
    return null;
  }
}

async function parseSessionFileAsync(filePath: string, sessionId: string, projectSlug: string): Promise<SessionData | null> {
  try {
    var text = await readFile(filePath, "utf-8");
    return parseSessionText(text, sessionId, projectSlug);
  } catch {
    return null;
  }
}

function getSessionFilesForProject(projectPath: string, cutoff?: number): Array<{ path: string; id: string }> {
  var hash = projectPathToHash(projectPath);
  var dir = join(homedir(), ".claude", "projects", hash);
  if (!existsSync(dir)) return [];

  var files: Array<{ path: string; id: string }> = [];
  try {
    var entries = readdirSync(dir);
    for (var i = 0; i < entries.length; i++) {
      if (!entries[i].endsWith(".jsonl")) continue;
      var filePath = join(dir, entries[i]);
      if (cutoff && cutoff > 0) {
        try {
          var mtime = statSync(filePath).mtimeMs;
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
  var cutoff = getPeriodCutoff(period);
  var filtered: SessionData[] = [];
  for (var i = 0; i < sessions.length; i++) {
    var s = sessions[i];
    var sessionTime = s.endTime > 0 ? s.endTime : s.startTime;
    if (sessionTime >= cutoff) filtered.push(s);
  }

  var totalCost = 0;
  var totalInput = 0;
  var totalOutput = 0;
  var totalCacheRead = 0;
  var totalCacheCreation = 0;
  var totalDuration = 0;
  var durationCount = 0;

  var dailyCost = new Map<string, { total: number; opus: number; sonnet: number; haiku: number; other: number }>();
  var dailySessions = new Map<string, number>();
  var dailyTokens = new Map<string, { input: number; output: number; cacheRead: number }>();
  var dailyCacheHit = new Map<string, { cacheRead: number; totalInput: number }>();

  var modelStats = new Map<string, { sessions: number; cost: number; tokens: number }>();
  var projectStats = new Map<string, { cost: number; sessions: number; tokens: number }>();
  var toolStats = new Map<string, { count: number; totalCost: number; sessions: number }>();

  var costBuckets = new Map<string, number>();
  var bucketOrder = ["<$0.01", "$0.01-0.05", "$0.05-0.10", "$0.10-0.50", "$0.50-1.00", "$1.00-5.00", "$5.00+"];
  for (var b = 0; b < bucketOrder.length; b++) {
    costBuckets.set(bucketOrder[b], 0);
  }

  for (var si = 0; si < filtered.length; si++) {
    var sess = filtered[si];
    totalCost += sess.cost;
    totalInput += sess.inputTokens;
    totalOutput += sess.outputTokens;
    totalCacheRead += sess.cacheReadTokens;
    totalCacheCreation += sess.cacheCreationTokens;

    if (sess.startTime > 0 && sess.endTime > 0 && sess.endTime > sess.startTime) {
      totalDuration += sess.endTime - sess.startTime;
      durationCount++;
    }

    var date = formatDate(sess.endTime > 0 ? sess.endTime : sess.startTime);

    var dc = dailyCost.get(date);
    if (!dc) {
      dc = { total: 0, opus: 0, sonnet: 0, haiku: 0, other: 0 };
      dailyCost.set(date, dc);
    }
    dc.total += sess.cost;
    sess.models.forEach(function (val, key) {
      dc![key as "opus" | "sonnet" | "haiku" | "other"] += val.cost;
    });

    dailySessions.set(date, (dailySessions.get(date) || 0) + 1);

    var dt = dailyTokens.get(date);
    if (!dt) {
      dt = { input: 0, output: 0, cacheRead: 0 };
      dailyTokens.set(date, dt);
    }
    dt.input += sess.inputTokens;
    dt.output += sess.outputTokens;
    dt.cacheRead += sess.cacheReadTokens;

    var dch = dailyCacheHit.get(date);
    if (!dch) {
      dch = { cacheRead: 0, totalInput: 0 };
      dailyCacheHit.set(date, dch);
    }
    dch.cacheRead += sess.cacheReadTokens;
    dch.totalInput += sess.inputTokens;

    sess.models.forEach(function (val, key) {
      var ms = modelStats.get(key);
      if (!ms) {
        ms = { sessions: 0, cost: 0, tokens: 0 };
        modelStats.set(key, ms);
      }
      ms.sessions++;
      ms.cost += val.cost;
      ms.tokens += val.tokens;
    });

    var ps = projectStats.get(sess.project);
    if (!ps) {
      ps = { cost: 0, sessions: 0, tokens: 0 };
      projectStats.set(sess.project, ps);
    }
    ps.cost += sess.cost;
    ps.sessions++;
    ps.tokens += sess.inputTokens + sess.outputTokens;

    sess.tools.forEach(function (count, tool) {
      var ts = toolStats.get(tool);
      if (!ts) {
        ts = { count: 0, totalCost: 0, sessions: 0 };
        toolStats.set(tool, ts);
      }
      ts.count += count;
      ts.totalCost += sess.cost;
      ts.sessions++;
    });

    var bucket = getCostBucket(sess.cost);
    if (bucket) {
      costBuckets.set(bucket, (costBuckets.get(bucket) || 0) + 1);
    }
  }

  var totalTokensAll = totalInput + totalOutput + totalCacheRead + totalCacheCreation;
  var cacheHitRate = (totalInput + totalCacheRead) > 0 ? totalCacheRead / (totalInput + totalCacheRead) : 0;

  var dates = Array.from(dailyCost.keys()).sort();

  var costOverTime: AnalyticsPayload["costOverTime"] = [];
  var cumulativeCost: AnalyticsPayload["cumulativeCost"] = [];
  var sessionsOverTime: AnalyticsPayload["sessionsOverTime"] = [];
  var tokensOverTime: AnalyticsPayload["tokensOverTime"] = [];
  var cacheHitRateOverTime: AnalyticsPayload["cacheHitRateOverTime"] = [];

  var cumTotal = 0;
  for (var di = 0; di < dates.length; di++) {
    var d = dates[di];
    var dcEntry = dailyCost.get(d)!;
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

    var dtEntry = dailyTokens.get(d);
    tokensOverTime.push({
      date: d,
      input: dtEntry ? dtEntry.input : 0,
      output: dtEntry ? dtEntry.output : 0,
      cacheRead: dtEntry ? dtEntry.cacheRead : 0,
    });

    var dchEntry = dailyCacheHit.get(d);
    var rate = dchEntry && (dchEntry.totalInput + dchEntry.cacheRead) > 0 ? dchEntry.cacheRead / (dchEntry.totalInput + dchEntry.cacheRead) : 0;
    cacheHitRateOverTime.push({ date: d, rate: rate });
  }

  var costDistribution: AnalyticsPayload["costDistribution"] = [];
  for (var bi = 0; bi < bucketOrder.length; bi++) {
    costDistribution.push({
      bucket: bucketOrder[bi],
      count: costBuckets.get(bucketOrder[bi]) || 0,
    });
  }

  var sessionBubbles: AnalyticsPayload["sessionBubbles"] = [];
  var nonZeroCost = filtered.filter(function (s) { return s.cost > 0; });
  var sorted = nonZeroCost.slice().sort(function (a, b) {
    return (b.endTime || b.startTime) - (a.endTime || a.startTime);
  });
  var bubbleCap = Math.min(sorted.length, 200);
  for (var sbi = 0; sbi < bubbleCap; sbi++) {
    var sb = sorted[sbi];
    sessionBubbles.push({
      id: sb.id,
      title: sb.title,
      cost: sb.cost,
      tokens: sb.inputTokens + sb.outputTokens,
      timestamp: sb.endTime > 0 ? sb.endTime : sb.startTime,
      project: sb.project,
    });
  }

  var modelUsage: AnalyticsPayload["modelUsage"] = [];
  var totalModelCost = totalCost || 1;
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

  var projectBreakdown: AnalyticsPayload["projectBreakdown"] = [];
  projectStats.forEach(function (val, key) {
    projectBreakdown.push({
      project: key,
      cost: val.cost,
      sessions: val.sessions,
      tokens: val.tokens,
    });
  });
  projectBreakdown.sort(function (a: typeof projectBreakdown[number], b: typeof projectBreakdown[number]) { return b.cost - a.cost; });

  var toolUsage: AnalyticsPayload["toolUsage"] = [];
  toolStats.forEach(function (val, key) {
    toolUsage.push({
      tool: key,
      count: val.count,
      avgCost: val.sessions > 0 ? val.totalCost / val.sessions : 0,
    });
  });
  toolUsage.sort(function (a: typeof toolUsage[number], b: typeof toolUsage[number]) { return b.count - a.count; });

  var responseTimeData: AnalyticsPayload["responseTimeData"] = [];
  for (var rti = 0; rti < filtered.length; rti++) {
    var rtSess = filtered[rti];
    for (var rtj = 0; rtj < rtSess.responseTimePoints.length; rtj++) {
      var rtp = rtSess.responseTimePoints[rtj];
      responseTimeData.push({ tokens: rtp.tokens, duration: rtp.duration, model: rtp.model, sessionId: rtSess.id });
    }
    if (responseTimeData.length >= 200) break;
  }
  if (responseTimeData.length > 200) responseTimeData.length = 200;

  var contextWindowSizes: Record<string, number> = { opus: 200000, sonnet: 200000, haiku: 200000, other: 200000 };
  var contextUtilization: AnalyticsPayload["contextUtilization"] = [];
  var recentSessions = sorted.slice(0, 5);
  for (var cui = 0; cui < recentSessions.length; cui++) {
    var cuSess = recentSessions[cui];
    var runningTokens = 0;
    var primaryModel = "other";
    var maxModelTokens = 0;
    cuSess.models.forEach(function (val, key) {
      if (val.tokens > maxModelTokens) {
        maxModelTokens = val.tokens;
        primaryModel = key;
      }
    });
    var windowSize = contextWindowSizes[primaryModel] || 200000;
    for (var cmj = 0; cmj < cuSess.contextMessages.length; cmj++) {
      var cm = cuSess.contextMessages[cmj];
      runningTokens += cm.inputTokens;
      contextUtilization.push({
        messageIndex: cm.messageIndex,
        contextPercent: Math.min((runningTokens / windowSize) * 100, 100),
        sessionId: cuSess.id,
        title: cuSess.title,
      });
    }
  }

  var sankeyNodes = [
    { name: "Input Tokens" },
    { name: "Cache Read" },
    { name: "Cache Creation" },
    { name: "Opus" },
    { name: "Sonnet" },
    { name: "Haiku" },
    { name: "Other" },
    { name: "Output Tokens" },
  ];
  var modelNodeMap: Record<string, number> = { opus: 3, sonnet: 4, haiku: 5, other: 6 };
  var sankeyLinks: Array<{ source: number; target: number; value: number }> = [];
  var modelInputTotals = new Map<string, number>();
  var modelCacheTotals = new Map<string, number>();
  var modelCacheCreationTotals = new Map<string, number>();
  var modelOutputTotals = new Map<string, number>();

  for (var ski = 0; ski < filtered.length; ski++) {
    var skSess = filtered[ski];
    var skTotal = skSess.inputTokens + skSess.cacheReadTokens + skSess.cacheCreationTokens;
    if (skTotal === 0) continue;
    skSess.models.forEach(function (val, key) {
      var proportion = val.tokens / (skTotal + skSess.outputTokens || 1);
      modelInputTotals.set(key, (modelInputTotals.get(key) || 0) + skSess.inputTokens * proportion);
      modelCacheTotals.set(key, (modelCacheTotals.get(key) || 0) + skSess.cacheReadTokens * proportion);
      modelCacheCreationTotals.set(key, (modelCacheCreationTotals.get(key) || 0) + skSess.cacheCreationTokens * proportion);
      modelOutputTotals.set(key, (modelOutputTotals.get(key) || 0) + skSess.outputTokens * proportion);
    });
  }

  ["opus", "sonnet", "haiku", "other"].forEach(function (model) {
    var nodeIdx = modelNodeMap[model];
    var inputVal = Math.round(modelInputTotals.get(model) || 0);
    var cacheVal = Math.round(modelCacheTotals.get(model) || 0);
    var cacheCreationVal = Math.round(modelCacheCreationTotals.get(model) || 0);
    var outputVal = Math.round(modelOutputTotals.get(model) || 0);
    if (inputVal > 0) sankeyLinks.push({ source: 0, target: nodeIdx, value: inputVal });
    if (cacheVal > 0) sankeyLinks.push({ source: 1, target: nodeIdx, value: cacheVal });
    if (cacheCreationVal > 0) sankeyLinks.push({ source: 2, target: nodeIdx, value: cacheCreationVal });
    if (outputVal > 0) sankeyLinks.push({ source: nodeIdx, target: 7, value: outputVal });
  });

  var tokenFlowSankey: AnalyticsPayload["tokenFlowSankey"] = { nodes: sankeyNodes, links: sankeyLinks };

  var activityCalendarMap = new Map<string, { count: number; tokens: number; cost: number }>();
  for (var aci = 0; aci < filtered.length; aci++) {
    var acSess = filtered[aci];
    var acDate = formatDate(acSess.endTime > 0 ? acSess.endTime : acSess.startTime);
    var acEntry = activityCalendarMap.get(acDate);
    if (!acEntry) {
      acEntry = { count: 0, tokens: 0, cost: 0 };
      activityCalendarMap.set(acDate, acEntry);
    }
    acEntry.count++;
    acEntry.tokens += acSess.inputTokens + acSess.outputTokens;
    acEntry.cost += acSess.cost;
  }

  var activityCalendar: AnalyticsPayload["activityCalendar"] = [];
  if (dates.length > 0) {
    var calStart = new Date(dates[0]);
    var calEnd = new Date(dates[dates.length - 1]);
    var calCursor = new Date(calStart);
    while (calCursor <= calEnd) {
      var calKey = formatDate(calCursor.getTime());
      var calData = activityCalendarMap.get(calKey);
      activityCalendar.push({
        date: calKey,
        count: calData ? calData.count : 0,
        tokens: calData ? calData.tokens : 0,
        cost: calData ? calData.cost : 0,
      });
      calCursor.setDate(calCursor.getDate() + 1);
    }
  }

  var hourlyHeatmap: AnalyticsPayload["hourlyHeatmap"] = [];
  var heatmapGrid = new Map<string, number>();
  for (var hmi = 0; hmi < filtered.length; hmi++) {
    var hmSess = filtered[hmi];
    if (hmSess.startTime <= 0) continue;
    var hmDate = new Date(hmSess.startTime);
    var hmDay = hmDate.getDay();
    var hmHour = hmDate.getHours();
    var hmKey = hmDay + ":" + hmHour;
    heatmapGrid.set(hmKey, (heatmapGrid.get(hmKey) || 0) + 1);
  }
  for (var hd = 0; hd < 7; hd++) {
    for (var hh = 0; hh < 24; hh++) {
      var hhKey = hd + ":" + hh;
      hourlyHeatmap.push({ day: hd, hour: hh, count: heatmapGrid.get(hhKey) || 0 });
    }
  }

  var sessionTimeline: AnalyticsPayload["sessionTimeline"] = [];
  var tlSorted = filtered
    .filter(function (s) { return s.startTime > 0 && s.endTime > 0 && s.cost > 0; })
    .sort(function (a, b) { return b.startTime - a.startTime; });
  var tlCap = Math.min(tlSorted.length, 50);
  for (var tli = 0; tli < tlCap; tli++) {
    var tlSess = tlSorted[tli];
    sessionTimeline.push({
      id: tlSess.id,
      title: tlSess.title,
      project: tlSess.project,
      start: tlSess.startTime,
      end: tlSess.endTime,
      cost: tlSess.cost,
    });
  }

  var dailySummaryMap = new Map<string, { sessions: number; cost: number; tokens: number; tools: Map<string, number>; models: Map<string, number> }>();
  for (var dsi = 0; dsi < filtered.length; dsi++) {
    var dsSess = filtered[dsi];
    var dsDate = formatDate(dsSess.endTime > 0 ? dsSess.endTime : dsSess.startTime);
    var dsEntry = dailySummaryMap.get(dsDate);
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

  var dailySummaries: AnalyticsPayload["dailySummaries"] = [];
  var dsSortedDates = Array.from(dailySummaryMap.keys()).sort();
  for (var dsdi = 0; dsdi < dsSortedDates.length; dsdi++) {
    var dsd = dsSortedDates[dsdi];
    var dsData = dailySummaryMap.get(dsd)!;
    var topTool = "";
    var topToolCount = 0;
    dsData.tools.forEach(function (count, tool) {
      if (count > topToolCount) {
        topToolCount = count;
        topTool = tool;
      }
    });
    var modelMix: Record<string, number> = {};
    var modelTotal = 0;
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

  var toolTreemap: AnalyticsPayload["toolTreemap"] = [];
  toolStats.forEach(function (val, key) {
    toolTreemap.push({
      name: key,
      count: val.count,
      avgCost: val.sessions > 0 ? val.totalCost / val.sessions : 0,
    });
  });
  toolTreemap.sort(function (a: typeof toolTreemap[number], b: typeof toolTreemap[number]) { return b.count - a.count; });

  var toolCategoryMap: Record<string, string> = {
    Read: "Read", Glob: "Read", Grep: "Read", LS: "Read",
    Edit: "Write", Write: "Write", MultiEdit: "Write",
    Bash: "Execute",
    Agent: "AI", Skill: "AI",
  };
  var toolSunburst: AnalyticsPayload["toolSunburst"] = [];
  toolStats.forEach(function (val, key) {
    var category = toolCategoryMap[key] || "Other";
    toolSunburst.push({ name: key, category: category, count: val.count });
  });
  toolSunburst.sort(function (a: typeof toolSunburst[number], b: typeof toolSunburst[number]) { return b.count - a.count; });

  var totalToolCalls = 0;
  toolStats.forEach(function (val) { totalToolCalls += val.count; });
  var permissionStats: AnalyticsPayload["permissionStats"] = {
    allowed: totalToolCalls,
    denied: 0,
    alwaysAllowed: 0,
  };

  var projectRadarMap = new Map<string, { cost: number; sessions: number; totalDuration: number; durationCount: number; tools: Set<string>; totalTokens: number }>();
  for (var pri = 0; pri < filtered.length; pri++) {
    var prSess = filtered[pri];
    var prEntry = projectRadarMap.get(prSess.project);
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
  var projectRadar: AnalyticsPayload["projectRadar"] = [];
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

  var contextWindowSizesForComplexity: Record<string, number> = { opus: 200000, sonnet: 200000, haiku: 200000, other: 200000 };
  var sessionComplexity: AnalyticsPayload["sessionComplexity"] = [];
  for (var sci = 0; sci < filtered.length; sci++) {
    var scSess = filtered[sci];
    var scUniqueTools = scSess.tools.size;
    var scMessages = scSess.contextMessages.length;
    var scRunning = 0;
    var scPrimaryModel = "other";
    var scMaxTokens = 0;
    scSess.models.forEach(function (val, key) {
      if (val.tokens > scMaxTokens) { scMaxTokens = val.tokens; scPrimaryModel = key; }
    });
    var scWindowSize = contextWindowSizesForComplexity[scPrimaryModel] || 200000;
    for (var scmi = 0; scmi < scSess.contextMessages.length; scmi++) {
      scRunning += scSess.contextMessages[scmi].inputTokens;
    }
    var scContextPercent = Math.min((scRunning / scWindowSize) * 100, 100);
    var scScore = (scMessages * 1) + (scUniqueTools * 5) + (scContextPercent * 0.5);
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
  var cacheKey = scope + ":" + period + ":" + (projectSlug || "all");
  if (sessionId) cacheKey += ":" + sessionId;

  if (!forceRefresh) {
    var cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return Promise.resolve(cached.data);
    }
    var existing = inflight.get(cacheKey);
    if (existing) return existing;
  }

  var config = loadConfig();
  var cutoff = getPeriodCutoff(period);
  var fileRefs: Array<{ path: string; id: string; slug: string }> = [];

  if (scope === "global") {
    for (var i = 0; i < config.projects.length; i++) {
      var proj = config.projects[i];
      var files = getSessionFilesForProject(proj.path, cutoff);
      for (var j = 0; j < files.length; j++) {
        fileRefs.push({ path: files[j].path, id: files[j].id, slug: proj.slug });
      }
    }
  } else if (scope === "project" && projectSlug) {
    var project = config.projects.find(function (p: typeof config.projects[number]) { return p.slug === projectSlug; });
    if (project) {
      var projFiles = getSessionFilesForProject(project.path, cutoff);
      for (var pf = 0; pf < projFiles.length; pf++) {
        fileRefs.push({ path: projFiles[pf].path, id: projFiles[pf].id, slug: projectSlug });
      }
    }
  } else if (scope === "session" && projectSlug && sessionId) {
    var sessProject = config.projects.find(function (p: typeof config.projects[number]) { return p.slug === projectSlug; });
    if (sessProject) {
      var hash = projectPathToHash(sessProject.path);
      var filePath = join(homedir(), ".claude", "projects", hash, sessionId + ".jsonl");
      if (existsSync(filePath)) {
        fileRefs.push({ path: filePath, id: sessionId, slug: projectSlug });
      }
    }
  }

  var promise = Promise.all(fileRefs.map(function (ref) {
    return parseSessionFileAsync(ref.path, ref.id, ref.slug);
  })).then(function (results) {
    var sessions = results.filter(function (s): s is SessionData { return s !== null; });
    var result = aggregate(sessions, period);
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    inflight.delete(cacheKey);
    return result;
  });

  inflight.set(cacheKey, promise);
  return promise;
}

var dailySpendCache: { value: number; timestamp: number } | null = null;
var DAILY_SPEND_CACHE_TTL = 30 * 1000;

export function getDailySpend(): number {
  if (dailySpendCache && Date.now() - dailySpendCache.timestamp < DAILY_SPEND_CACHE_TTL) {
    return dailySpendCache.value;
  }

  var config = loadConfig();
  var now = new Date();
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  var totalCost = 0;

  for (var i = 0; i < config.projects.length; i++) {
    var proj = config.projects[i];
    var files = getSessionFilesForProject(proj.path);
    for (var j = 0; j < files.length; j++) {
      var data = parseSessionFile(files[j].path, files[j].id, proj.slug);
      if (!data) continue;
      var sessionTime = data.endTime > 0 ? data.endTime : data.startTime;
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
  var payload = await getAnalytics(scope, period, projectSlug, sessionId, forceRefresh);
  var sectionNames: AnalyticsSectionName[] = ["summary", "spending", "usage", "activity", "projects"];

  for (var si = 0; si < sectionNames.length; si++) {
    var name = sectionNames[si];
    var keys = SECTION_KEYS[name];
    var sectionData: Partial<AnalyticsPayload> = {};
    for (var ki = 0; ki < keys.length; ki++) {
      var key = keys[ki];
      (sectionData as Record<string, unknown>)[key] = payload[key];
    }
    onSection(name, sectionData);
    await new Promise<void>(function (resolve) { setImmediate(resolve); });
  }
}
