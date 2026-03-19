import { useState } from "react";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import type { ProjectSettings, McpServerConfig } from "@lattice/shared";

type ServerType = "stdio" | "http" | "sse";

interface FormState {
  name: string;
  serverType: ServerType;
  command: string;
  args: string;
  env: string;
  url: string;
}

function emptyForm(): FormState {
  return { name: "", serverType: "stdio", command: "", args: "", env: "", url: "" };
}

function formFromConfig(name: string, config: McpServerConfig): FormState {
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

function formToConfig(form: FormState): McpServerConfig {
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

function typeBadge(config: McpServerConfig) {
  var t = config.type === "http" ? "http" : config.type === "sse" ? "sse" : "stdio";
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-mono bg-base-content/10 text-base-content/50">
      {t}
    </span>
  );
}

function configSummary(config: McpServerConfig) {
  if (config.type === "http" || config.type === "sse") {
    return <span className="font-mono text-[11px] text-base-content/40 truncate">{config.url}</span>;
  }
  var cmd = config.command + ((config.args?.length ?? 0) > 0 ? " " + config.args!.join(" ") : "");
  return <span className="font-mono text-[11px] text-base-content/40 truncate">{cmd}</span>;
}

function ServerForm({
  form,
  setForm,
  onSave,
  onCancel,
  existingNames,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  onSave: () => void;
  onCancel: () => void;
  existingNames: Set<string>;
}) {
  var inputClass = "w-full h-9 sm:h-7 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content font-mono text-[12px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]";
  var nameConflict = form.name.trim() !== "" && existingNames.has(form.name.trim());
  var canSave = form.name.trim() !== "" && !nameConflict &&
    (form.serverType === "stdio" ? form.command.trim() !== "" : form.url.trim() !== "");

  return (
    <div className="border border-base-content/15 rounded-xl bg-base-300/40 p-4 flex flex-col gap-3">
      <div>
        <label className="block text-[11px] text-base-content/50 mb-1">Server Name</label>
        <input
          type="text"
          value={form.name}
          onChange={function (e) { setForm({ ...form, name: e.target.value }); }}
          placeholder="my-server"
          className={inputClass + (nameConflict ? " !border-warning" : "")}
        />
        {nameConflict && (
          <div className="text-[10px] text-warning mt-0.5">Name already in use</div>
        )}
      </div>

      <div>
        <label className="block text-[11px] text-base-content/50 mb-1.5">Type</label>
        <div className="flex gap-3">
          {(["stdio", "http", "sse"] as ServerType[]).map(function (t) {
            return (
              <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="server-type"
                  value={t}
                  checked={form.serverType === t}
                  onChange={function () { setForm({ ...form, serverType: t }); }}
                  className="radio radio-xs radio-primary"
                />
                <span className="text-[12px] font-mono text-base-content/70 uppercase">{t}</span>
              </label>
            );
          })}
        </div>
      </div>

      {form.serverType === "stdio" && (
        <>
          <div>
            <label className="block text-[11px] text-base-content/50 mb-1">Command</label>
            <input
              type="text"
              value={form.command}
              onChange={function (e) { setForm({ ...form, command: e.target.value }); }}
              placeholder="npx"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[11px] text-base-content/50 mb-1">Args (comma-separated)</label>
            <input
              type="text"
              value={form.args}
              onChange={function (e) { setForm({ ...form, args: e.target.value }); }}
              placeholder="-y, @modelcontextprotocol/server-filesystem"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[11px] text-base-content/50 mb-1">Environment (KEY=value, one per line)</label>
            <textarea
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
          <label className="block text-[11px] text-base-content/50 mb-1">URL</label>
          <input
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

export function ProjectMcp({
  settings,
  updateSection,
}: {
  settings: ProjectSettings;
  updateSection: (section: string, data: Record<string, unknown>) => void;
}) {
  var globalServers = settings.global.mcpServers ?? {};
  var globalEntries = Object.entries(globalServers);

  var [servers, setServers] = useState<Record<string, McpServerConfig>>(function () {
    return { ...(settings.mcpServers ?? {}) };
  });
  var [dirty, setDirty] = useState(false);
  var [saving, setSaving] = useState(false);
  var [saveState, setSaveState] = useState<"idle" | "saved">("idle");

  var [adding, setAdding] = useState(false);
  var [addForm, setAddForm] = useState<FormState>(emptyForm);
  var [editingName, setEditingName] = useState<string | null>(null);
  var [editForm, setEditForm] = useState<FormState>(emptyForm);

  var projectEntries = Object.entries(servers);

  function markDirty() {
    setDirty(true);
    setSaveState("idle");
  }

  function handleAddSave() {
    var name = addForm.name.trim();
    if (!name) return;
    var next = { ...servers, [name]: formToConfig(addForm) };
    setServers(next);
    setAdding(false);
    setAddForm(emptyForm());
    markDirty();
  }

  function handleEditStart(name: string) {
    setEditingName(name);
    setEditForm(formFromConfig(name, servers[name]));
    setAdding(false);
  }

  function handleEditSave() {
    if (!editingName) return;
    var newName = editForm.name.trim();
    if (!newName) return;
    var next = { ...servers };
    if (newName !== editingName) {
      delete next[editingName];
    }
    next[newName] = formToConfig(editForm);
    setServers(next);
    setEditingName(null);
    markDirty();
  }

  function handleDelete(name: string) {
    var next = { ...servers };
    delete next[name];
    setServers(next);
    if (editingName === name) setEditingName(null);
    markDirty();
  }

  function handleSave() {
    setSaving(true);
    updateSection("mcp", { mcpServers: servers });
    setSaving(false);
    setSaveState("saved");
    setDirty(false);
    setTimeout(function () { setSaveState("idle"); }, 1800);
  }

  var existingNamesForAdd = new Set(Object.keys(servers));
  var existingNamesForEdit = new Set(
    Object.keys(servers).filter(function (n) { return n !== editingName; })
  );

  return (
    <div className="py-2">
      <div className="mb-6">
        <h2 className="text-[13px] font-mono font-semibold text-base-content/60 uppercase tracking-wider mb-3">
          Global MCP Servers
        </h2>
        {globalEntries.length === 0 && (
          <div className="py-4 text-center text-[13px] text-base-content/30">
            No global MCP servers.
          </div>
        )}
        {globalEntries.length > 0 && (
          <div className="flex flex-col gap-2">
            {globalEntries.map(function ([name, config]) {
              return (
                <div
                  key={name}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl bg-base-300/50 border border-base-content/10"
                >
                  <span className="font-mono text-[12px] text-base-content/40 font-semibold">{name}</span>
                  {typeBadge(config)}
                  <div className="flex-1 min-w-0">{configSummary(config)}</div>
                  <span className="text-[10px] uppercase tracking-wider text-base-content/30">global</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-[13px] font-mono font-semibold text-base-content/60 uppercase tracking-wider mb-3">
          Project MCP Servers
        </h2>

        {projectEntries.length === 0 && !adding && (
          <div className="py-4 text-center text-[13px] text-base-content/30 mb-3">
            No project MCP servers.
          </div>
        )}

        <div className="flex flex-col gap-2 mb-3">
          {projectEntries.map(function ([name, config]) {
            if (editingName === name) {
              return (
                <ServerForm
                  key={name}
                  form={editForm}
                  setForm={setEditForm}
                  onSave={handleEditSave}
                  onCancel={function () { setEditingName(null); }}
                  existingNames={existingNamesForEdit}
                />
              );
            }
            return (
              <div
                key={name}
                className="flex items-center gap-3 px-3 py-2 rounded-xl bg-base-300 border border-base-content/15"
              >
                <span className="font-mono text-[12px] text-base-content font-semibold">{name}</span>
                {typeBadge(config)}
                <div className="flex-1 min-w-0">{configSummary(config)}</div>
                <button
                  onClick={function () { handleEditStart(name); }}
                  aria-label={"Edit " + name}
                  className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-primary"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={function () { handleDelete(name); }}
                  aria-label={"Delete " + name}
                  className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-error"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {adding && (
          <div className="mb-3">
            <ServerForm
              form={addForm}
              setForm={setAddForm}
              onSave={handleAddSave}
              onCancel={function () { setAdding(false); setAddForm(emptyForm()); }}
              existingNames={existingNamesForAdd}
            />
          </div>
        )}

        {!adding && (
          <button
            onClick={function () { setAdding(true); setEditingName(null); }}
            className="flex items-center gap-1.5 px-3 py-2.5 sm:py-1.5 rounded-lg border border-dashed border-base-content/20 bg-transparent text-base-content/40 text-[12px] hover:text-base-content/60 hover:border-base-content/30 transition-colors duration-[120ms] mb-5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-base-100"
          >
            <Plus size={12} />
            Add Server
          </button>
        )}

        <div className="flex items-center justify-end gap-3">
          {dirty && saveState === "idle" && !saving && (
            <div className="text-[11px] text-warning/70">Unsaved changes</div>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={
              "btn btn-sm " +
              (saveState === "saved" ? "btn-success" : "btn-primary") +
              ((saving || !dirty) ? " opacity-50 cursor-not-allowed" : "")
            }
          >
            {saving ? "Saving..." : saveState === "saved" ? "Saved" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
