import { useState } from "react";
import { Wrench, ChevronDown, Check, FileText, Search, Terminal, Pencil, FolderOpen } from "lucide-react";
import type { HistoryMessage } from "#shared";
import { ToolResultRenderer } from "./ToolResultRenderer";
import { formatToolSummary } from "./toolSummary";

var TOOL_ICONS: Record<string, typeof Wrench> = {
  Read: FileText,
  Grep: Search,
  Glob: Search,
  Bash: Terminal,
  Write: Pencil,
  Edit: Pencil,
  MultiEdit: Pencil,
  LS: FolderOpen,
};

function getToolIcon(name: string) {
  return TOOL_ICONS[name] || Wrench;
}



function ToolDetail(props: { tool: HistoryMessage }) {
  var tool = props.tool;
  var [detailOpen, setDetailOpen] = useState(false);
  var hasResult = Boolean(tool.content);

  var parsedArgs = tool.args || "";
  try {
    if (tool.args) {
      parsedArgs = JSON.stringify(JSON.parse(tool.args), null, 2);
    }
  } catch {
    parsedArgs = tool.args || "";
  }

  var Icon = getToolIcon(tool.name || "");
  var summary = formatToolSummary(tool.name || "", tool.args || "");

  return (
    <div className="border-t border-base-content/6 first:border-t-0">
      <button
        type="button"
        onClick={function () { setDetailOpen(function (v) { return !v; }); }}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-base-content/5 transition-colors cursor-pointer text-left"
      >
        <Icon size={11} className={hasResult ? "text-base-content/25 flex-shrink-0" : "text-primary/60 flex-shrink-0"} />
        <span className="font-mono text-[11px] text-base-content/60 flex-shrink-0">{tool.name}</span>
        {summary && (
          <span className="text-[10px] text-base-content/30 truncate min-w-0 flex-1">{summary}</span>
        )}
        {!summary && <span className="flex-1" />}
        {hasResult ? (
          <Check size={10} className="text-success/40 flex-shrink-0" />
        ) : (
          <span className="text-[10px] text-primary/70 flex-shrink-0">running</span>
        )}
        <ChevronDown
          size={10}
          className={"text-base-content/25 transition-transform duration-150 flex-shrink-0 " + (detailOpen ? "rotate-180" : "")}
        />
      </button>

      {detailOpen && (
        <div className="pb-1">
          <ToolResultRenderer toolName={tool.name || ""} args={tool.args || ""} result={tool.content || ""} />
          {!(tool.name === "Edit" || tool.name === "MultiEdit") && parsedArgs && (
            <div className="px-2.5 py-1.5 border-t border-base-content/6">
              <div className="text-[9px] text-base-content/25 uppercase tracking-wider font-semibold mb-0.5">Args</div>
              <pre className="font-mono text-[11px] text-base-content/45 whitespace-pre-wrap break-words m-0 leading-relaxed bg-base-100/50 rounded-md p-2 max-h-[120px] overflow-y-auto">
                {parsedArgs}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ToolGroupProps {
  tools: HistoryMessage[];
}

export function ToolGroup(props: ToolGroupProps) {
  var [expanded, setExpanded] = useState(false);
  var tools = props.tools;
  var allDone = tools.every(function (t) { return Boolean(t.content); });
  var uniqueNames = Array.from(new Set(tools.map(function (t) { return t.name || "unknown"; })));
  var summary = uniqueNames.length <= 3
    ? uniqueNames.join(", ")
    : uniqueNames.slice(0, 2).join(", ") + " + " + (uniqueNames.length - 2) + " more";

  return (
    <div className="ml-14 mr-5 py-0.5 max-w-[95%] sm:max-w-[85%]">
      <div className={"rounded-lg border text-[12px] overflow-hidden " + (allDone ? "bg-base-200/50 border-base-content/8" : "bg-base-200/70 border-primary/20")}>
        <button
          type="button"
          onClick={function () { setExpanded(function (v) { return !v; }); }}
          className="flex items-center gap-2 w-full py-1.5 px-2.5 hover:bg-base-content/5 transition-colors duration-100 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset"
        >
          <Wrench size={11} className={allDone ? "text-base-content/30" : "text-primary/70"} />
          <span className="font-mono font-medium text-base-content/70 flex-1 text-left">
            Ran {tools.length} commands
          </span>
          <span className="text-[10px] text-base-content/40 truncate max-w-[200px]">{summary}</span>
          {allDone ? (
            <Check size={11} className="text-success/50 flex-shrink-0" />
          ) : (
            <span className="text-[10px] text-primary/70 flex-shrink-0">running</span>
          )}
          <ChevronDown
            size={11}
            className={"text-base-content/30 transition-transform duration-150 flex-shrink-0 " + (expanded ? "rotate-180" : "")}
          />
        </button>

        {expanded && (
          <div className="border-t border-base-content/8">
            {tools.map(function (tool, i) {
              return <ToolDetail key={tool.toolId || (tool.name + "-" + i)} tool={tool} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
