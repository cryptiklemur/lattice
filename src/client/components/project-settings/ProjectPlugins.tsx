import { useState, useEffect } from "react";
import { Blocks, Loader2 } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { ProjectSettings, ServerMessage, PluginInfo } from "#shared";

interface ProjectPluginsProps {
  settings: ProjectSettings;
  updateSection: (section: string, data: Record<string, unknown>) => void;
}

export function ProjectPlugins({ settings, updateSection }: ProjectPluginsProps) {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var [plugins, setPlugins] = useState<PluginInfo[]>([]);
  var [loaded, setLoaded] = useState(false);
  var [disabledPlugins, setDisabledPlugins] = useState<string[]>(settings.disabledPlugins ?? []);
  var [saving, setSaving] = useState(false);

  useEffect(function () {
    function handleListResult(msg: ServerMessage) {
      if (msg.type !== "plugin:list_result") return;
      var data = msg as { type: "plugin:list_result"; plugins: PluginInfo[] };
      setPlugins(data.plugins);
      setLoaded(true);
    }

    subscribe("plugin:list_result", handleListResult);
    send({ type: "plugin:list" } as any);

    return function () {
      unsubscribe("plugin:list_result", handleListResult);
    };
  }, []);

  useEffect(function () {
    setDisabledPlugins(settings.disabledPlugins ?? []);
  }, [settings.disabledPlugins]);

  function handleToggle(pluginKey: string) {
    var next: string[];
    if (disabledPlugins.indexOf(pluginKey) !== -1) {
      next = disabledPlugins.filter(function (k) { return k !== pluginKey; });
    } else {
      next = disabledPlugins.concat(pluginKey);
    }
    setDisabledPlugins(next);
    setSaving(true);
    updateSection("plugins", { disabledPlugins: next });
    setTimeout(function () { setSaving(false); }, 500);
  }

  if (!loaded) {
    return <div className="text-[13px] text-base-content/40 py-4">Loading...</div>;
  }

  if (plugins.length === 0) {
    return (
      <div className="py-6 text-center text-[13px] text-base-content/30">
        No plugins installed. Install plugins from Global Settings to use them in projects.
      </div>
    );
  }

  var enabledCount = plugins.length - disabledPlugins.length;

  return (
    <div className="py-2 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-base-content/40">
          Toggle plugins on/off for this project. Disabled plugins won't load in new sessions.
        </p>
        {saving && <Loader2 size={12} className="text-primary animate-spin" />}
      </div>

      <div className="text-[11px] text-base-content/30 mb-1">
        {enabledCount} of {plugins.length} enabled
      </div>

      <div className="space-y-1.5">
        {plugins.map(function (plugin) {
          var isDisabled = disabledPlugins.indexOf(plugin.key) !== -1;
          return (
            <div
              key={plugin.key}
              className={
                "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors duration-[120ms] " +
                (isDisabled
                  ? "bg-base-300/30 border-base-content/8 opacity-50"
                  : "bg-base-300 border-base-content/15")
              }
            >
              <Blocks size={14} className="text-base-content/25 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-base-content truncate">{plugin.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-base-content/8 text-base-content/40">
                    v{plugin.version}
                  </span>
                </div>
                <div className="text-[11px] text-base-content/30 mt-0.5">
                  {plugin.marketplace}
                  {plugin.skillCount > 0 ? " \u00B7 " + plugin.skillCount + " skill" + (plugin.skillCount !== 1 ? "s" : "") : ""}
                </div>
              </div>
              <input
                type="checkbox"
                checked={!isDisabled}
                onChange={function () { handleToggle(plugin.key); }}
                className="toggle toggle-sm toggle-primary"
                aria-label={(isDisabled ? "Enable" : "Disable") + " " + plugin.name}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
