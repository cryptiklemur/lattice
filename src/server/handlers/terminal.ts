import type { ClientMessage, TerminalCreateMessage, TerminalInputMessage, TerminalResizeMessage } from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { createTerminal, destroyTerminal, writeToTerminal, resizeTerminal } from "../project/terminal";
import { getActiveSession } from "./chat";
import { getProjectBySlug } from "../project/registry";
import { homedir } from "node:os";

var clientTerminals = new Map<string, Set<string>>();

function getOrCreateClientSet(clientId: string): Set<string> {
  var set = clientTerminals.get(clientId);
  if (!set) {
    set = new Set<string>();
    clientTerminals.set(clientId, set);
  }
  return set;
}

export function cleanupClientTerminals(clientId: string): void {
  var set = clientTerminals.get(clientId);
  if (set) {
    set.forEach(function(termId) {
      destroyTerminal(termId);
    });
    clientTerminals.delete(clientId);
  }
}

registerHandler("terminal", function(clientId: string, message: ClientMessage) {
  if (message.type === "terminal:create") {
    var createMsg = message as TerminalCreateMessage;
    var cwd = homedir();

    if (createMsg.projectSlug) {
      var slugProject = getProjectBySlug(createMsg.projectSlug);
      if (slugProject) {
        cwd = slugProject.path;
      }
    } else {
      var active = getActiveSession(clientId);
      if (active) {
        var project = getProjectBySlug(active.projectSlug);
        if (project) {
          cwd = project.path;
        }
      }
    }

    var termId = createTerminal(
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
    var inputMsg = message as TerminalInputMessage;
    var clientSet = clientTerminals.get(clientId);
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
    var resizeMsg = message as TerminalResizeMessage;
    var resizeClientSet = clientTerminals.get(clientId);
    if (!resizeClientSet || !resizeClientSet.has(resizeMsg.termId)) {
      return;
    }
    resizeTerminal(resizeMsg.termId, resizeMsg.cols, resizeMsg.rows);
    return;
  }
});
