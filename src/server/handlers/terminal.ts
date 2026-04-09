import type { ClientMessage, TerminalCreateMessage, TerminalInputMessage, TerminalResizeMessage } from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { createTerminal, destroyTerminal, writeToTerminal, resizeTerminal } from "../project/terminal";
import { getActiveSession } from "./chat";
import { getProjectBySlug } from "../project/registry";
import { homedir } from "node:os";

const clientTerminals = new Map<string, Set<string>>();

function getOrCreateClientSet(clientId: string): Set<string> {
  let set = clientTerminals.get(clientId);
  if (!set) {
    set = new Set<string>();
    clientTerminals.set(clientId, set);
  }
  return set;
}

export function cleanupClientTerminals(clientId: string): void {
  const set = clientTerminals.get(clientId);
  if (set) {
    set.forEach(function(termId) {
      destroyTerminal(termId);
    });
    clientTerminals.delete(clientId);
  }
}

registerHandler("terminal", function(clientId: string, message: ClientMessage) {
  if (message.type === "terminal:create") {
    const createMsg = message as TerminalCreateMessage;
    let cwd = homedir();

    if (createMsg.projectSlug) {
      const slugProject = getProjectBySlug(createMsg.projectSlug);
      if (slugProject) {
        cwd = slugProject.path;
      }
    } else {
      const active = getActiveSession(clientId);
      if (active) {
        const project = getProjectBySlug(active.projectSlug);
        if (project) {
          cwd = project.path;
        }
      }
    }

    const termId = createTerminal(
      cwd,
      function(data: string) {
        sendTo(clientId, { type: "terminal:output", termId: termId, data: data });
      },
      function(code: number) {
        sendTo(clientId, { type: "terminal:exited", termId: termId, code: code });
        getOrCreateClientSet(clientId).delete(termId);
      },
    );

    getOrCreateClientSet(clientId).add(termId);
    sendTo(clientId, { type: "terminal:created", termId: termId });
    return;
  }

  if (message.type === "terminal:input") {
    const inputMsg = message as TerminalInputMessage;
    const clientSet = clientTerminals.get(clientId);
    if (!clientSet || !clientSet.has(inputMsg.termId)) {
      return;
    }
    if (typeof inputMsg.data === "string" && inputMsg.data.length > 65536) {
      return;
    }
    writeToTerminal(inputMsg.termId, inputMsg.data);
    return;
  }

  if (message.type === "terminal:resize") {
    const resizeMsg = message as TerminalResizeMessage;
    const resizeClientSet = clientTerminals.get(clientId);
    if (!resizeClientSet || !resizeClientSet.has(resizeMsg.termId)) {
      return;
    }
    resizeTerminal(resizeMsg.termId, resizeMsg.cols, resizeMsg.rows);
    return;
  }
});
