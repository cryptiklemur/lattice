import { encodingForModel } from "js-tiktoken";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ContextBreakdownSegment } from "@lattice/shared";
import { guessContextWindow } from "./session";
import { loadConfig } from "../config";
import { getInstalledPluginCount, getPluginSkillRuleTokenEstimate } from "../handlers/plugins";

var encoder = encodingForModel("gpt-4o");

function countTokens(text: string): number {
  if (!text) return 0;
  return encoder.encode(text).length;
}

function readFileSafe(path: string): string {
  try {
    if (existsSync(path)) return readFileSync(path, "utf-8");
  } catch {}
  return "";
}

function readDirFiles(dirPath: string): string {
  try {
    if (!existsSync(dirPath)) return "";
    var files = readdirSync(dirPath, { withFileTypes: true });
    var content = "";
    for (var i = 0; i < files.length; i++) {
      if (files[i].isFile()) {
        content += readFileSafe(join(dirPath, files[i].name)) + "\n";
      }
    }
    return content;
  } catch {}
  return "";
}

function projectPathToHash(projectPath: string): string {
  return projectPath.replace(/\//g, "-");
}

function getProjectPath(projectSlug: string): string | null {
  var config = loadConfig();
  var project = config.projects.find(function (p: typeof config.projects[number]) { return p.slug === projectSlug; });
  return project ? project.path : null;
}

// Known built-in Claude Code tools with approximate per-tool token counts
// These are the tool definitions sent in every API request
var BUILTIN_TOOLS: Record<string, number> = {
  "Read": 350,
  "Write": 300,
  "Edit": 400,
  "Bash": 500,
  "Glob": 250,
  "Grep": 450,
  "Agent": 600,
  "WebFetch": 400,
  "WebSearch": 300,
  "TodoWrite": 300,
  "NotebookEdit": 350,
  "AskUserQuestion": 400,
  "Skill": 350,
  "TaskOutput": 200,
  "TaskStop": 150,
  "EnterPlanMode": 200,
  "ExitPlanMode": 150,
  "EnterWorktree": 200,
  "ExitWorktree": 150,
  "CronCreate": 250,
  "CronDelete": 200,
  "CronList": 150,
  "ToolSearch": 250,
};

// Average tokens per MCP tool definition (name + description + JSON schema)
var MCP_TOOL_AVG_TOKENS = 250;

interface ToolCounts {
  builtinTools: string[];
  mcpTools: Map<string, string[]>; // server name -> tool names
}

function extractToolsFromSession(lines: string[]): ToolCounts {
  var builtinSet = new Set<string>();
  var mcpMap = new Map<string, Set<string>>();

  // First: check compact boundary metadata for preCompactDiscoveredTools
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line || !line.includes("compactMetadata")) continue;
    try {
      var parsed = JSON.parse(line);
      var tools = parsed.compactMetadata?.preCompactDiscoveredTools;
      if (Array.isArray(tools)) {
        for (var t = 0; t < tools.length; t++) {
          categorizeToolName(tools[t], builtinSet, mcpMap);
        }
      }
    } catch {}
  }

  // Second: scan tool_use blocks from assistant messages for any we missed
  for (var j = 0; j < lines.length; j++) {
    var aLine = lines[j].trim();
    if (!aLine || !aLine.includes("tool_use")) continue;
    try {
      var aParsed = JSON.parse(aLine);
      if (aParsed.type === "assistant" && aParsed.message && Array.isArray(aParsed.message.content)) {
        for (var k = 0; k < aParsed.message.content.length; k++) {
          var block = aParsed.message.content[k];
          if (block.type === "tool_use" && block.name) {
            categorizeToolName(block.name, builtinSet, mcpMap);
          }
        }
      }
    } catch {}
  }

  // If we found no tools at all, use the default known set
  if (builtinSet.size === 0 && mcpMap.size === 0) {
    return {
      builtinTools: Object.keys(BUILTIN_TOOLS),
      mcpTools: new Map(),
    };
  }

  return {
    builtinTools: Array.from(builtinSet),
    mcpTools: new Map(Array.from(mcpMap.entries()).map(function (entry) {
      return [entry[0], Array.from(entry[1])];
    })),
  };
}

function categorizeToolName(name: string, builtinSet: Set<string>, mcpMap: Map<string, Set<string>>): void {
  if (name.startsWith("mcp__")) {
    var parts = name.split("__");
    var serverName = parts[1] || "unknown";
    if (!mcpMap.has(serverName)) {
      mcpMap.set(serverName, new Set());
    }
    mcpMap.get(serverName)!.add(name);
  } else {
    builtinSet.add(name);
  }
}

function estimateBuiltinToolTokens(toolNames: string[]): number {
  var total = 0;
  for (var i = 0; i < toolNames.length; i++) {
    total += BUILTIN_TOOLS[toolNames[i]] || 300;
  }
  // Also include tools that are always sent but might not appear in usage
  var knownKeys = Object.keys(BUILTIN_TOOLS);
  for (var j = 0; j < knownKeys.length; j++) {
    if (toolNames.indexOf(knownKeys[j]) === -1) {
      total += BUILTIN_TOOLS[knownKeys[j]];
    }
  }
  return total;
}

export interface ContextBreakdownResult {
  segments: ContextBreakdownSegment[];
  contextWindow: number;
  autocompactAt: number;
}

