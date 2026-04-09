import { useState } from "react";
import { Plus, X } from "lucide-react";
import { TerminalInstance } from "./TerminalInstance";

interface TerminalTab {
  id: string;
  label: string;
}

let nextTermNum = 1;

function makeTab(): TerminalTab {
  const num = nextTermNum++;
  return { id: `term-${num}-${Date.now()}`, label: `Terminal ${num}` };
}

export function TerminalView() {
  const initialTab = makeTab();
  const [tabs, setTabs] = useState<TerminalTab[]>([initialTab]);
  const [activeId, setActiveId] = useState<string>(initialTab.id);

  function addTab() {
    const tab = makeTab();
    setTabs(function(prev) { return [...prev, tab]; });
    setActiveId(tab.id);
  }

  function closeTab(id: string) {
    setTabs(function(prev) {
      if (prev.length === 1) {
        const replacement = makeTab();
        setActiveId(replacement.id);
        return [replacement];
      }
      const next = prev.filter(function(t) { return t.id !== id; });
      if (id === activeId) {
        const idx = prev.findIndex(function(t) { return t.id === id; });
        const newActive = next[Math.min(idx, next.length - 1)];
        setActiveId(newActive.id);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div role="tablist" className="flex items-center h-8 bg-base-200 border-b border-base-content/15 flex-shrink-0 overflow-x-auto">
        {tabs.map(function(tab) {
          const isActive = tab.id === activeId;
          return (
            <div
              key={tab.id}
              tabIndex={0}
              role="tab"
              aria-selected={isActive}
              className={[
                "flex items-center gap-1 px-3 h-full text-[12px] cursor-pointer select-none border-r border-base-content/15 flex-shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-base-200",
                isActive
                  ? "bg-base-100 text-base-content"
                  : "text-base-content/50 hover:text-base-content hover:bg-base-100/50",
              ].join(" ")}
              onClick={function() { setActiveId(tab.id); }}
              onKeyDown={function(e) {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveId(tab.id);
                }
              }}
            >
              <span>{tab.label}</span>
              {tabs.length > 1 && (
                <button
                  className="ml-1 rounded hover:bg-base-300 p-1 sm:p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-base-200"
                  aria-label={"Close " + tab.label}
                  onClick={function(e) {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  <X className="!size-3" />
                </button>
              )}
            </div>
          );
        })}
        <button
          className="flex items-center justify-center w-10 sm:w-8 h-full text-base-content/50 hover:text-base-content hover:bg-base-100/50 flex-shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-base-200"
          aria-label="New terminal"
          onClick={addTab}
          title="New terminal"
        >
          <Plus className="!size-4" />
        </button>
      </div>
      <div className="flex-1 min-h-0 relative">
        {tabs.map(function(tab) {
          return (
            <div
              key={tab.id}
              className="absolute inset-0"
              style={{ display: tab.id === activeId ? "block" : "none" }}
            >
              <TerminalInstance instanceId={tab.id} visible={tab.id === activeId} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
