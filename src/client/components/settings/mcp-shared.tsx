import type { McpServerConfig } from "#shared";

export type ServerType = "stdio" | "http" | "sse";

export interface FormState {
  name: string;
  serverType: ServerType;
  command: string;
  args: string;
  env: string;
  url: string;
}

export function emptyForm(): FormState {
  return { name: "", serverType: "stdio", command: "", args: "", env: "", url: "" };
}

export function formFromConfig(name: string, config: McpServerConfig): FormState {
  var serverType: ServerType = config.type === "http" ? "http" : config.type === "sse" ? "sse" : "stdio";
  if (serverType === "stdio" && "command" in config) {
    return {
      name,
      serverType,
      command: config.command,
      args: (config.args ?? []).join(", "),
      env: Object.entries(config.env ?? {}).map(function ([k, v]) { return k + "=" + v; }).join("\n"),
      url: "",
    };
  }
  if ("url" in config) {
    return { name, serverType, command: "", args: "", env: "", url: config.url };
  }
  return { ...emptyForm(), name, serverType };
}

export function formToConfig(form: FormState): McpServerConfig {
  if (form.serverType === "stdio") {
    var argsArr = form.args.trim()
      ? form.args.split(",").map(function (s) { return s.trim(); }).filter(Boolean)
      : [];
    var envObj: Record<string, string> = {};
    form.env.split("\n").forEach(function (line) {
      var idx = line.indexOf("=");
      if (idx > 0) {
        envObj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    });
    var result: McpServerConfig = { type: "stdio", command: form.command.trim(), args: argsArr };
    if (Object.keys(envObj).length > 0) {
      (result as { env?: Record<string, string> }).env = envObj;
    }
    return result;
  }
  return { type: form.serverType, url: form.url.trim() };
}

export function typeBadge(config: McpServerConfig) {
  var t = config.type === "http" ? "http" : config.type === "sse" ? "sse" : "stdio";
  return (
    <span className="px-1.5 py-0.5 rounded-lg text-[10px] uppercase tracking-wider font-mono bg-base-content/10 text-base-content/40 flex-shrink-0">
      {t}
    </span>
  );
}

export function configSummary(config: McpServerConfig) {
  if (config.type === "http" || config.type === "sse") {
    return <div className="font-mono text-[11px] text-base-content/40 truncate">{config.url}</div>;
  }
  var cmd = config.command + ((config.args?.length ?? 0) > 0 ? " " + config.args!.join(" ") : "");
  return <div className="font-mono text-[11px] text-base-content/40 truncate">{cmd}</div>;
}

export function ServerForm({
  form,
  setForm,
  onSave,
  onCancel,
  existingNames,
  idPrefix,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  onSave: () => void;
  onCancel: () => void;
  existingNames: Set<string>;
  idPrefix: string;
}) {
  var inputClass = "w-full h-9 sm:h-7 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content font-mono text-[12px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]";
  var nameConflict = form.name.trim() !== "" && existingNames.has(form.name.trim());
  var canSave = form.name.trim() !== "" && !nameConflict &&
    (form.serverType === "stdio" ? form.command.trim() !== "" : form.url.trim() !== "");

  return (
    <div className="border border-base-content/15 rounded-xl bg-base-300/40 p-4 flex flex-col gap-3">
      <div>
        <label htmlFor={idPrefix + "-name"} className="block text-[11px] text-base-content/40 mb-1">Server Name</label>
        <input
          id={idPrefix + "-name"}
          type="text"
          value={form.name}
          onChange={function (e) { setForm({ ...form, name: e.target.value }); }}
          placeholder="my-server"
          className={"w-full h-9 sm:h-7 px-3 bg-base-300 border rounded-xl text-base-content font-mono text-[12px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms] " + (nameConflict ? "border-warning" : "border-base-content/15")}
        />
        {nameConflict && (
          <div className="text-[10px] text-warning mt-0.5" role="alert">Name already in use</div>
        )}
      </div>

      <fieldset>
        <legend className="block text-[11px] text-base-content/40 mb-1.5">Type</legend>
        <div className="flex gap-3">
          {(["stdio", "http", "sse"] as ServerType[]).map(function (t) {
            return (
              <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name={idPrefix + "-type"}
                  value={t}
                  checked={form.serverType === t}
                  onChange={function () { setForm({ ...form, serverType: t }); }}
                  className="radio radio-xs radio-primary"
                />
                <span className="text-[12px] font-mono text-base-content uppercase">{t}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {form.serverType === "stdio" && (
        <>
          <div>
            <label htmlFor={idPrefix + "-command"} className="block text-[11px] text-base-content/40 mb-1">Command</label>
            <input
              id={idPrefix + "-command"}
              type="text"
              value={form.command}
              onChange={function (e) { setForm({ ...form, command: e.target.value }); }}
              placeholder="npx"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={idPrefix + "-args"} className="block text-[11px] text-base-content/40 mb-1">Args (comma-separated)</label>
            <input
              id={idPrefix + "-args"}
              type="text"
              value={form.args}
              onChange={function (e) { setForm({ ...form, args: e.target.value }); }}
              placeholder="-y, @modelcontextprotocol/server-filesystem"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={idPrefix + "-env"} className="block text-[11px] text-base-content/40 mb-1">Environment (KEY=value, one per line)</label>
            <textarea
              id={idPrefix + "-env"}
              value={form.env}
              onChange={function (e) { setForm({ ...form, env: e.target.value }); }}
              placeholder={"API_KEY=abc123\nDEBUG=true"}
              rows={3}
              className="w-full px-3 py-2 bg-base-300 border border-base-content/15 rounded-xl text-base-content font-mono text-[12px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms] resize-y"
            />
          </div>
        </>
      )}

      {(form.serverType === "http" || form.serverType === "sse") && (
        <div>
          <label htmlFor={idPrefix + "-url"} className="block text-[11px] text-base-content/40 mb-1">URL</label>
          <input
            id={idPrefix + "-url"}
            type="text"
            value={form.url}
            onChange={function (e) { setForm({ ...form, url: e.target.value }); }}
            placeholder="http://localhost:3000/mcp"
            className={inputClass}
          />
        </div>
      )}

      <div className="flex items-center gap-2 justify-end pt-1">
        <button onClick={onCancel} className="btn btn-ghost btn-sm text-[12px]">
          Cancel
        </button>
        <button onClick={onSave} disabled={!canSave} className={"btn btn-primary btn-sm text-[12px]" + (!canSave ? " opacity-50 cursor-not-allowed" : "")}>
          Save
        </button>
      </div>
    </div>
  );
}
