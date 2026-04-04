import { useState } from "react";
import { Globe, FormInput, Check, X, ExternalLink } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";

interface ElicitationCardProps {
  requestId: string;
  serverName: string;
  message: string;
  mode: "form" | "url";
  url?: string | null;
  requestedSchema?: Record<string, unknown> | null;
  resolved?: boolean;
  resolvedAction?: "accept" | "decline";
}

interface SchemaProperty {
  type?: string;
  description?: string;
  enum?: string[];
  default?: unknown;
}

function renderFormField(
  key: string,
  prop: SchemaProperty,
  value: unknown,
  onChange: (key: string, val: unknown) => void,
  required: boolean,
) {
  var label = key.replace(/_/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });

  if (prop.type === "boolean") {
    return (
      <label key={key} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={!!value}
          onChange={function (e) { onChange(key, e.target.checked); }}
          className="checkbox checkbox-xs checkbox-primary"
        />
        <span className="text-[12px] text-base-content/70">{label}</span>
        {prop.description && (
          <span className="text-[10px] text-base-content/30" title={prop.description}>?</span>
        )}
      </label>
    );
  }

  if (prop.enum && prop.enum.length > 0) {
    return (
      <div key={key} className="flex flex-col gap-1">
        <label className="text-[10px] font-mono uppercase tracking-wider text-base-content/35">
          {label}{required && <span className="text-error/50 ml-0.5">*</span>}
        </label>
        <select
          value={String(value || "")}
          onChange={function (e) { onChange(key, e.target.value); }}
          className="select select-xs select-bordered bg-base-content/[0.03] text-[12px] text-base-content/70"
        >
          <option value="">Select...</option>
          {prop.enum.map(function (opt) {
            return <option key={opt} value={opt}>{opt}</option>;
          })}
        </select>
      </div>
    );
  }

  if (prop.type === "number" || prop.type === "integer") {
    return (
      <div key={key} className="flex flex-col gap-1">
        <label className="text-[10px] font-mono uppercase tracking-wider text-base-content/35">
          {label}{required && <span className="text-error/50 ml-0.5">*</span>}
        </label>
        <input
          type="number"
          value={value != null ? String(value) : ""}
          placeholder={prop.description || ""}
          onChange={function (e) { onChange(key, e.target.value ? Number(e.target.value) : ""); }}
          className="input input-xs input-bordered bg-base-content/[0.03] text-[12px] text-base-content/70 placeholder:text-base-content/20"
        />
      </div>
    );
  }

  return (
    <div key={key} className="flex flex-col gap-1">
      <label className="text-[10px] font-mono uppercase tracking-wider text-base-content/35">
        {label}{required && <span className="text-error/50 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={String(value || "")}
        placeholder={prop.description || ""}
        onChange={function (e) { onChange(key, e.target.value); }}
        className="input input-xs input-bordered bg-base-content/[0.03] text-[12px] text-base-content/70 placeholder:text-base-content/20"
      />
    </div>
  );
}

export function ElicitationCard(props: ElicitationCardProps) {
  var { send } = useWebSocket();
  var [formData, setFormData] = useState<Record<string, unknown>>({});
  var [submitted, setSubmitted] = useState(props.resolved || false);
  var [action, setAction] = useState<"accept" | "decline" | null>(props.resolvedAction || null);

  function handleFieldChange(key: string, value: unknown) {
    setFormData(function (prev) {
      var next = { ...prev };
      next[key] = value;
      return next;
    });
  }

  function handleSubmit(submitAction: "accept" | "decline") {
    setSubmitted(true);
    setAction(submitAction);
    send({
      type: "chat:elicitation_response",
      requestId: props.requestId,
      action: submitAction,
      content: submitAction === "accept" ? formData : undefined,
    } as any);
  }

  if (submitted) {
    var isAccepted = action === "accept";
    return (
      <div className="ml-14 mr-5 py-0.5 max-w-[95%] sm:max-w-[75%]">
        <div className={"rounded-lg text-[12px] border px-2.5 py-1.5 flex items-center gap-2 " + (isAccepted ? "border-success/15 bg-success/3" : "border-error/15 bg-error/3")}>
          {isAccepted ? <Check size={12} className="text-success" /> : <X size={12} className="text-error" />}
          <span className="text-base-content/35">{isAccepted ? "Submitted" : "Declined"}</span>
          <Globe size={11} className="text-base-content/20" />
          <span className="text-[11px] text-base-content/40">{props.serverName}</span>
        </div>
      </div>
    );
  }

  var schema = props.requestedSchema;
  var properties: Record<string, SchemaProperty> = {};
  var requiredFields: string[] = [];
  if (schema && typeof schema === "object") {
    if (schema.properties && typeof schema.properties === "object") {
      properties = schema.properties as Record<string, SchemaProperty>;
    }
    if (Array.isArray(schema.required)) {
      requiredFields = schema.required as string[];
    }
  }
  var hasFormFields = Object.keys(properties).length > 0;

  return (
    <div className="ml-14 mr-5 py-1 max-w-[95%] sm:max-w-[75%]">
      <div className="border border-info/25 bg-info/5 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-base-content/5 bg-base-content/[0.02]">
          {props.mode === "url"
            ? <Globe size={14} className="text-info/50 flex-shrink-0" />
            : <FormInput size={14} className="text-info/50 flex-shrink-0" />
          }
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-info/40">
            {props.serverName}
          </span>
          <span className="flex-1" />
          <span className="text-[9px] font-mono text-base-content/20">{props.mode} input</span>
        </div>

        <div className="px-3.5 py-3">
          {props.message && (
            <div className="text-[13px] text-base-content/75 mb-3 leading-relaxed">{props.message}</div>
          )}

          {props.mode === "url" && props.url && (
            <div className="flex flex-col gap-2">
              <a
                href={props.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-base-content/[0.04] border border-base-content/8 text-[12px] text-info/70 hover:bg-base-content/[0.07] hover:border-info/20 transition-colors"
              >
                <ExternalLink size={12} />
                <span className="truncate flex-1">{props.url}</span>
              </a>
            </div>
          )}

          {props.mode === "form" && hasFormFields && (
            <div className="flex flex-col gap-2.5">
              {Object.entries(properties).map(function ([key, prop]) {
                return renderFormField(
                  key,
                  prop,
                  formData[key],
                  handleFieldChange,
                  requiredFields.includes(key),
                );
              })}
            </div>
          )}

          {props.mode === "form" && !hasFormFields && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-base-content/35">Response</label>
              <textarea
                rows={3}
                value={String(formData._raw || "")}
                onChange={function (e) { handleFieldChange("_raw", e.target.value); }}
                placeholder="Enter your response..."
                className="textarea textarea-bordered textarea-xs bg-base-content/[0.03] text-[12px] text-base-content/70 placeholder:text-base-content/20"
              />
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={function () { handleSubmit("accept"); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/15 text-success text-[11px] font-medium hover:bg-success/25 transition-colors cursor-pointer"
            >
              <Check size={11} />
              {props.mode === "url" ? "Done" : "Submit"}
            </button>
            <button
              onClick={function () { handleSubmit("decline"); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-base-content/5 text-base-content/40 text-[11px] font-medium hover:bg-base-content/10 hover:text-base-content/60 transition-colors cursor-pointer"
            >
              <X size={11} />
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
