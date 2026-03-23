import { useState, useMemo } from "react";
import { icons } from "lucide-react";
import type { ProjectIcon } from "@lattice/shared";

type Tab = "lucide" | "text" | "upload";

interface IconPickerProps {
  value?: ProjectIcon;
  onChange: (icon: ProjectIcon) => void;
}

function renderPreview(value?: ProjectIcon) {
  if (!value) {
    return (
      <div className="w-8 h-8 rounded-lg bg-base-300 border border-base-content/15 flex items-center justify-center text-base-content/30 text-[11px]">
        ?
      </div>
    );
  }

  if (value.type === "lucide") {
    var LucideIcon = icons[value.name as keyof typeof icons];
    if (!LucideIcon) return null;
    return (
      <div className="w-8 h-8 rounded-lg bg-base-300 border border-base-content/15 flex items-center justify-center text-base-content">
        <LucideIcon size={18} />
      </div>
    );
  }

  if (value.type === "text") {
    return (
      <div
        className="w-8 h-8 rounded-lg bg-base-300 border border-base-content/15 flex items-center justify-center text-[14px] font-bold"
        style={value.color ? { color: value.color } : undefined}
      >
        {value.value}
      </div>
    );
  }

  if (value.type === "image") {
    return (
      <img src={value.path} alt="icon" className="w-8 h-8 rounded-lg object-cover border border-base-content/15" loading="lazy" />
    );
  }

  return null;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  var normalizedValue = value && (value as { type: string }).type === "emoji" ? undefined : value;
  var [tab, setTab] = useState<Tab>(normalizedValue?.type === "text" ? "text" : normalizedValue?.type === "image" ? "upload" : "lucide");
  var [search, setSearch] = useState("");
  var [textValue, setTextValue] = useState(normalizedValue?.type === "text" ? normalizedValue.value : "");
  var [textColor, setTextColor] = useState(normalizedValue?.type === "text" ? (normalizedValue.color || "#ffffff") : "#ffffff");

  var iconNames = useMemo(function () {
    var allNames = Object.keys(icons);
    if (!search.trim()) return allNames.slice(0, 60);
    var term = search.toLowerCase();
    return allNames.filter(function (name) {
      return name.toLowerCase().includes(term);
    }).slice(0, 60);
  }, [search]);

  var tabs: { id: Tab; label: string }[] = [
    { id: "lucide", label: "Lucide" },
    { id: "text", label: "Text" },
    { id: "upload", label: "Upload" },
  ];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    var file = e.target.files?.[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var dataUrl = ev.target?.result as string;
      onChange({ type: "image", path: dataUrl });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {renderPreview(normalizedValue)}
        <span className="text-[11px] text-base-content/40">Current icon</span>
      </div>

      <div className="flex gap-1">
        {tabs.map(function (t) {
          return (
            <button
              key={t.id}
              type="button"
              onClick={function () { setTab(t.id); }}
              className={"btn btn-xs " + (tab === t.id ? "btn-primary" : "btn-ghost")}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "lucide" && (
        <div className="space-y-2">
          <input
            type="text"
            value={search}
            onChange={function (e) { setSearch(e.target.value); }}
            placeholder="Search icons..."
            className="w-full h-8 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content text-[12px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
          />
          <div className="grid grid-cols-10 gap-1 max-h-48 overflow-y-auto">
            {iconNames.map(function (name) {
              var Icon = icons[name as keyof typeof icons];
              var selected = normalizedValue?.type === "lucide" && normalizedValue.name === name;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={function () { onChange({ type: "lucide", name: name }); }}
                  className={
                    "w-8 h-8 flex items-center justify-center rounded-lg text-base-content transition-colors duration-75 " +
                    (selected ? "border border-primary bg-base-300" : "hover:bg-base-300")
                  }
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === "text" && (
        <div className="flex gap-2">
          <input
            type="text"
            value={textValue}
            maxLength={2}
            onChange={function (e) {
              setTextValue(e.target.value);
              if (e.target.value) {
                onChange({ type: "text", value: e.target.value, color: textColor });
              }
            }}
            placeholder="1-2 chars"
            className="flex-1 h-9 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content text-[13px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
          />
          <input
            type="color"
            value={textColor}
            onChange={function (e) {
              setTextColor(e.target.value);
              if (textValue) {
                onChange({ type: "text", value: textValue, color: e.target.value });
              }
            }}
            className="w-9 h-9 rounded-xl border border-base-content/15 bg-base-300 cursor-pointer"
          />
        </div>
      )}

      {tab === "upload" && (
        <div className="space-y-2">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full text-[12px] text-base-content/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[12px] file:bg-base-300 file:text-base-content/60 file:cursor-pointer"
          />
          {normalizedValue?.type === "image" && (
            <img src={normalizedValue.path} alt="preview" className="w-16 h-16 rounded-xl object-cover border border-base-content/15" loading="lazy" />
          )}
        </div>
      )}
    </div>
  );
}
