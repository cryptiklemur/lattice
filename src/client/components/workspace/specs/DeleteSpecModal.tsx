import { useRef, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { useFocusTrap } from "../../../hooks/useFocusTrap";

interface DeleteSpecModalProps {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteSpecModal({ title, onCancel, onConfirm }: DeleteSpecModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const stableOnCancel = useCallback(function () { onCancel(); }, [onCancel]);
  useFocusTrap(modalRef, stableOnCancel);

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-spec-title"
    >
      <div ref={modalRef} className="bg-base-300 border border-base-content/15 rounded-xl shadow-lg p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={16} className="text-warning" />
          <h3 id="delete-spec-title" className="text-[15px] font-mono font-bold text-base-content">Delete spec?</h3>
        </div>
        <p className="text-[13px] text-base-content/60 mb-4">
          This will permanently delete "{title || "Untitled"}". This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-ghost btn-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn btn-error btn-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
