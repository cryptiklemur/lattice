import { useState } from "react";
import { X, RotateCcw, Eye, EyeOff } from "lucide-react";
import type { ClientAttachment } from "../../hooks/useAttachments";

interface AttachmentChipsProps {
  attachments: ClientAttachment[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + "B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + "KB";
  return (bytes / (1024 * 1024)).toFixed(1) + "MB";
}

function getExtBadge(name: string, type: string): string {
  if (type === "paste") return "TXT";
  const ext = name.split(".").pop()?.toUpperCase() || "";
  return ext.slice(0, 4) || "FILE";
}

export function AttachmentChips(props: AttachmentChipsProps) {
  const [expandedPaste, setExpandedPaste] = useState<string | null>(null);

  if (props.attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-base-content/8" role="list" aria-label="Attachments">
      {props.attachments.map(function (att) {
        const isFailed = att.status === "failed";
        const isUploading = att.status === "uploading";

        return (
          <div key={att.id} role="listitem" className="relative">
            <div
              className={
                "relative flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] overflow-hidden transition-colors " +
                (isFailed
                  ? "bg-error/10 border border-error/30 text-error/80"
                  : "bg-base-content/5 border border-base-content/10 text-base-content/70")
              }
            >
              {isUploading && (
                <div
                  className="absolute left-0 top-0 bottom-0 bg-primary/10 transition-all duration-300"
                  style={{ width: att.progress + "%" }}
                />
              )}

              {att.type === "image" && att.previewUrl ? (
                <img
                  src={att.previewUrl}
                  alt=""
                  className="relative w-7 h-7 rounded object-cover flex-shrink-0"
                />
              ) : (
                <span className="relative font-mono text-[10px] text-primary/60 flex-shrink-0">
                  {getExtBadge(att.name, att.type)}
                </span>
              )}

              <span className="relative truncate max-w-[120px]">{att.name}</span>

              {att.type === "paste" && att.lineCount ? (
                <span className="relative text-[10px] text-base-content/30">{att.lineCount} lines</span>
              ) : isUploading ? (
                <span className="relative text-[10px] text-primary/50">{att.progress}%</span>
              ) : (
                <span className="relative text-[10px] text-base-content/30">{formatSize(att.size)}</span>
              )}

              {att.type === "paste" && att.content && (
                <button
                  onClick={function () {
                    setExpandedPaste(expandedPaste === att.id ? null : att.id);
                  }}
                  className="icon-action relative text-[10px] text-primary/50 hover:text-primary/80 underline"
                  aria-label={expandedPaste === att.id ? "Hide preview" : "Show preview"}
                >
                  {expandedPaste === att.id ? <EyeOff size={10} /> : <Eye size={10} />}
                </button>
              )}

              {isFailed && (
                <button
                  onClick={function () { props.onRetry(att.id); }}
                  className="icon-action relative text-error/60 hover:text-error/90"
                  aria-label={"Retry " + att.name}
                  title={att.error}
                >
                  <RotateCcw size={10} />
                </button>
              )}

              <button
                onClick={function () { props.onRemove(att.id); }}
                className="icon-action relative text-base-content/30 hover:text-base-content/60"
                aria-label={"Remove " + att.name}
              >
                <X size={12} />
              </button>
            </div>

            {expandedPaste === att.id && att.content && (
              <div className="absolute left-0 bottom-full mb-1 w-[400px] max-w-[calc(100vw-2rem)] max-h-[200px] overflow-auto rounded-lg border border-base-content/10 bg-base-300 shadow-lg z-50 p-2 font-mono text-[11px] text-base-content/50 whitespace-pre">
                {att.content.slice(0, 2000)}
                {att.content.length > 2000 && "\n... (" + (att.content.length - 2000) + " more characters)"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
