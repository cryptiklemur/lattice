import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useSaveState } from "../../hooks/useSaveState";
import { SaveFooter } from "../ui/SaveFooter";
import type { ProjectSettings, McpServerConfig } from "@lattice/shared";
import {
  type FormState,
  emptyForm,
  formFromConfig,
  formToConfig,
  typeBadge,
  configSummary,
  ServerForm,
} from "../settings/mcp-shared";

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
  var save = useSaveState();

  var [adding, setAdding] = useState(false);
  var [addForm, setAddForm] = useState<FormState>(emptyForm);
  var [editingName, setEditingName] = useState<string | null>(null);
  var [editForm, setEditForm] = useState<FormState>(emptyForm);
  var [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(function () {
    if (save.savingRef.current) {
      save.confirmSave();
    } else {
      setServers({ ...(settings.mcpServers ?? {}) });
      save.resetFromServer();
    }
  }, [settings]);

  var projectEntries = Object.entries(servers);

  function handleAddSave() {
    var name = addForm.name.trim();
    if (!name) return;
    var next = { ...servers, [name]: formToConfig(addForm) };
    setServers(next);
    setAdding(false);
    setAddForm(emptyForm());
    save.markDirty();
  }

  function handleEditStart(name: string) {
    setEditingName(name);
    setEditForm(formFromConfig(name, servers[name]));
    setAdding(false);
    setConfirmDelete(null);
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
    save.markDirty();
  }

  function handleDelete(name: string) {
    if (confirmDelete !== name) {
      setConfirmDelete(name);
      return;
    }
    var next = { ...servers };
    delete next[name];
    setServers(next);
    if (editingName === name) setEditingName(null);
    setConfirmDelete(null);
    save.markDirty();
  }

  function handleSave() {
    save.startSave();
    updateSection("mcp", { mcpServers: servers });
  }

  var existingNamesForAdd = new Set(Object.keys(servers));
  var existingNamesForEdit = new Set(
    Object.keys(servers).filter(function (n) { return n !== editingName; })
  );

  return (
    <div className="py-2">
      <div className="mb-6">
        <h2 className="text-[12px] font-semibold text-base-content/40 mb-3">
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
                  <span className="font-mono text-[12px] text-base-content/40 font-semibold flex-shrink-0">{name}</span>
                  {typeBadge(config)}
                  <div className="flex-1 min-w-0">{configSummary(config)}</div>
                  <span className="text-[10px] uppercase tracking-wider text-base-content/30 flex-shrink-0">global</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-[12px] font-semibold text-base-content/40 mb-3">
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
                  idPrefix="mcp-edit"
                />
              );
            }
            var isConfirming = confirmDelete === name;
            return (
              <div
                key={name}
                className="flex items-center gap-3 px-3 py-2 rounded-xl bg-base-300 border border-base-content/15"
              >
                <span className="font-mono text-[12px] text-base-content font-semibold flex-shrink-0">{name}</span>
                {typeBadge(config)}
                <div className="flex-1 min-w-0">{configSummary(config)}</div>
                {isConfirming ? (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={function () { handleDelete(name); }}
                      className="btn btn-error btn-xs"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={function () { setConfirmDelete(null); }}
                      className="btn btn-ghost btn-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={function () { handleEditStart(name); }}
                      aria-label={"Edit " + name}
                      className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={function () { handleDelete(name); }}
                      aria-label={"Delete " + name}
                      className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-error focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
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
              idPrefix="mcp-add"
            />
          </div>
        )}

        {!adding && (
          <button
            onClick={function () { setAdding(true); setEditingName(null); setConfirmDelete(null); }}
            className="flex items-center gap-1.5 px-3 py-2.5 sm:py-1.5 rounded-xl border border-dashed border-base-content/20 bg-transparent text-base-content/40 text-[12px] hover:text-base-content/60 hover:border-base-content/30 transition-colors duration-[120ms] mb-5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-base-100"
          >
            <Plus size={12} />
            Add Server
          </button>
        )}

        <SaveFooter dirty={save.dirty} saving={save.saving} saveState={save.saveState} onSave={handleSave} />
      </div>
    </div>
  );
}