export async function getContextBreakdown(projectSlug: string, sessionId: string): Promise<ContextBreakdownResult | null> {
  var projectPath = getProjectPath(projectSlug);
  if (!projectPath) return null;

  var home = homedir();
  var hash = projectPathToHash(projectPath);
  var sessionFile = join(home, ".claude", "projects", hash, sessionId + ".jsonl");
  if (!existsSync(sessionFile)) return null;

  // Read instruction files
  var globalClaudeMd = readFileSafe(join(home, ".claude", "CLAUDE.md"));
  var globalRulesContent = readDirFiles(join(home, ".claude", "rules"));
  var projectClaudeMd = readFileSafe(join(projectPath, "CLAUDE.md"));
  var projectLocalClaudeMd = readFileSafe(join(home, ".claude", "projects", hash, "CLAUDE.md"));

  var memoryContent = readDirFiles(join(home, ".claude", "projects", hash, "memory"));
  var memoryIndex = readFileSafe(join(home, ".claude", "projects", hash, "MEMORY.md"));

  var instructionsTokens = countTokens(globalClaudeMd + globalRulesContent + projectClaudeMd + projectLocalClaudeMd);
  var memoryTokens = countTokens(memoryContent + memoryIndex);

  // Parse session — read last 2MB for recent context (avoids reading 35MB+ files)
  var { openSync, readSync: fsReadSync, fstatSync: fsFstatSync, closeSync: fsCloseSync } = require("node:fs") as typeof import("node:fs");
  var fd = openSync(sessionFile, "r");
  var fileStat = fsFstatSync(fd);
  var readSize = Math.min(fileStat.size, 2 * 1024 * 1024);
  var readBuf = Buffer.alloc(readSize);
  fsReadSync(fd, readBuf, 0, readSize, fileStat.size - readSize);
  fsCloseSync(fd);
  var content = readBuf.toString("utf-8");
  var lines = content.split("\n").filter(function (l) { return l.length > 0; });

  // Extract tool info
  var toolCounts = extractToolsFromSession(lines);
  var builtinToolTokens = estimateBuiltinToolTokens(toolCounts.builtinTools);

  // Parse conversation messages
  var userText = "";
  var assistantText = "";
  var toolResultText = "";
  var contextWindow = 0;
  var lastModel = "";

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    try {
      var parsed = JSON.parse(line);
      if (parsed.type === "user" && parsed.message) {
        var userContent = parsed.message.content;
        if (typeof userContent === "string") {
          userText += userContent + "\n";
        } else if (Array.isArray(userContent)) {
          for (var j = 0; j < userContent.length; j++) {
            var block = userContent[j];
            if (block.type === "text" && block.text) {
              userText += block.text + "\n";
            } else if (block.type === "tool_result") {
              if (typeof block.content === "string") {
                toolResultText += block.content + "\n";
              } else if (Array.isArray(block.content)) {
                for (var ri = 0; ri < block.content.length; ri++) {
                  if (block.content[ri].type === "text" && block.content[ri].text) {
                    toolResultText += block.content[ri].text + "\n";
                  }
                }
              }
            }
          }
        }
      } else if (parsed.type === "assistant" && parsed.message) {
        var aContent = parsed.message.content;
        if (typeof aContent === "string") {
          assistantText += aContent + "\n";
        } else if (Array.isArray(aContent)) {
          for (var k = 0; k < aContent.length; k++) {
            var ab = aContent[k];
            if (ab.type === "text" && ab.text) {
              assistantText += ab.text + "\n";
            } else if (ab.type === "tool_use" && ab.input) {
              assistantText += JSON.stringify(ab.input) + "\n";
            } else if (ab.type === "thinking" && ab.thinking) {
              assistantText += ab.thinking + "\n";
            }
          }
        }
        if (parsed.message.model) {
          lastModel = parsed.message.model;
        }
      }
    } catch {}
  }

  var userTokens = countTokens(userText);
  var assistantTokens = countTokens(assistantText);
  var toolResultTokens = countTokens(toolResultText);
  contextWindow = guessContextWindow(lastModel);

  var autocompactAt = Math.round(contextWindow * 0.9);
  var systemPromptEstimate = 4500;

  var segments: ContextBreakdownSegment[] = [
    { label: "System prompt", tokens: systemPromptEstimate, id: "system", estimated: true },
    { label: "Built-in tools (" + Object.keys(BUILTIN_TOOLS).length + ")", tokens: builtinToolTokens, id: "builtin_tools", estimated: true },
  ];

  // Add per-MCP-server segments
  toolCounts.mcpTools.forEach(function (tools, serverName) {
    var mcpTokens = tools.length * MCP_TOOL_AVG_TOKENS;
    segments.push({
      label: serverName + " (" + tools.length + " tools)",
      tokens: mcpTokens,
      id: "mcp_" + serverName,
      estimated: true,
    });
  });

  var pluginCount = getInstalledPluginCount();
  if (pluginCount > 0) {
    var pluginTokens = getPluginSkillRuleTokenEstimate();
    segments.push({
      label: "Plugins (" + pluginCount + ")",
      tokens: pluginTokens,
      id: "plugins",
      estimated: true,
    });
  }

  segments.push(
    { label: "Instructions", tokens: instructionsTokens, id: "instructions", estimated: false },
    { label: "Memory", tokens: memoryTokens, id: "memory", estimated: false },
    { label: "Your messages", tokens: userTokens, id: "user", estimated: false },
    { label: "Claude responses", tokens: assistantTokens, id: "assistant", estimated: false },
    { label: "Tool results", tokens: toolResultTokens, id: "tool_results", estimated: false },
  );

  return { segments, contextWindow, autocompactAt };
}
