import { useRef, useState, useEffect, useMemo } from "react";
import { useStore } from "@tanstack/react-store";
import { SendHorizontal, Settings, Paperclip } from "lucide-react";
import { useSkills } from "../../hooks/useSkills";
import { CommandPalette, getFilteredItems } from "./CommandPalette";
import { useAttachments } from "../../hooks/useAttachments";
import { useVoiceRecorder } from "../../hooks/useVoiceRecorder";
import { AttachmentChips } from "./AttachmentChips";
import { VoiceRecorder } from "./VoiceRecorder";
import { getSessionStore } from "../../stores/session";

interface ChatInputProps {
  onSend: (text: string, attachmentIds: string[]) => void;
  disabled: boolean;
  disabledPlaceholder?: string;
  toolbarContent?: React.ReactNode;
  failedInput?: string | null;
  onFailedInputConsumed?: () => void;
  prefillText?: string | null;
  onPrefillConsumed?: () => void;
  sessionId?: string | null;
}

function getModKey(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  var platform = navigator.platform || "";
  if (platform.indexOf("Mac") !== -1) return "⌘";
  return "Ctrl";
}

var historyBySession = new Map<string, string[]>();
var MAX_HISTORY = 100;

function extractTypedInput(text: string): string | null {
  var firstNewline = text.search(/\r?\n/);
  var firstLine = firstNewline !== -1 ? text.slice(0, firstNewline).trim() : text;
  if (firstLine.indexOf(":") !== -1 && /\n---[\r\n]/.test(text)) {
    return "/" + firstLine;
  }
  if (text.startsWith("<skill-name>")) {
    var endTag = text.indexOf("</skill-name>");
    if (endTag !== -1) {
      return "/" + text.slice(12, endTag);
    }
    return null;
  }
  if (text.startsWith("<skill-content>")) return null;
  if (text.length > 500) return null;
  return text;
}

