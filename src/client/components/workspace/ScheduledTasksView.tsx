import { useCallback, useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import type { ScheduledTask, ServerMessage } from "#shared";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSession } from "../../hooks/useSession";
import { useOnline } from "../../hooks/useOnline";
import { TaskCard } from "./TaskCard";
import { TaskEditModal } from "./TaskEditModal";

export function ScheduledTasksView() {
  const { send, subscribe, unsubscribe } = useWebSocket();
  const { activeProjectSlug } = useSession();
  const online = useOnline();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null | undefined>(undefined);

  const handleMessage = useCallback(function (msg: ServerMessage) {
    if (msg.type === "scheduler:tasks") {
      setTasks(msg.tasks);
      return;
    }
    if (msg.type === "scheduler:task_created") {
      setTasks(function (prev) { return [...prev, msg.task]; });
      return;
    }
    if (msg.type === "scheduler:task_updated") {
      setTasks(function (prev) {
        return prev.map(function (t) { return t.id === msg.task.id ? msg.task : t; });
      });
      return;
    }
  }, []);

  useEffect(function () {
    subscribe("scheduler:tasks", handleMessage);
    subscribe("scheduler:task_created", handleMessage);
    subscribe("scheduler:task_updated", handleMessage);
    send({ type: "scheduler:list" });
    return function () {
      unsubscribe("scheduler:tasks", handleMessage);
      unsubscribe("scheduler:task_created", handleMessage);
      unsubscribe("scheduler:task_updated", handleMessage);
    };
  }, [send, subscribe, unsubscribe, handleMessage]);

  const filtered = tasks.filter(function (t) { return t.projectSlug === activeProjectSlug; });

  function handleToggle(taskId: string) {
    send({ type: "scheduler:toggle", taskId });
  }

  function handleDelete(taskId: string) {
    send({ type: "scheduler:delete", taskId });
    setTasks(function (prev) { return prev.filter(function (t) { return t.id !== taskId; }); });
  }

  function handleSave(data: { name: string; prompt: string; cron: string }) {
    if (editingTask === null) {
      if (!activeProjectSlug) return;
      send({ type: "scheduler:create", name: data.name, prompt: data.prompt, cron: data.cron, projectSlug: activeProjectSlug });
    } else if (editingTask) {
      send({ type: "scheduler:update", taskId: editingTask.id, name: data.name, prompt: data.prompt, cron: data.cron });
    }
    setEditingTask(undefined);
  }

  return (
    <div className="flex flex-col h-full bg-base-100">
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-content/15">
        <span className="text-[13px] font-semibold text-base-content">Scheduled Tasks</span>
        <button
          onClick={function () { setEditingTask(null); }}
          disabled={!online}
          className="btn btn-primary btn-xs"
        >
          New Task
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center mt-16 gap-3">
            <Calendar size={28} className="text-base-content/15" />
            <div>
              <div className="text-[13px] text-base-content/40">No scheduled tasks for this project</div>
              <div className="text-[11px] text-base-content/30 mt-1">Automate Claude prompts on a cron schedule. Click "New Task" to create one.</div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(function (task) {
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={handleToggle}
                  onEdit={function (t) { setEditingTask(t); }}
                  onDelete={handleDelete}
                  disabled={!online}
                />
              );
            })}
          </div>
        )}
      </div>

      {editingTask !== undefined && (
        <TaskEditModal
          task={editingTask}
          projectSlug={activeProjectSlug ?? ""}
          onSave={handleSave}
          onClose={function () { setEditingTask(undefined); }}
        />
      )}
    </div>
  );
}
