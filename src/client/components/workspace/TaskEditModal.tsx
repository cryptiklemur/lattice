import { useState, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import cronstrue from "cronstrue";
import type { ScheduledTask } from "#shared";

interface TaskEditModalProps {
  task: ScheduledTask | null;
  projectSlug: string;
  onSave: (data: { name: string; prompt: string; cron: string }) => void;
  onClose: () => void;
}

function getCronPreview(expr: string): string {
  if (!expr.trim()) return "";
  try {
    return cronstrue.toString(expr.trim(), { use24HourTimeFormat: true });
  } catch {
    return "Invalid cron expression";
  }
}

export function TaskEditModal(props: TaskEditModalProps) {
  const { task, onSave, onClose } = props;
  const [name, setName] = useState(task ? task.name : "");
  const [prompt, setPrompt] = useState(task ? task.prompt : "");
  const [cron, setCron] = useState(task ? task.cron : "0 9 * * 1-5");

  const modalRef = useRef<HTMLDivElement>(null);
  const stableOnClose = useCallback(function () { onClose(); }, [onClose]);
  useFocusTrap(modalRef, stableOnClose);

  const cronPreview = getCronPreview(cron);
  const cronValid = cronPreview !== "Invalid cron expression" && cronPreview !== "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !prompt.trim() || !cronValid) return;
    onSave({ name: name.trim(), prompt: prompt.trim(), cron: cron.trim() });
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-base-content/50"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={task ? "Edit Task" : "New Scheduled Task"}
    >
      <div className="bg-base-200 border border-base-content/15 rounded-xl shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-content/15">
          <h2 className="text-[14px] font-semibold text-base-content">
            {task ? "Edit Task" : "New Scheduled Task"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="btn btn-ghost btn-xs btn-square text-base-content/50"
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="task-name" className="text-[12px] font-semibold text-base-content/40 uppercase tracking-wider">Name</label>
            <input
              id="task-name"
              type="text"
              className="w-full h-9 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content text-[13px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
              placeholder="Daily standup summary"
              value={name}
              onChange={function (e) { setName(e.target.value); }}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="task-prompt" className="text-[12px] font-semibold text-base-content/40 uppercase tracking-wider">Prompt</label>
            <textarea
              id="task-prompt"
              className="w-full px-3 py-2.5 bg-base-300 border border-base-content/15 rounded-xl text-base-content text-[13px] min-h-[96px] resize-y leading-relaxed focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
              placeholder="Summarize yesterday's work and create a plan for today..."
              value={prompt}
              onChange={function (e) { setPrompt(e.target.value); }}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="task-cron" className="text-[12px] font-semibold text-base-content/40 uppercase tracking-wider">Cron Expression</label>
            <input
              id="task-cron"
              type="text"
              className={`w-full h-9 px-3 bg-base-300 border rounded-xl text-base-content text-[13px] font-mono focus:border-primary focus-visible:outline-none transition-colors duration-[120ms] ${cron.trim() && !cronValid ? "border-error" : "border-base-content/15"}`}
              placeholder="0 9 * * 1-5"
              value={cron}
              onChange={function (e) { setCron(e.target.value); }}
              aria-invalid={cron.trim() && !cronValid ? "true" : undefined}
              aria-describedby={cron.trim() ? "cron-preview" : undefined}
            />
            {cron.trim() && (
              <p id="cron-preview" className={`text-[11px] mt-1 ${cronValid ? "text-primary/80" : "text-error"}`}>
                {cronPreview}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="btn btn-primary btn-sm flex-1"
              disabled={!name.trim() || !prompt.trim() || !cronValid}
            >
              {task ? "Save Changes" : "Create Task"}
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm border border-base-content/15">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
