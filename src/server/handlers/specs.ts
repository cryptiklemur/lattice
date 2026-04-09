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
    const listMsg = message as SpecsListMessage;
    sendTo(clientId, { type: "specs:list_result", specs: listSpecs(listMsg.projectSlug) });
    return;
  }

  if (message.type === "specs:get") {
    const getMsg = message as SpecsGetMessage;
    const spec = getSpec(getMsg.id);
    if (!spec) {
      sendTo(clientId, { type: "chat:error", message: "Spec not found" });
      return;
    }
    sendTo(clientId, { type: "specs:get_result", spec });
    return;
  }

  if (message.type === "specs:create") {
    const createMsg = message as SpecsCreateMessage;
    const created = createSpec({
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
    const brainstormMsg = message as SpecsCreateWithBrainstormMessage;
    const slug = brainstormMsg.projectSlug;
    const newSpec = createSpec({ projectSlug: slug, title: "New Spec" });
    const brainstormSession = createSession(slug, "brainstorm");
    updateSessionInIndex(slug, brainstormSession);
    linkSession(newSpec.id, brainstormSession.id, "Brainstorm session", "brainstorm");
    const brainstormPrompt = buildBrainstormPrompt(newSpec, slug);
    sendTo(clientId, {
      type: "specs:brainstorm-started",
      spec: newSpec,
      sessionId: brainstormSession.id,
      systemPrompt: { type: "preset", preset: "claude_code", append: brainstormPrompt },
    });
    broadcastToProject(slug, { type: "specs:created", spec: newSpec });
    broadcastToProject(slug, {
      type: "session:list",
      projectSlug: slug,
      sessions: [brainstormSession],
      totalCount: undefined,
      offset: 0,
    });
    return;
  }

  if (message.type === "specs:start-plan") {
    const planMsg = message as SpecsStartPlanMessage;
    const planSpec = getSpec(planMsg.specId);
    if (!planSpec) {
      sendTo(clientId, { type: "chat:error", message: "Spec not found" });
      return;
    }
    const planSession = createSession(planMsg.projectSlug, "write-plan");
    planSession.title = "Plan: " + planSpec.title;
    updateSessionInIndex(planMsg.projectSlug, planSession);
    linkSession(planSpec.id, planSession.id, "Write plan session", "write-plan");
    const planPrompt = buildWritePlanPrompt(planSpec, planMsg.projectSlug);
    sendTo(clientId, {
      type: "specs:plan-started",
      spec: planSpec,
      sessionId: planSession.id,
      systemPrompt: { type: "preset", preset: "claude_code", append: planPrompt },
    });
    broadcastToProject(planMsg.projectSlug, {
      type: "session:list",
      projectSlug: planMsg.projectSlug,
      sessions: [planSession],
      totalCount: undefined,
      offset: 0,
    });
    return;
  }

  if (message.type === "specs:start-execute") {
    const execMsg = message as SpecsStartExecuteMessage;
    const execSpec = getSpec(execMsg.specId);
    if (!execSpec) {
      sendTo(clientId, { type: "chat:error", message: "Spec not found" });
      return;
    }
    const execSession = createSession(execMsg.projectSlug, "execute");
    execSession.title = "Execute: " + execSpec.title;
    updateSessionInIndex(execMsg.projectSlug, execSession);
    linkSession(execSpec.id, execSession.id, "Execute session", "execute");
    const execPrompt = buildExecutePrompt(execSpec, execMsg.projectSlug);
    sendTo(clientId, {
      type: "specs:execute-started",
      spec: execSpec,
      sessionId: execSession.id,
      systemPrompt: { type: "preset", preset: "claude_code", append: execPrompt },
    });
    broadcastToProject(execMsg.projectSlug, {
      type: "session:list",
      projectSlug: execMsg.projectSlug,
      sessions: [execSession],
      totalCount: undefined,
      offset: 0,
    });
    return;
  }

  if (message.type === "specs:update") {
    const updateMsg = message as SpecsUpdateMessage;
    const updated = updateSpec(updateMsg.id, {
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
    const deleteMsg = message as SpecsDeleteMessage;
    const toDelete = getSpec(deleteMsg.id);
    if (!toDelete) {
      sendTo(clientId, { type: "chat:error", message: "Spec not found" });
      return;
    }
    deleteSpec(deleteMsg.id);
    broadcastToProject(toDelete.projectSlug, { type: "specs:deleted", id: deleteMsg.id });
    return;
  }

  if (message.type === "specs:link-session") {
    const linkMsg = message as SpecsLinkSessionMessage;
    const linked = linkSession(linkMsg.id, linkMsg.sessionId, linkMsg.note);
    if (!linked) {
      sendTo(clientId, { type: "chat:error", message: "Spec not found" });
      return;
    }
    broadcastToProject(linked.projectSlug, { type: "specs:session_linked", spec: linked });
    return;
  }

  if (message.type === "specs:unlink-session") {
    const unlinkMsg = message as SpecsUnlinkSessionMessage;
    const unlinked = unlinkSession(unlinkMsg.id, unlinkMsg.sessionId);
    if (!unlinked) {
      sendTo(clientId, { type: "chat:error", message: "Spec not found" });
      return;
    }
    broadcastToProject(unlinked.projectSlug, { type: "specs:session_unlinked", spec: unlinked });
    return;
  }

  if (message.type === "specs:activity") {
    const actMsg = message as SpecsActivityMessage;
    const withActivity = addActivity(actMsg.id, actMsg.activityType, actMsg.detail, actMsg.sessionId);
    if (!withActivity) {
      sendTo(clientId, { type: "chat:error", message: "Spec not found" });
      return;
    }
    broadcastToProject(withActivity.projectSlug, { type: "specs:activity_added", spec: withActivity });
    return;
  }
});
