import { encodingForModel } from "js-tiktoken";
import { existsSync, readFileSync, readdirSync, openSync, readSync, fstatSync, closeSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ContextBreakdownSegment } from "#shared";
import { guessContextWindow } from "./session";
import { loadConfig } from "../config";
import { getInstalledPluginCount, getPluginSkillRuleTokenEstimate } from "../handlers/plugins";

const encoder = encodingForModel("gpt-4o");

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
    const files = readdirSync(dirPath, { withFileTypes: true });
    let content = "";
    for (let i = 0; i < files.length; i++) {
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
  const config = loadConfig();
  const project = config.projects.find(function (p: typeof config.projects[number]) { return p.slug === projectSlug; });
  return project ? project.path : null;
}

// Known built-in Claude Code tools with approximate per-tool token counts
// These are the tool definitions sent in every API request
const BUILTIN_TOOLS: Record<string, number> = {
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
const MCP_TOOL_AVG_TOKENS = 250;

interface ToolCounts {
  builtinTools: string[];
  mcpTools: Map<string, string[]>; // server name -> tool names
}

function extractToolsFromSession(lines: string[]): ToolCounts {
  const builtinSet = new Set<string>();
  const mcpMap = new Map<string, Set<string>>();

  // First: check compact boundary metadata for preCompactDiscoveredTools
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || !line.includes("compactMetadata")) continue;
    try {
      const parsed = JSON.parse(line);
      const tools = parsed.compactMetadata?.preCompactDiscoveredTools;
      if (Array.isArray(tools)) {
        for (let t = 0; t < tools.length; t++) {
          categorizeToolName(tools[t], builtinSet, mcpMap);
        }
      }
    } catch {}
  }

  // Second: scan tool_use blocks from assistant messages for any we missed
  for (let j = 0; j < lines.length; j++) {
    const aLine = lines[j].trim();
    if (!aLine || !aLine.includes("tool_use")) continue;
    try {
      const aParsed = JSON.parse(aLine);
      if (aParsed.type === "assistant" && aParsed.message && Array.isArray(aParsed.message.content)) {
        for (let k = 0; k < aParsed.message.content.length; k++) {
          const block = aParsed.message.content[k];
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
    const parts = name.split("__");
    const serverName = parts[1] || "unknown";
    if (!mcpMap.has(serverName)) {
      mcpMap.set(serverName, new Set());
    }
    mcpMap.get(serverName)!.add(name);
  } else {
    builtinSet.add(name);
  }
}

function estimateBuiltinToolTokens(toolNames: string[]): number {
  let total = 0;
  for (let i = 0; i < toolNames.length; i++) {
    total += BUILTIN_TOOLS[toolNames[i]] || 300;
  }
  // Also include tools that are always sent but might not appear in usage
  const knownKeys = Object.keys(BUILTIN_TOOLS);
  for (let j = 0; j < knownKeys.length; j++) {
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
  const projectPath = getProjectPath(projectSlug);
  if (!projectPath) return null;

  const home = homedir();
  const hash = projectPathToHash(projectPath);
  const sessionFile = join(home, ".claude", "projects", hash, sessionId + ".jsonl");
  if (!existsSync(sessionFile)) return null;

  // Read instruction files
  const globalClaudeMd = readFileSafe(join(home, ".claude", "CLAUDE.md"));
  const globalRulesContent = readDirFiles(join(home, ".claude", "rules"));
  const projectClaudeMd = readFileSafe(join(projectPath, "CLAUDE.md"));
  const projectLocalClaudeMd = readFileSafe(join(home, ".claude", "projects", hash, "CLAUDE.md"));

  const memoryContent = readDirFiles(join(home, ".claude", "projects", hash, "memory"));
  const memoryIndex = readFileSafe(join(home, ".claude", "projects", hash, "MEMORY.md"));

  const instructionsTokens = countTokens(globalClaudeMd + globalRulesContent + projectClaudeMd + projectLocalClaudeMd);
  const memoryTokens = countTokens(memoryContent + memoryIndex);

  // Parse session — read last 2MB for recent context (avoids reading 35MB+ files)
  const fd = openSync(sessionFile, "r");
  const fileStat = fstatSync(fd);
  const readSize = Math.min(fileStat.size, 2 * 1024 * 1024);
  const readBuf = Buffer.alloc(readSize);
  readSync(fd, readBuf, 0, readSize, fileStat.size - readSize);
  closeSync(fd);
  const content = readBuf.toString("utf-8");
  const lines = content.split("\n").filter(function (l) { return l.length > 0; });

  // Extract tool info
  const toolCounts = extractToolsFromSession(lines);
  const builtinToolTokens = estimateBuiltinToolTokens(toolCounts.builtinTools);

  // Parse conversation messages
  let userText = "";
  let assistantText = "";
  let toolResultText = "";
  let contextWindow = 0;
  let lastModel = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed.type === "user" && parsed.message) {
        const userContent = parsed.message.content;
        if (typeof userContent === "string") {
          userText += userContent + "\n";
        } else if (Array.isArray(userContent)) {
          for (let j = 0; j < userContent.length; j++) {
            const block = userContent[j];
            if (block.type === "text" && block.text) {
              userText += block.text + "\n";
            } else if (block.type === "tool_result") {
              if (typeof block.content === "string") {
                toolResultText += block.content + "\n";
              } else if (Array.isArray(block.content)) {
                for (let ri = 0; ri < block.content.length; ri++) {
                  if (block.content[ri].type === "text" && block.content[ri].text) {
                    toolResultText += block.content[ri].text + "\n";
                  }
                }
              }
            }
          }
        }
      } else if (parsed.type === "assistant" && parsed.message) {
        const aContent = parsed.message.content;
        if (typeof aContent === "string") {
          assistantText += aContent + "\n";
        } else if (Array.isArray(aContent)) {
          for (let k = 0; k < aContent.length; k++) {
            const ab = aContent[k];
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

  const userTokens = countTokens(userText);
  const assistantTokens = countTokens(assistantText);
  const toolResultTokens = countTokens(toolResultText);
  contextWindow = guessContextWindow(lastModel);

  const autocompactAt = Math.round(contextWindow * 0.9);
  const systemPromptEstimate = 4500;

  const segments: ContextBreakdownSegment[] = [
    { label: "System prompt", tokens: systemPromptEstimate, id: "system", estimated: true },
    { label: "Built-in tools (" + Object.keys(BUILTIN_TOOLS).length + ")", tokens: builtinToolTokens, id: "builtin_tools", estimated: true },
  ];

  // Add per-MCP-server segments
  toolCounts.mcpTools.forEach(function (tools, serverName) {
    const mcpTokens = tools.length * MCP_TOOL_AVG_TOKENS;
    segments.push({
      label: serverName + " (" + tools.length + " tools)",
      tokens: mcpTokens,
      id: "mcp_" + serverName,
      estimated: true,
    });
  });

  const pluginCount = getInstalledPluginCount();
  if (pluginCount > 0) {
    const pluginTokens = getPluginSkillRuleTokenEstimate();
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
