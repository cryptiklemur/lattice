import type {
  ClientMessage,
  SpecsListMessage,
  SpecsGetMessage,
  SpecsCreateMessage,
  SpecsUpdateMessage,
  SpecsDeleteMessage,
  SpecsLinkSessionMessage,
  SpecsUnlinkSessionMessage,
  SpecsActivityMessage,
  SpecsCreateWithBrainstormMessage,
  SpecsStartPlanMessage,
  SpecsStartExecuteMessage,
} from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo, broadcastToProject } from "../ws/broadcast";
import {
  listSpecs,
  getSpec,
  createSpec,
  updateSpec,
  deleteSpec,
  linkSession,
  unlinkSession,
  addActivity,
} from "../features/specs";
import { createSession, updateSessionInIndex } from "../project/session";
import { buildBrainstormPrompt, buildWritePlanPrompt, buildExecutePrompt } from "../features/superpowers";

registerHandler("specs", function (clientId: string, message: ClientMessage) {
  if (message.type === "specs:list") {
    var listMsg = message as SpecsListMessage;
    sendTo(clientId, { type: "specs:list_result", specs: listSpecs(listMsg.projectSlug) });
    return;
  }

  if (message.type === "specs:get") {
    var getMsg = message as SpecsGetMessage;
    var spec = getSpec(getMsg.id);
    if (!spec) {
      sendTo(clientId, { type: "chat:error", message: "Spec not found" });
      return;
    }
    sendTo(clientId, { type: "specs:get_result", spec });
    return;
  }

  if (message.type === "specs:create") {
    var createMsg = message as SpecsCreateMessage;
    var created = createSpec({
      projectSlug: createMsg.projectSlug,
      title: createMsg.title,
      tagline: createMsg.tagline,
      author: createMsg.author,
      priority: createMsg.priority,
      estimatedEffort: createMsg.estimatedEffort,
      tags: createMsg.tags,
    });
    broadcastToProject(created.projectSlug, { type: "specs:created", spec: created });
    return;
  }

  if (message.type === "specs:create-with-brainstorm") {
    var brainstormMsg = message as SpecsCreateWithBrainstormMessage;
    var slug = brainstormMsg.projectSlug;
    var newSpec = createSpec({ projectSlug: slug, title: "New Spec" });
    var brainstormSession = createSession(slug, "brainstorm");
    updateSessionInIndex(slug, brainstormSession);
    linkSession(newSpec.id, brainstormSession.id, "Brainstorm session", "brainstorm");
    var brainstormPrompt = buildBrainstormPrompt(newSpec, slug);
    sendTo(clientId, {
      type: "specs:brainstorm-started",
      spec: newSpec,
      sessionId: brainstormSession.id,
      systemPrompt: { type: "preset", preset: "claude_code", append: brainstormPrompt },
    });
    broadcastToProject(slug, { type: "specs:created", spec: newSpec });
    return;
  }

  if (message.type === "specs:start-plan") {
    var planMsg = message as SpecsStartPlanMessage;
    var planSpec = getSpec(planMsg.specId);
    if (!planSpec) {
      sendTo(clientId, { type: "chat:error", message: "Spec not found" });
      return;
    }
    var planSession = createSession(planMsg.projectSlug, "write-plan");
    updateSessionInIndex(planMsg.projectSlug, planSession);
    linkSession(planSpec.id, planSession.id, "Write plan session", "write-plan");
    var planPrompt = buildWritePlanPrompt(planSpec, planMsg.projectSlug);
    sendTo(clientId, {
      type: "specs:plan-started",
      spec: planSpec,
      sessionId: planSession.id,
      systemPrompt: { type: "preset", preset: "claude_code", append: planPrompt },
    });
    return;
  }

  if (message.type === "specs:start-execute") {
    var execMsg = message as SpecsStartExecuteMessage;
    var execSpec = getSpec(execMsg.specId);
    if (!execSpec) {
      sendTo(clientId, { type: "chat:error", message: "Spec not found" });
      return;
    }
    var execSession = createSession(execMsg.projectSlug, "execute");
    updateSessionInIndex(execMsg.projectSlug, execSession);
    linkSession(execSpec.id, execSession.id, "Execute session", "execute");
    var execPrompt = buildExecutePrompt(execSpec, execMsg.projectSlug);
    sendTo(clientId, {
      type: "specs:execute-started",
      spec: execSpec,
      sessionId: execSession.id,
      systemPrompt: { type: "preset", preset: "claude_code", append: execPrompt },
    });
    return;
  }

  if (message.type === "specs:update") {
    var updateMsg = message as SpecsUpdateMessage;
    var updated = updateSpec(updateMsg.id, {
      title: updateMsg.title,
      tagline: updateMsg.tagline,
      status: updateMsg.status,
      priority: updateMsg.priority,
      estimatedEffort: updateMsg.estimatedEffort,
      author: updateMsg.author,
      tags: updateMsg.tags,
      requires: updateMsg.requires,
      blockedBy: updateMsg.blockedBy,
      sections: updateMsg.sections,
    });
    if (!updated) {
      sendTo(clientId, { type: "chat:error", message: "Spec not found" });
      return;
    }
    broadcastToProject(updated.projectSlug, { type: "specs:updated", spec: updated });
    return;
  }

  if (message.type === "specs:delete") {
    var deleteMsg = message as SpecsDeleteMessage;
    var toDelete = getSpec(deleteMsg.id);
    if (!toDelete) {
      sendTo(clientId, { type: "chat:error", message: "Spec not found" });
      return;
    }
    deleteSpec(deleteMsg.id);
    broadcastToProject(toDelete.projectSlug, { type: "specs:deleted", id: deleteMsg.id });
    return;
  }

  if (message.type === "specs:link-session") {
    var linkMsg = message as SpecsLinkSessionMessage;
    var linked = linkSession(linkMsg.id, linkMsg.sessionId, linkMsg.note);
    if (!linked) {
      sendTo(clientId, { type: "chat:error", message: "Spec not found" });
      return;
    }
    broadcastToProject(linked.projectSlug, { type: "specs:session_linked", spec: linked });
    return;
  }

  if (message.type === "specs:unlink-session") {
    var unlinkMsg = message as SpecsUnlinkSessionMessage;
    var unlinked = unlinkSession(unlinkMsg.id, unlinkMsg.sessionId);
    if (!unlinked) {
      sendTo(clientId, { type: "chat:error", message: "Spec not found" });
      return;
    }
    broadcastToProject(unlinked.projectSlug, { type: "specs:session_unlinked", spec: unlinked });
    return;
  }

  if (message.type === "specs:activity") {
    var actMsg = message as SpecsActivityMessage;
    var withActivity = addActivity(actMsg.id, actMsg.activityType, actMsg.detail, actMsg.sessionId);
    if (!withActivity) {
      sendTo(clientId, { type: "chat:error", message: "Spec not found" });
      return;
    }
    broadcastToProject(withActivity.projectSlug, { type: "specs:activity_added", spec: withActivity });
    return;
  }
});