function getHistory(sessionId: string | null | undefined): string[] {
  if (!sessionId) return [];
  var hist = historyBySession.get(sessionId);
  if (!hist) {
    hist = [];
    historyBySession.set(sessionId, hist);
  }
  return hist;
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
  var [historyIndex, setHistoryIndex] = useState(-1);
  var savedCurrentRef = useRef("");
  var inputHistory = getHistory(props.sessionId);
  var historyLoading = useStore(getSessionStore(), function (s) { return s.historyLoading; });
  var messages = useStore(getSessionStore(), function (s) { return s.messages; });

  useEffect(function () {
    setHistoryIndex(-1);
    savedCurrentRef.current = "";
  }, [props.sessionId]);

  useEffect(function () {
    if (!props.sessionId || historyLoading) return;
    for (var i = 0; i < messages.length; i++) {
      if (messages[i].type === "user" && messages[i].text) {
        var typed = extractTypedInput(messages[i].text!.trim());
        if (typed && inputHistory.indexOf(typed) === -1) {
          inputHistory.push(typed);
        }
      }
    }
    if (inputHistory.length > MAX_HISTORY) {
      inputHistory.splice(0, inputHistory.length - MAX_HISTORY);
    }
  }, [props.sessionId, historyLoading]);

  var attachmentsHook = useAttachments();
  var voice = useVoiceRecorder();
  var [isDragging, setIsDragging] = useState(false);
  var dragCounter = useRef(0);
  var fileInputRef = useRef<HTMLInputElement>(null);
  var savedTextRef = useRef("");

  var itemCount = useMemo(function () {
    if (slashQuery === null) return 0;
    return getFilteredItems(slashQuery, skills).length;
  }, [slashQuery, skills]);

  var isOpen = slashQuery !== null && itemCount > 0;

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

  useEffect(function () {
    if (props.failedInput && textareaRef.current) {
      var el = textareaRef.current;
      el.value = props.failedInput;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
      el.focus();
      checkSlash();
      if (props.onFailedInputConsumed) {
        props.onFailedInputConsumed();
      }
    }
  }, [props.failedInput]);

  useEffect(function () {
    if (props.prefillText && textareaRef.current) {
      var el = textareaRef.current;
      el.value = props.prefillText;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
      el.focus();
      checkSlash();
      if (props.onPrefillConsumed) {
        props.onPrefillConsumed();
      }
    }
  }, [props.prefillText]);

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

  function selectItem(item: { name: string; args?: string; category: string; handler: string }) {
    var el = textareaRef.current;
    if (!el) return;

    var hasArgs = !!item.args;
    var isSkill = item.category === "skill";

    if (hasArgs || isSkill) {
      el.value = "/" + item.name + " ";
      el.focus();
      setSlashQuery(null);
    } else {
      props.onSend("/" + item.name, []);
      el.value = "";
      el.style.height = "auto";
      setSlashQuery(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (isOpen) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(function (i) { return i > 0 ? i - 1 : itemCount - 1; });
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(function (i) { return i < itemCount - 1 ? i + 1 : 0; });
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        var items = getFilteredItems(slashQuery!, skills);
        if (items[selectedIndex]) {
          selectItem(items[selectedIndex]);
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
      return;
    }

    if (e.key === "ArrowUp" && inputHistory.length > 0) {
      var el = textareaRef.current;
      if (!el) return;
      var val = el.value;
      var cursorPos = el.selectionStart;
      var isAtTop = cursorPos === 0 || val.indexOf("\n") === -1 || cursorPos <= val.indexOf("\n");
      if (isAtTop) {
        e.preventDefault();
        if (historyIndex === -1) {
          savedCurrentRef.current = val;
        }
        var newIdx = historyIndex === -1 ? inputHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIdx);
        el.value = inputHistory[newIdx];
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 160) + "px";
        el.setSelectionRange(0, 0);
      }
      return;
    }

    if (e.key === "ArrowDown" && historyIndex >= 0) {
      var el = textareaRef.current;
      if (!el) return;
      var val = el.value;
      var cursorPos = el.selectionStart;
      var lastNewline = val.lastIndexOf("\n");
      var isAtBottom = lastNewline === -1 || cursorPos > lastNewline;
      if (isAtBottom) {
        e.preventDefault();
        if (historyIndex >= inputHistory.length - 1) {
          setHistoryIndex(-1);
          el.value = savedCurrentRef.current;
        } else {
          var newIdx = historyIndex + 1;
          setHistoryIndex(newIdx);
          el.value = inputHistory[newIdx];
        }
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 160) + "px";
        var len = el.value.length;
        el.setSelectionRange(len, len);
      }
      return;
    }
  }

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    var el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
    checkSlash();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    var items = e.clipboardData.items;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        var file = items[i].getAsFile();
        if (file && attachmentsHook.canAttach) {
          attachmentsHook.addFile(file);
        }
        return;
      }
    }

    var text = e.clipboardData.getData("text/plain");
    if (text && text.split("\n").length >= 10) {
      e.preventDefault();
      if (attachmentsHook.canAttach) {
        attachmentsHook.addPaste(text);
      }
    }
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.indexOf("Files") !== -1) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    var files = e.dataTransfer.files;
    for (var i = 0; i < files.length; i++) {
      if (attachmentsHook.canAttach) {
        attachmentsHook.addFile(files[i]);
      }
    }
  }

  function handleVoiceStart() {
    savedTextRef.current = textareaRef.current?.value || "";
    voice.start();
  }

  function handleVoiceStop() {
    var transcript = voice.stop();
    if (transcript && textareaRef.current) {
      var el = textareaRef.current;
      var existing = savedTextRef.current;
      el.value = existing ? existing + " " + transcript : transcript;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  }

  function handleVoiceCancel() {
    voice.cancel();
    if (textareaRef.current) {
      textareaRef.current.value = savedTextRef.current;
    }
  }

  function submit() {
    var el = textareaRef.current;
    if (!el) return;
    var text = el.value.trim();
    if ((!text && attachmentsHook.attachments.length === 0) || props.disabled || attachmentsHook.hasUploading) return;
    if (text) {
      if (inputHistory.length === 0 || inputHistory[inputHistory.length - 1] !== text) {
        inputHistory.push(text);
        if (inputHistory.length > MAX_HISTORY) inputHistory.shift();
      }
    }
    setHistoryIndex(-1);
    savedCurrentRef.current = "";
    props.onSend(text, attachmentsHook.readyIds);
    el.value = "";
    el.style.height = "auto";
    setSlashQuery(null);
    attachmentsHook.clearAll();
  }

  return (
    <div
      className="relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isOpen && (
        <div ref={popupRef}>
          <CommandPalette
            query={slashQuery!}
            skills={skills}
            selectedIndex={selectedIndex}
            onSelect={selectItem}
            onHover={setSelectedIndex}
          />
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

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={function (e) {
          var files = e.target.files;
          if (files) {
            for (var i = 0; i < files.length; i++) {
              if (attachmentsHook.canAttach) {
                attachmentsHook.addFile(files[i]);
              }
            }
          }
          e.target.value = "";
        }}
      />

      <div
        className={
          "border rounded-xl bg-base-300/60 overflow-hidden transition-all duration-150 " +
          (isDragging
            ? "border-primary/40 shadow-[0_0_0_3px_oklch(from_var(--color-primary)_l_c_h/0.1)]"
            : props.disabled
              ? "border-base-content/10 opacity-60"
              : "border-primary/20 focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_oklch(from_var(--color-primary)_l_c_h/0.1)]")
        }
      >
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border-b border-base-content/8 font-mono text-[10px]">
          {props.toolbarContent}
          <span className="flex-1" />
          <span className="text-base-content/20">{modKey}+K commands</span>
        </div>

        <AttachmentChips
          attachments={attachmentsHook.attachments}
          onRemove={attachmentsHook.removeAttachment}
          onRetry={attachmentsHook.retryAttachment}
        />

        <div className="flex items-center gap-2 px-3.5 py-2.5">
          <div className="flex gap-1 flex-shrink-0">
            <button
              aria-label="Attach file"
              disabled={!attachmentsHook.canAttach}
              onClick={function () { fileInputRef.current?.click(); }}
              className={
                "w-7 h-7 rounded-md flex items-center justify-center transition-colors " +
                (attachmentsHook.canAttach
                  ? "text-base-content/30 hover:text-base-content/50 border border-base-content/10 hover:border-base-content/20"
                  : "text-base-content/15 cursor-not-allowed")
              }
              title={attachmentsHook.canAttach ? "Attach file" : "Maximum attachments reached"}
            >
              <Paperclip size={13} />
            </button>
            <VoiceRecorder
              isRecording={voice.isRecording}
              isSupported={voice.isSupported}
              isSpeaking={voice.isSpeaking}
              elapsed={voice.elapsed}
              interimTranscript={voice.interimTranscript}
              onStart={handleVoiceStart}
              onStop={handleVoiceStop}
              onCancel={handleVoiceCancel}
            />
          </div>

          {voice.isRecording ? null : (
            <div className="flex-1 min-w-0 relative">
              <span className="absolute left-0 top-[1px] text-primary/50 font-mono text-[14px] leading-relaxed select-none pointer-events-none">›</span>
              <textarea
                ref={textareaRef}
                aria-label="Message input"
                placeholder={props.disabled ? (props.disabledPlaceholder || "Claude is responding...") : "Message Claude..."}
                disabled={props.disabled}
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                onPaste={handlePaste}
                rows={1}
                style={{ padding: "1px 0 0 16px", margin: 0, border: "none" }}
                className={
                  "w-full resize-none bg-transparent text-base-content text-[14px] leading-relaxed max-h-[160px] overflow-y-auto outline-none placeholder:text-base-content/30 " +
                  (props.disabled ? "cursor-not-allowed" : "cursor-text")
                }
              />
            </div>
          )}

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
              disabled={props.disabled || attachmentsHook.hasUploading}
              onClick={submit}
              title={attachmentsHook.hasUploading ? "Uploading..." : "Send message"}
              className={
                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150 outline-none " +
                (props.disabled || attachmentsHook.hasUploading
                  ? "bg-base-content/5 text-base-content/20 cursor-not-allowed"
                  : "bg-primary text-primary-content hover:bg-primary/80 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-base-300")
              }
            >
              <SendHorizontal size={14} />
            </button>
          </div>
        </div>
      </div>

      {isDragging && (
        <div className="absolute inset-0 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 flex items-center justify-center z-40 pointer-events-none">
          <span className="text-[13px] text-primary/60 font-mono">Drop files to attach</span>
        </div>
      )}
    </div>
  );
}
