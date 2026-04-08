import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface ShortcutEntry {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  name: string;
  shortcuts: ShortcutEntry[];
}

var isMac = typeof navigator !== "undefined" && navigator.platform.indexOf("Mac") !== -1;
var modKey = isMac ? "\u2318" : "Ctrl";

var categories: ShortcutCategory[] = [
  {
    name: "Chat",
    shortcuts: [
      { keys: ["Enter"], description: "Send message" },
      { keys: ["Shift", "Enter"], description: "New line" },
      { keys: ["\u2191"], description: "Previous input history" },
      { keys: ["\u2193"], description: "Next input history" },
      { keys: ["/"], description: "Slash commands" },
      { keys: ["Escape"], description: "Close autocomplete" },
    ],
  },
  {
    name: "Navigation",
    shortcuts: [
      { keys: [modKey, "K"], description: "Command palette" },
      { keys: ["?"], description: "Keyboard shortcuts" },
      { keys: ["Escape"], description: "Close modal / exit settings" },
    ],
  },
  {
    name: "Session",
    shortcuts: [
      { keys: ["/clear"], description: "New session" },
      { keys: ["/copy"], description: "Copy last response" },
      { keys: ["/export"], description: "Export conversation" },
      { keys: ["/rename"], description: "Rename session" },
    ],
  },
];

function Kbd(props: { children: string }) {
  return (
    <kbd className="bg-base-300 border border-base-content/20 rounded px-1.5 py-0.5 text-[11px] font-mono text-base-content/70 leading-none inline-flex items-center justify-center min-w-[22px]">
      {props.children}
    </kbd>
  );
}

export function KeyboardShortcuts() {
  var [open, setOpen] = useState(false);

  useEffect(function () {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        var tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return function () { document.removeEventListener("keydown", handleKeyDown); };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center" onClick={function () { setOpen(false); }}>
      <div className="absolute inset-0 bg-base-content/50" />
      <div
        className="relative w-full max-w-[540px] mx-4 bg-base-200 border border-base-content/15 rounded-xl shadow-xl overflow-hidden"
        onClick={function (e) { e.stopPropagation(); }}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-base-content/10">
          <h2 className="text-[14px] font-mono font-bold text-base-content tracking-tight">Keyboard Shortcuts</h2>
          <button
            onClick={function () { setOpen(false); }}
            aria-label="Close"
            className="w-6 h-6 rounded flex items-center justify-center text-base-content/30 hover:text-base-content/60 transition-colors focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <X size={14} />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          <div className="flex flex-col gap-5">
            {categories.map(function (cat) {
              return (
                <div key={cat.name}>
                  <div className="text-[9px] uppercase tracking-widest text-base-content/30 font-mono font-bold mb-2">{cat.name}</div>
                  <div className="flex flex-col gap-1">
                    {cat.shortcuts.map(function (shortcut, i) {
                      return (
                        <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-base-content/5 transition-colors">
                          <span className="text-[13px] text-base-content/60">{shortcut.description}</span>
                          <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                            {shortcut.keys.map(function (key, ki) {
                              return (
                                <span key={ki} className="flex items-center gap-1">
                                  {ki > 0 && <span className="text-[10px] text-base-content/20">+</span>}
                                  <Kbd>{key}</Kbd>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="px-5 py-2.5 border-t border-base-content/10 flex justify-end">
          <span className="text-[10px] font-mono text-base-content/20">Press <Kbd>Esc</Kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
