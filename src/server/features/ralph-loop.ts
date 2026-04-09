import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage, SDKPartialAssistantMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { broadcast } from "../ws/broadcast";
import { getProjectBySlug } from "../project/registry";
import type { LoopStatus } from "#shared";

const activeLoops = new Map<string, LoopStatus>();

function readLoopFile(projectPath: string, filename: string): string | null {
  const loopsDir = join(projectPath, ".claude", "loops");
  const filePath = join(loopsDir, filename);
  if (!existsSync(filePath)) {
    return null;
  }
  return readFileSync(filePath, "utf-8");
}

async function runIteration(
  loopId: string,
  prompt: string,
  cwd: string,
  iterationNum: number
): Promise<string> {
  let accumulated = "";

  const stream = query({ prompt, options: { cwd, allowedTools: ["*"], permissionMode: "acceptEdits" } });

  for await (const msg of stream) {
    const typedMsg = msg as SDKMessage;
    if (typedMsg.type === "stream_event") {
      const partial = typedMsg as SDKPartialAssistantMessage;
      const evt = partial.event;
      if (evt.type === "content_block_delta") {
        const deltaEvt = evt as { delta: { type: string; text?: string } };
        if (deltaEvt.delta.type === "text_delta" && typeof deltaEvt.delta.text === "string") {
          accumulated += deltaEvt.delta.text;
          broadcast({ type: "loop:delta", loopId, iteration: iterationNum, text: deltaEvt.delta.text });
        }
      }
    }
  }

  return accumulated;
}

async function runJudge(
  judgePrompt: string,
  iterationResult: string,
  cwd: string
): Promise<{ pass: boolean; reason: string }> {
  const fullPrompt = `${judgePrompt}\n\n<iteration_result>\n${iterationResult}\n</iteration_result>\n\nRespond with PASS or FAIL on the first line, followed by a brief reason.`;
  let accumulated = "";

  const stream = query({ prompt: fullPrompt, options: { cwd, allowedTools: [], permissionMode: "acceptEdits" } });

  for await (const msg of stream) {
    const typedMsg = msg as SDKMessage;
    if (typedMsg.type === "stream_event") {
      const partial = typedMsg as SDKPartialAssistantMessage;
      const evt = partial.event;
      if (evt.type === "content_block_delta") {
        const deltaEvt = evt as { delta: { type: string; text?: string } };
        if (deltaEvt.delta.type === "text_delta" && typeof deltaEvt.delta.text === "string") {
          accumulated += deltaEvt.delta.text;
        }
      }
    }
  }

  const firstLine = accumulated.trim().split("\n")[0].toUpperCase();
  const pass = firstLine.startsWith("PASS");
  const reason = accumulated.trim().split("\n").slice(1).join("\n").trim() || accumulated.trim();

  return { pass, reason };
}

export function startLoop(projectSlug: string): LoopStatus | null {
  const project = getProjectBySlug(projectSlug);
  if (!project) {
    return null;
  }

  const prompt = readLoopFile(project.path, "PROMPT.md");
  if (!prompt) {
    return null;
  }

  const loopId = "loop_" + Date.now() + "_" + randomBytes(3).toString("hex");
  const loopStatus: LoopStatus = {
    id: loopId,
    projectSlug,
    status: "running",
    iteration: 0,
    maxIterations: 20,
    judgeReason: null,
    startedAt: Date.now(),
    finishedAt: null,
  };

  activeLoops.set(loopId, loopStatus);
  broadcast({ type: "loop:started", loop: loopStatus });

  void (async function () {
    const judgePrompt = readLoopFile(project.path, "JUDGE.md");

    for (let i = 1; i <= loopStatus.maxIterations; i++) {
      const current = activeLoops.get(loopId);
      if (!current || current.status === "stopped") {
        break;
      }

      current.iteration = i;
      activeLoops.set(loopId, current);
      broadcast({ type: "loop:status_update", loop: { ...current } });

      try {
        const result = await runIteration(loopId, prompt, project.path, i);

        if (judgePrompt) {
          const judgment = await runJudge(judgePrompt, result, project.path);
          current.judgeReason = judgment.reason;
          activeLoops.set(loopId, current);

          if (judgment.pass) {
            current.status = "done";
            current.finishedAt = Date.now();
            activeLoops.set(loopId, current);
            broadcast({ type: "loop:status_update", loop: { ...current } });
            break;
          }
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[ralph-loop] Iteration ${i} error:`, errMsg);
        current.status = "error";
        current.judgeReason = errMsg;
        current.finishedAt = Date.now();
        activeLoops.set(loopId, current);
        broadcast({ type: "loop:status_update", loop: { ...current } });
        return;
      }
    }

    const final = activeLoops.get(loopId);
    if (final && final.status === "running") {
      final.status = "done";
      final.finishedAt = Date.now();
      activeLoops.set(loopId, final);
      broadcast({ type: "loop:status_update", loop: { ...final } });
    }
  })();

  return loopStatus;
}

export function stopLoop(loopId: string): boolean {
  const loop = activeLoops.get(loopId);
  if (!loop || loop.status !== "running") {
    return false;
  }
  loop.status = "stopped";
  loop.finishedAt = Date.now();
  activeLoops.set(loopId, loop);
  broadcast({ type: "loop:status_update", loop: { ...loop } });
  return true;
}

export function getLoopStatus(loopId: string): LoopStatus | null {
  return activeLoops.get(loopId) ?? null;
}
