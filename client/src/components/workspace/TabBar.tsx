import { X } from "lucide-react";
import { useWorkspace } from "../../hooks/useWorkspace";

export function TabBar() {
  var { tabs, activeTabId, setActiveTab, closeTab } = useWorkspace();

  if (tabs.length <= 1) return null;

  return (
    <div className="flex items-center h-9 bg-base-200 border-b border-base-300 overflow-x-auto flex-shrink-0">
      {tabs.map(function (tab) {
        var isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            onClick={function () { setActiveTab(tab.id); }}
            className={
              "flex items-center gap-1.5 px-3 h-full text-[12px] font-mono border-r border-base-300 transition-colors whitespace-nowrap flex-shrink-0 " +
              (isActive
                ? "bg-base-100 text-base-content border-b-2 border-b-primary"
                : "text-base-content/50 hover:text-base-content/80 hover:bg-base-300/30")
            }
          >
            <span>{tab.label}</span>
            {tab.closeable && (
              <span
                role="button"
                aria-label={"Close " + tab.label + " tab"}
                onClick={function (e) {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="ml-1 p-0.5 rounded hover:bg-base-content/10 text-base-content/30 hover:text-base-content/60"
              >
                <X size={11} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
