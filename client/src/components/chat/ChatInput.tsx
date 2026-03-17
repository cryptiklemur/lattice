import { useRef } from "react";
import { SendHorizontal } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function ChatInput(props: ChatInputProps) {
  var textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    var el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  function submit() {
    var el = textareaRef.current;
    if (!el) {
      return;
    }
    var text = el.value.trim();
    if (!text || props.disabled) {
      return;
    }
    props.onSend(text);
    el.value = "";
    el.style.height = "auto";
  }

  return (
    <div className="flex-shrink-0 bg-base-200 px-4 pb-3.5">
      <div
        className={
          "flex items-end gap-2 bg-base-300 border border-base-content/15 rounded-xl px-3 py-2.5 transition-colors duration-[120ms] focus-within:border-primary " +
          (props.disabled ? "opacity-70" : "")
        }
      >
        <textarea
          ref={textareaRef}
          placeholder={props.disabled ? "Claude is responding..." : "Message Claude..."}
          disabled={props.disabled}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          rows={1}
          className={
            "flex-1 resize-none bg-transparent text-base-content text-[14px] leading-relaxed max-h-[160px] overflow-y-auto " +
            (props.disabled ? "cursor-not-allowed" : "cursor-text")
          }
        />
        <button
          aria-label="Send message"
          disabled={props.disabled}
          onClick={submit}
          className={
            "w-[30px] h-[30px] rounded flex items-center justify-center flex-shrink-0 transition-colors duration-[120ms] " +
            (props.disabled
              ? "bg-base-content/10 text-base-content/30 cursor-not-allowed"
              : "bg-primary text-primary-content hover:bg-primary/80 cursor-pointer")
          }
        >
          <SendHorizontal size={14} />
        </button>
      </div>
      <div className="text-[11px] text-base-content/30 mt-1.5 pl-0.5">
        Enter to send &bull; Shift+Enter for newline
      </div>
    </div>
  );
}
