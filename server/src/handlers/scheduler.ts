import type {
  ClientMessage,
  SchedulerCreateMessage,
  SchedulerDeleteMessage,
  SchedulerToggleMessage,
} from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { listTasks, createTask, deleteTask, toggleTask } from "../features/scheduler";

registerHandler("scheduler", function (clientId: string, message: ClientMessage) {
  if (message.type === "scheduler:list") {
    sendTo(clientId, { type: "scheduler:tasks", tasks: listTasks() });
    return;
  }

  if (message.type === "scheduler:create") {
    var createMsg = message as SchedulerCreateMessage;
    var task = createTask({
      name: createMsg.name,
      prompt: createMsg.prompt,
      cron: createMsg.cron,
      projectSlug: createMsg.projectSlug,
    });
    if (!task) {
      sendTo(clientId, { type: "chat:error", message: "Invalid cron expression" });
      return;
    }
    sendTo(clientId, { type: "scheduler:task_created", task });
    sendTo(clientId, { type: "scheduler:tasks", tasks: listTasks() });
    return;
  }

  if (message.type === "scheduler:delete") {
    var deleteMsg = message as SchedulerDeleteMessage;
    deleteTask(deleteMsg.taskId);
    sendTo(clientId, { type: "scheduler:tasks", tasks: listTasks() });
    return;
  }

  if (message.type === "scheduler:toggle") {
    var toggleMsg = message as SchedulerToggleMessage;
    toggleTask(toggleMsg.taskId);
    sendTo(clientId, { type: "scheduler:tasks", tasks: listTasks() });
    return;
  }
});
