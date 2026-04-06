import { Circle, CircleDot, CheckCircle2, ListTodo } from "lucide-react";
import type { HistoryMessage } from "#shared";

interface TodoCardProps {
  message: HistoryMessage;
}

function StatusIcon(props: { status: string }) {
  if (props.status === "completed") {
    return <CheckCircle2 size={13} className="text-success/70 flex-shrink-0" />;
  }
  if (props.status === "in_progress") {
    return <CircleDot size={13} className="text-primary/70 flex-shrink-0 animate-pulse" />;
  }
  return <Circle size={13} className="text-base-content/25 flex-shrink-0" />;
}

export function TodoCard(props: TodoCardProps) {
  var todos = props.message.todos || [];
  if (todos.length === 0) return null;

  var completed = todos.filter(function (t: typeof todos[number]) { return t.status === "completed"; }).length;
  var total = todos.length;

  return (
    <div className="px-5 py-2">
      <div className="rounded-xl border border-base-content/8 bg-base-300/60 overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-base-content/6 bg-base-content/3">
          <ListTodo size={14} className="text-base-content/40 flex-shrink-0" />
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-base-content/35">Tasks</span>
          <span className="text-[10px] font-mono text-base-content/25">{completed}/{total}</span>
        </div>

        <div className="px-3 py-2">
          {todos.map(function (todo: typeof todos[number]) {
            return (
              <div
                key={todo.id}
                className={
                  "flex items-start gap-2 px-2 py-1.5 rounded-md text-[12px] " +
                  (todo.status === "completed" ? "text-base-content/35" : "text-base-content/65")
                }
              >
                <div className="mt-0.5">
                  <StatusIcon status={todo.status} />
                </div>
                <span className={todo.status === "completed" ? "line-through" : ""}>
                  {todo.content}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
