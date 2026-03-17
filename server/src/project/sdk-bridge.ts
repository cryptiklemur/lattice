import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage, SDKPartialAssistantMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { sendTo } from "../ws/broadcast";
import { appendToSession } from "./session";

export interface ChatStreamOptions {
  projectSlug: string;
  sessionId: string;
  text: string;
  clientId: string;
  cwd: string;
  env?: Record<string, string>;
  model?: string;
  effort?: "low" | "medium" | "high" | "max";
}

export interface ModelEntry {
  value: string;
  displayName: string;
}

var KNOWN_MODELS: ModelEntry[] = [
  { value: "default", displayName: "Default" },
  { value: "sonnet", displayName: "Sonnet" },
  { value: "haiku", displayName: "Haiku" },
  { value: "opus", displayName: "Opus" },
  { value: "claude-sonnet-4-20250514", displayName: "Claude Sonnet 4" },
  { value: "claude-opus-4-20250514", displayName: "Claude Opus 4" },
  { value: "claude-3-5-sonnet-20241022", displayName: "Claude 3.5 Sonnet" },
  { value: "claude-3-5-haiku-20241022", displayName: "Claude 3.5 Haiku" },
];

export function getAvailableModels(): ModelEntry[] {
  return KNOWN_MODELS.slice();
}

export function startChatStream(options: ChatStreamOptions): void {
  var { projectSlug, sessionId, text, clientId, cwd, env, model, effort } = options;
  var startTime = Date.now();

  var queryOptions: Parameters<typeof query>[0]["options"] = {
    cwd,
    allowedTools: ["*"],
    permissionMode: "acceptEdits",
  };

  if (model && model !== "default") {
    queryOptions.model = model;
  }

  if (effort) {
    queryOptions.effort = effort;
  }

  if (env) {
    queryOptions.env = env;
  }

  appendToSession(projectSlug, sessionId, {
    type: "user",
    text,
    timestamp: Date.now(),
  });

  sendTo(clientId, {
    type: "chat:user_message",
    text,
    uuid: crypto.randomUUID(),
  });

  var activeToolBlocks: Record<number, { id: string; name: string; inputJson: string }> = {};

  var stream = query({ prompt: text, options: queryOptions });

  void (async function () {
    try {
      for await (var msg of stream) {
        processMessage(msg);
      }
    } catch (err: unknown) {
      var errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[lattice] SDK stream error: ${errMsg}`);
      sendTo(clientId, { type: "chat:error", message: errMsg });
      appendToSession(projectSlug, sessionId, {
        type: "error",
        text: errMsg,
        timestamp: Date.now(),
      });
    }
  })();

  function processMessage(msg: SDKMessage): void {
    if (msg.type === "stream_event") {
      var partial = msg as SDKPartialAssistantMessage;
      var evt = partial.event;

      if (evt.type === "content_block_start") {
        var block = (evt as { content_block: { type: string; id?: string; name?: string }; index: number }).content_block;
        var idx = (evt as { index: number }).index;
        if (block.type === "tool_use" && block.id && block.name) {
          activeToolBlocks[idx] = { id: block.id, name: block.name, inputJson: "" };
          sendTo(clientId, {
            type: "chat:tool_start",
            toolId: block.id,
            name: block.name,
            args: "",
          });
          appendToSession(projectSlug, sessionId, {
            type: "tool_start",
            toolId: block.id,
            name: block.name,
            args: "",
            timestamp: Date.now(),
          });
        }
        return;
      }

      if (evt.type === "content_block_delta") {
        var deltaEvt = evt as { index: number; delta: { type: string; text?: string; partial_json?: string } };
        var blockIdx = deltaEvt.index;

        if (deltaEvt.delta.type === "text_delta" && typeof deltaEvt.delta.text === "string") {
          sendTo(clientId, { type: "chat:delta", text: deltaEvt.delta.text });
          appendToSession(projectSlug, sessionId, {
            type: "delta",
            text: deltaEvt.delta.text,
            timestamp: Date.now(),
          });
        } else if (deltaEvt.delta.type === "input_json_delta" && activeToolBlocks[blockIdx]) {
          activeToolBlocks[blockIdx].inputJson += deltaEvt.delta.partial_json || "";
          var updatedTool = activeToolBlocks[blockIdx];
          sendTo(clientId, {
            type: "chat:tool_start",
            toolId: updatedTool.id,
            name: updatedTool.name,
            args: updatedTool.inputJson,
          });
        }
        return;
      }

      if (evt.type === "content_block_stop") {
        var stopIdx = (evt as { index: number }).index;
        delete activeToolBlocks[stopIdx];
        return;
      }

      return;
    }

    if (msg.type === "user") {
      var userMsg = msg as { type: "user"; message: { content: unknown }; tool_use_result?: unknown };
      var content = userMsg.message.content;
      if (Array.isArray(content)) {
        for (var i = 0; i < content.length; i++) {
          var item = content[i] as { type?: string; tool_use_id?: string; content?: unknown };
          if (item.type === "tool_result" && item.tool_use_id) {
            var resultContent = typeof item.content === "string"
              ? item.content
              : JSON.stringify(item.content ?? "");
            sendTo(clientId, {
              type: "chat:tool_result",
              toolId: item.tool_use_id,
              content: resultContent,
            });
            appendToSession(projectSlug, sessionId, {
              type: "tool_result",
              toolId: item.tool_use_id,
              content: resultContent,
              timestamp: Date.now(),
            });
          }
        }
      }
      return;
    }

    if (msg.type === "result") {
      var resultMsg = msg as SDKResultMessage;
      var duration = Date.now() - startTime;
      var cost = resultMsg.total_cost_usd || 0;
      sendTo(clientId, { type: "chat:done", cost, duration });
      appendToSession(projectSlug, sessionId, {
        type: "done",
        timestamp: Date.now(),
      });
      return;
    }
  }
}
