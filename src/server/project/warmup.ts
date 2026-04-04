import type { AccountInfo } from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { broadcast } from "../ws/broadcast";
import { log } from "../logger";
import { loadConfig } from "../config";
import { listSessions, loadSessionHistory } from "./session";
import { execSync } from "node:child_process";
import { existsSync, unlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

var claudeExePath: string | null = null;

function getClaudeExecutablePath(): string {
  if (claudeExePath) return claudeExePath;
  try {
    claudeExePath = execSync("which claude", { encoding: "utf-8" }).trim();
  } catch {
    claudeExePath = "claude";
  }
  return claudeExePath;
}

export interface ModelEntry {
  value: string;
  displayName: string;
}

var KNOWN_MODELS: ModelEntry[] = [
  { value: "default", displayName: "Default" },
  { value: "opus", displayName: "Opus" },
  { value: "sonnet", displayName: "Sonnet" },
  { value: "haiku", displayName: "Haiku" },
];

var warmupModels: ModelEntry[] = [];
var warmupSlashCommands: string[] = [];
var warmupAccountInfo: AccountInfo | null = null;
var warmupComplete = false;

interface WarmupRateLimitEntry {
  status: string;
  utilization?: number;
  resetsAt?: number;
  rateLimitType?: string;
  overageStatus?: string;
  overageResetsAt?: number;
  isUsingOverage?: boolean;
}

var warmupRateLimits: Map<string, WarmupRateLimitEntry> = new Map();

function ensureKnownModels(sdkModels: ModelEntry[]): ModelEntry[] {
  var seen = new Set<string>();
  for (var i = 0; i < sdkModels.length; i++) {
    seen.add(sdkModels[i].value);
  }
  var result = sdkModels.slice();
  for (var j = 0; j < KNOWN_MODELS.length; j++) {
    if (!seen.has(KNOWN_MODELS[j].value)) {
      result.push(KNOWN_MODELS[j]);
    }
  }
  return result;
}

function deleteWarmupSession(cwd: string, sessionId: string | null): void {
  if (!sessionId) return;
  try {
    var hash = cwd.replace(/\//g, "-");
    var projectDir = join(homedir(), ".claude", "projects", hash);
    var jsonlPath = join(projectDir, sessionId + ".jsonl");
    var dirPath = join(projectDir, sessionId);
    if (existsSync(jsonlPath)) {
      unlinkSync(jsonlPath);
      log.server("Deleted warmup session file: %s", sessionId);
    }
    if (existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (err) {
    log.server("Failed to delete warmup session: %O", err);
  }
}

export async function runWarmup(cwd: string): Promise<void> {
  log.server("SDK warmup starting (cwd: %s)...", cwd);
  try {
    var ac = new AbortController();
    var ended = false;
    var WARMUP_SESSION_ID = "lattice-warmup";

    var mq = {
      [Symbol.asyncIterator]: function () {
        return {
          next: function () {
            if (ended) return Promise.resolve({ value: undefined as any, done: true });
            ended = true;
            return Promise.resolve({
              value: {
                type: "user" as const,
                message: { role: "user" as const, content: [{ type: "text" as const, text: "hi" }] },
                parent_tool_use_id: null,
                session_id: WARMUP_SESSION_ID,
              },
              done: false,
            });
          },
        };
      },
    };

    var stream = query({
      prompt: mq as any,
      options: {
        cwd,
        sessionId: WARMUP_SESSION_ID,
        settingSources: ["user", "project", "local"],
        abortController: ac,
        permissionMode: "plan",
        pathToClaudeCodeExecutable: getClaudeExecutablePath(),
        stderr: function (data: string) {
          log.server("Warmup stderr: %s", data.trim());
        },
      },
    });

    for await (var msg of stream) {
      if (msg.type === "system") {
        var sysMsg = msg as any;
        if (sysMsg.subtype === "init") {
          if (sysMsg.slash_commands) {
            warmupSlashCommands = sysMsg.slash_commands;
          }

          try {
            var models = await stream.supportedModels();
            warmupModels = ensureKnownModels((models || []) as ModelEntry[]);
          } catch {
            warmupModels = KNOWN_MODELS.slice();
          }

          try {
            warmupAccountInfo = await stream.accountInfo();
          } catch {}

          ac.abort();
          break;
        }
      }

      if (msg.type === "rate_limit_event") {
        var rlMsg = msg as { type: string; rate_limit_info: { status: string; utilization?: number; resetsAt?: number; rateLimitType?: string; overageStatus?: string; overageResetsAt?: number; isUsingOverage?: boolean } };
        var rli = rlMsg.rate_limit_info;
        var cacheKey = rli.rateLimitType || "default";
        warmupRateLimits.set(cacheKey, {
          status: rli.status,
          utilization: rli.utilization,
          resetsAt: rli.resetsAt,
          rateLimitType: rli.rateLimitType,
          overageStatus: rli.overageStatus,
          overageResetsAt: rli.overageResetsAt,
          isUsingOverage: rli.isUsingOverage,
        });
        broadcast({
          type: "chat:rate_limit",
          status: rli.status,
          utilization: rli.utilization,
          resetsAt: rli.resetsAt,
          rateLimitType: rli.rateLimitType,
          overageStatus: rli.overageStatus,
          overageResetsAt: rli.overageResetsAt,
          isUsingOverage: rli.isUsingOverage,
        } as any);
      }
    }

    warmupComplete = true;
    deleteWarmupSession(cwd, WARMUP_SESSION_ID);
    log.server("SDK warmup complete: %d models, %d commands, auth=%s",
      warmupModels.length, warmupSlashCommands.length,
      warmupAccountInfo?.apiKeySource || "unknown");
    if (warmupAccountInfo) {
      log.server("Account: email=%s org=%s subscription=%s provider=%s source=%s",
        warmupAccountInfo.email || "none",
        warmupAccountInfo.organization || "none",
        warmupAccountInfo.subscriptionType || "none",
        warmupAccountInfo.apiProvider || "none",
        warmupAccountInfo.apiKeySource || "none");
    }

    broadcast({
      type: "warmup:models",
      models: warmupModels,
    } as any);

    if (warmupAccountInfo) {
      broadcast({
        type: "warmup:account",
        email: warmupAccountInfo.email,
        organization: warmupAccountInfo.organization,
        subscriptionType: warmupAccountInfo.subscriptionType,
        apiKeySource: warmupAccountInfo.apiKeySource,
        apiProvider: warmupAccountInfo.apiProvider,
      } as any);
    }

    void warmupProjectData();
  } catch (err) {
    if (err && (err as any).name !== "AbortError" && !(err instanceof Error && err.message.includes("aborted"))) {
      log.server("SDK warmup failed: %O", err);
    }
    warmupModels = KNOWN_MODELS.slice();
    warmupComplete = true;
    void warmupProjectData();
  }
}

async function warmupProjectData(): Promise<void> {
  var t0 = Date.now();
  var config = loadConfig();
  var projects = config.projects;
  if (projects.length === 0) return;

  log.server("Data warmup: pre-caching %d project(s)...", projects.length);

  var totalSessions = 0;
  var recentSessionIds: Array<{ projectSlug: string; sessionId: string }> = [];

  for (var i = 0; i < projects.length; i++) {
    try {
      var result = await listSessions(projects[i].slug, { limit: 40 });
      totalSessions += result.sessions.length;
      broadcast({
        type: "session:list",
        projectSlug: projects[i].slug,
        sessions: result.sessions,
        totalCount: result.totalCount,
      } as any);
      var preWarmCount = Math.min(5, result.sessions.length);
      for (var k = 0; k < preWarmCount; k++) {
        recentSessionIds.push({
          projectSlug: projects[i].slug,
          sessionId: result.sessions[k].id,
        });
      }
    } catch {}
  }

  log.server("Data warmup: cached %d sessions across %d projects (%dms)", totalSessions, projects.length, Date.now() - t0);

  for (var j = 0; j < recentSessionIds.length; j++) {
    try {
      await loadSessionHistory(recentSessionIds[j].projectSlug, recentSessionIds[j].sessionId);
    } catch {}
  }
  if (recentSessionIds.length > 0) {
    log.server("Data warmup: pre-cached history for %d recent sessions (%dms)", recentSessionIds.length, Date.now() - t0);
  }
}

export function getWarmupModels(): ModelEntry[] {
  return warmupModels.length > 0 ? warmupModels : KNOWN_MODELS.slice();
}

export function getWarmupSlashCommands(): string[] {
  return warmupSlashCommands;
}

export function getWarmupAccountInfo(): AccountInfo | null {
  return warmupAccountInfo;
}

export function getWarmupRateLimits(): WarmupRateLimitEntry[] {
  return Array.from(warmupRateLimits.values());
}

export function cacheRateLimitEntry(entry: WarmupRateLimitEntry): void {
  var key = entry.rateLimitType || "default";
  warmupRateLimits.set(key, entry);
}

export function isWarmupComplete(): boolean {
  return warmupComplete;
}
