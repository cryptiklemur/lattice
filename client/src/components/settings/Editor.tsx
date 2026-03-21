import { useEffect, useState } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSaveState } from "../../hooks/useSaveState";
import { SaveFooter } from "../ui/SaveFooter";
import type { ServerMessage, SettingsDataMessage, SettingsUpdateMessage } from "@lattice/shared";

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
  var [customCommand, setCustomCommand] = useState("");
  var save = useSaveState();

  useEffect(function () {
    function handleMessage(msg: ServerMessage) {
      if (msg.type !== "settings:data") return;
      var data = msg as SettingsDataMessage;
      var cfg = data.config as unknown as Record<string, unknown>;
      var editor = cfg.editor as { type?: string; customCommand?: string } | undefined;

      var newType = editor?.type ?? "vscode";
      var newCustomCommand = editor?.customCommand ?? "";

      if (save.saving) {
        save.confirmSave();
      } else {
        setIdeType(newType);
        setCustomCommand(newCustomCommand);
        save.resetFromServer();
      }
    }

    subscribe("settings:data", handleMessage);
    send({ type: "settings:get" });

    return function () {
      unsubscribe("settings:data", handleMessage);
    };
  }, []);

  function handleTypeChange(value: string) {
    setIdeType(value);
    save.markDirty();
  }

  function handleCustomCommandChange(value: string) {
    setCustomCommand(value);
    save.markDirty();
  }

  function handleSave() {
    save.startSave();
    var editorSettings: { type: string; customCommand?: string } = { type: ideType };
    if (ideType === "custom") {
      editorSettings.customCommand = customCommand;
    }
    var updateMsg: SettingsUpdateMessage = {
      type: "settings:update",
      settings: { editor: editorSettings } as SettingsUpdateMessage["settings"],
    };
    send(updateMsg);
  }

  return (
    <div className="py-2">
      <div className="mb-5">
        <label htmlFor="editor-ide-type" className="block text-[12px] font-semibold text-base-content/40 mb-1">IDE</label>
        <p className="text-[11px] text-base-content/30 mb-2">Choose your preferred editor for opening files from Lattice.</p>
        <p className="text-[11px] text-base-content/20 mb-2">Files open via your editor's URL scheme handler.</p>
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
