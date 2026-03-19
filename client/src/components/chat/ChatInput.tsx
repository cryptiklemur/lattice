import { useRef, useState, useEffect, useMemo } from "react";
import { SendHorizontal, Settings } from "lucide-react";
import { useSkills } from "../../hooks/useSkills";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
  toolbarContent?: React.ReactNode;
}

function getModKey(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  var platform = navigator.platform || "";
  if (platform.indexOf("Mac") !== -1) return "⌘";
  return "Ctrl";
}

export function ChatInput(props: ChatInputProps) {
  var textareaRef = useRef<HTMLTextAreaElement>(null);
  var popupRef = useRef<HTMLDivElement>(null);
  var settingsRef = useRef<HTMLDivElement>(null);
  var settingsBtnRef = useRef<HTMLButtonElement>(null);
  var skills = useSkills();
  var [slashQuery, setSlashQuery] = useState<string | null>(null);
  var [selectedIndex, setSelectedIndex] = useState(0);
  var [showMobileSettings, setShowMobileSettings] = useState(false);
  var modKey = useMemo(getModKey, []);

  var filtered = useMemo(function () {
    if (slashQuery === null) return [];
    var q = slashQuery.toLowerCase();
    return skills.filter(function (s) {
      return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    });
  }, [slashQuery, skills]);

  var isOpen = slashQuery !== null && filtered.length > 0;

  useEffect(function () {
    setSelectedIndex(0);
  }, [slashQuery]);

  useEffect(function () {
    if (!isOpen || !popupRef.current) return;
    var active = popupRef.current.querySelector("[data-active='true']") as HTMLElement | null;
    if (active) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, isOpen]);

  useEffect(function () {
    if (!showMobileSettings) return;
    function handleClick(e: MouseEvent) {
      var target = e.target as Node;
      if (settingsRef.current && settingsRef.current.contains(target)) return;
      if (settingsBtnRef.current && settingsBtnRef.current.contains(target)) return;
      setShowMobileSettings(false);
    }
    document.addEventListener("mousedown", handleClick);
    return function () { document.removeEventListener("mousedown", handleClick); };
  }, [showMobileSettings]);

  function checkSlash() {
    var el = textareaRef.current;
    if (!el) return;
    var val = el.value;
    if (val.startsWith("/")) {
      setSlashQuery(val.slice(1));
    } else {
      setSlashQuery(null);
    }
  }

  function selectSkill(name: string) {
    var el = textareaRef.current;
    if (!el) return;
    el.value = "/" + name + " ";
    el.focus();
    setSlashQuery(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (isOpen) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(function (i) { return i > 0 ? i - 1 : filtered.length - 1; });
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(function (i) { return i < filtered.length - 1 ? i + 1 : 0; });
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          selectSkill(filtered[selectedIndex].name);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    var el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
    checkSlash();
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
    setSlashQuery(null);
  }

  return (
    <div className="relative">
      {isOpen && (
        <div
          ref={popupRef}
          role="listbox"
          aria-label="Slash commands"
          className="absolute left-0 right-0 bottom-[calc(100%+6px)] max-h-[320px] overflow-y-auto rounded-lg border border-base-content/10 bg-base-300 shadow-lg z-50"
        >
          {filtered.map(function (skill, i) {
            return (
              <button
                key={skill.name}
                data-active={i === selectedIndex}
                onMouseDown={function (e) {
                  e.preventDefault();
                  selectSkill(skill.name);
                }}
                onMouseEnter={function () { setSelectedIndex(i); }}
                className={
                  "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors " +
                  (i === selectedIndex ? "bg-primary/10" : "hover:bg-base-content/5")
                }
              >
                <span className="font-mono text-[12px] text-primary/90 whitespace-nowrap flex-shrink-0">
                  /{skill.name}
                </span>
                <span className="text-[11px] text-base-content/40 truncate min-w-0">
                  {skill.description}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {showMobileSettings && (
        <div
          ref={settingsRef}
          className="absolute right-0 bottom-[calc(100%+6px)] rounded-lg border border-base-content/10 bg-base-300 shadow-lg z-50 p-2.5 min-w-[200px] sm:hidden"
        >
          <div className="flex flex-col gap-2">
            {props.toolbarContent}
          </div>
        </div>
      )}

      <div
        className={
          "border rounded-xl bg-base-300/60 overflow-hidden transition-all duration-150 " +
          (props.disabled
            ? "border-base-content/10 opacity-60"
            : "border-primary/20 focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_oklch(from_var(--color-primary)_l_c_h/0.1)]")
        }
      >
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border-b border-base-content/8 font-mono text-[10px]">
          {props.toolbarContent}
          <span className="flex-1" />
          <span className="text-base-content/20">{modKey}+K commands</span>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-2.5">
          <div className="flex-1 min-w-0 relative">
            <span className="absolute left-0 top-[1px] text-primary/50 font-mono text-[14px] leading-relaxed select-none pointer-events-none">›</span>
            <textarea
              ref={textareaRef}
              aria-label="Message input"
              placeholder={props.disabled ? "Claude is responding..." : "Message Claude..."}
              disabled={props.disabled}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              rows={1}
              style={{ padding: "1px 0 0 16px", margin: 0, border: "none" }}
              className={
                "w-full resize-none bg-transparent text-base-content text-[14px] leading-relaxed max-h-[160px] overflow-y-auto outline-none placeholder:text-base-content/30 " +
                (props.disabled ? "cursor-not-allowed" : "cursor-text")
              }
            />
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              ref={settingsBtnRef}
              aria-label="Chat settings"
              onClick={function () { setShowMobileSettings(!showMobileSettings); }}
              className={"sm:hidden w-8 h-8 rounded-lg flex items-center justify-center transition-colors " + (showMobileSettings ? "bg-base-content/10 text-base-content/60" : "text-base-content/30 hover:text-base-content/50")}
            >
              <Settings size={15} />
            </button>
            <span className="text-[10px] text-base-content/20 font-mono hidden sm:block">⏎ send</span>
            <button
              aria-label="Send message"
              disabled={props.disabled}
              onClick={submit}
              className={
                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150 outline-none " +
                (props.disabled
                  ? "bg-base-content/5 text-base-content/20 cursor-not-allowed"
                  : "bg-primary text-primary-content hover:bg-primary/80 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-base-300")
              }
            >
              <SendHorizontal size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
