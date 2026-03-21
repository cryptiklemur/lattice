import { useEffect, useState, useRef } from "react";
import { Search, Check, X } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSaveState } from "../../hooks/useSaveState";
import { SaveFooter } from "../ui/SaveFooter";
import type { EditorDetectResultMessage, ServerMessage, SettingsDataMessage, SettingsUpdateMessage } from "@lattice/shared";

var IDE_OPTIONS = [
  { id: "vscode", label: "VS Code" },
  { id: "vscode-insiders", label: "VS Code Insiders" },
  { id: "cursor", label: "Cursor" },
  { id: "webstorm", label: "WebStorm" },
  { id: "intellij", label: "IntelliJ IDEA" },
  { id: "pycharm", label: "PyCharm" },
  { id: "goland", label: "GoLand" },
  { id: "notepad++", label: "Notepad++" },
  { id: "sublime", label: "Sublime Text" },
  { id: "custom", label: "Custom" },
];

export function Editor() {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var [ideType, setIdeType] = useState("vscode");
  var [paths, setPaths] = useState<Record<string, string>>({});
  var [customCommand, setCustomCommand] = useState("");
  var [detecting, setDetecting] = useState(false);
  var [detectResult, setDetectResult] = useState<"found" | "not_found" | null>(null);
  var save = useSaveState();
  var autoDetectedRef = useRef<Set<string>>(new Set());

  useEffect(function () {
    function handleMessage(msg: ServerMessage) {
      if (msg.type !== "settings:data") return;
      var data = msg as SettingsDataMessage;
      var cfg = data.config as unknown as Record<string, unknown>;
      var editor = cfg.editor as { type?: string; paths?: Record<string, string>; customCommand?: string } | undefined;

      var newType = editor?.type ?? "vscode";
      var newPaths = editor?.paths ?? {};
      var newCustomCommand = editor?.customCommand ?? "";

      if (save.saving) {
        save.confirmSave();
      } else {
        setIdeType(newType);
        setPaths(newPaths);
        setCustomCommand(newCustomCommand);
        save.resetFromServer();

        if (newType !== "custom" && !newPaths[newType] && !autoDetectedRef.current.has(newType)) {
          autoDetectedRef.current.add(newType);
          send({ type: "editor:detect", editorType: newType });
        }
      }
    }

    function handleDetectResult(msg: ServerMessage) {
      if (msg.type !== "editor:detect_result") return;
      var result = msg as EditorDetectResultMessage;
      setDetecting(false);
      if (result.path) {
        setPaths(function (prev) {
          var updated = { ...prev, [result.editorType]: result.path! };
          return updated;
        });
        setDetectResult("found");
        save.markDirty();
      } else {
        setDetectResult("not_found");
      }
    }

    subscribe("settings:data", handleMessage);
    subscribe("editor:detect_result", handleDetectResult);
    send({ type: "settings:get" });

    return function () {
      unsubscribe("settings:data", handleMessage);
      unsubscribe("editor:detect_result", handleDetectResult);
    };
  }, []);

  function handleTypeChange(value: string) {
    setIdeType(value);
    setDetectResult(null);
    save.markDirty();

    if (value !== "custom" && !paths[value] && !autoDetectedRef.current.has(value)) {
      autoDetectedRef.current.add(value);
      setDetecting(true);
      send({ type: "editor:detect", editorType: value });
    }
  }

  function handleExecPathChange(value: string) {
    setPaths(function (prev) {
      return { ...prev, [ideType]: value };
    });
    setDetectResult(null);
    save.markDirty();
  }

  function handleCustomCommandChange(value: string) {
    setCustomCommand(value);
    save.markDirty();
  }

  function handleDetect() {
    setDetecting(true);
    setDetectResult(null);
    send({ type: "editor:detect", editorType: ideType });
  }

  function handleSave() {
    save.startSave();
    var editorSettings: { type: string; paths?: Record<string, string>; customCommand?: string } = { type: ideType };
    if (ideType === "custom") {
      editorSettings.customCommand = customCommand;
    } else {
      editorSettings.paths = paths;
    }
    var updateMsg: SettingsUpdateMessage = {
      type: "settings:update",
      settings: { editor: editorSettings } as SettingsUpdateMessage["settings"],
    };
    send(updateMsg);
  }

  var selectedLabel = IDE_OPTIONS.find(function (o) { return o.id === ideType; })?.label || ideType;
  var currentPath = paths[ideType] || "";

  return (
    <div className="py-2">
      <div className="mb-5">
        <label htmlFor="editor-ide-type" className="block text-[12px] font-semibold text-base-content/40 mb-1">IDE</label>
        <p className="text-[11px] text-base-content/30 mb-2">Choose your preferred editor for opening files from Lattice.</p>
        <select
          id="editor-ide-type"
          value={ideType}
          onChange={function (e) { handleTypeChange(e.target.value); }}
          className="w-full h-9 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content text-[13px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
        >
          {IDE_OPTIONS.map(function (opt) {
            return (
              <option key={opt.id} value={opt.id} className="bg-base-300">
                {opt.label}
              </option>
            );
          })}
        </select>
      </div>

      {ideType !== "custom" && (
        <div className="mb-5">
          <label htmlFor="editor-exec-path" className="block text-[12px] font-semibold text-base-content/40 mb-1">Path to executable</label>
          <p className="text-[11px] text-base-content/30 mb-2">Leave empty to use the default system path.</p>
          <div className="flex gap-2">
            <input
              id="editor-exec-path"
              type="text"
              value={currentPath}
              onChange={function (e) { handleExecPathChange(e.target.value); }}
              placeholder="/usr/bin/code"
              className="flex-1 h-9 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content font-mono text-[13px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
            />
            <button
              onClick={handleDetect}
              disabled={detecting}
              className="h-9 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content/60 text-[12px] hover:text-base-content hover:border-base-content/30 transition-colors duration-[120ms] flex items-center gap-1.5 disabled:opacity-40"
              title={"Auto-detect " + selectedLabel}
            >
              <Search size={13} />
              {detecting ? "Detecting..." : "Detect"}
            </button>
          </div>
          {detectResult === "found" && (
            <p className="text-[11px] text-success mt-1.5 flex items-center gap-1">
              <Check size={11} />
              Found at {currentPath}
            </p>
          )}
          {detectResult === "not_found" && (
            <p className="text-[11px] text-warning mt-1.5 flex items-center gap-1">
              <X size={11} />
              Could not find {selectedLabel} — enter the path manually
            </p>
          )}
        </div>
      )}

      {ideType === "custom" && (
        <div className="mb-5">
          <label htmlFor="editor-custom-command" className="block text-[12px] font-semibold text-base-content/40 mb-1">Shell command</label>
          <p className="text-[11px] text-base-content/30 mb-2">Use {"{file}"} for the file path and {"{line}"} for the line number.</p>
          <input
            id="editor-custom-command"
            type="text"
            value={customCommand}
            onChange={function (e) { handleCustomCommandChange(e.target.value); }}
            placeholder="vim +{line} {file}"
            className="w-full h-9 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content font-mono text-[13px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
          />
        </div>
      )}

      <SaveFooter
        dirty={save.dirty}
        saving={save.saving}
        saveState={save.saveState}
        onSave={handleSave}
      />
    </div>
  );
}
