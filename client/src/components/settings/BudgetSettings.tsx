import { useState, useEffect } from "react";
import { useStore } from "@tanstack/react-store";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSaveState } from "../../hooks/useSaveState";
import { SaveFooter } from "../ui/SaveFooter";
import { getSessionStore } from "../../stores/session";
import type { ServerMessage, SettingsDataMessage, SettingsUpdateMessage } from "@lattice/shared";

var ENFORCEMENT_OPTIONS = [
  { id: "warning", label: "Warning", description: "Shows a warning but does not block" },
  { id: "soft-block", label: "Confirm", description: "Asks for confirmation before sending" },
  { id: "hard-block", label: "Block", description: "Prevents sending until tomorrow" },
];

export function BudgetSettings() {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var budgetStatus = useStore(getSessionStore(), function (s) { return s.budgetStatus; });
  var [enabled, setEnabled] = useState(false);
  var [dailyLimit, setDailyLimit] = useState(10);
  var [enforcement, setEnforcement] = useState("warning");
  var save = useSaveState();

  useEffect(function () {
    function handleMessage(msg: ServerMessage) {
      if (msg.type !== "settings:data") return;
      var data = msg as SettingsDataMessage;
      var cfg = data.config;

      if (save.savingRef.current) {
        save.confirmSave();
      } else {
        if (cfg.costBudget) {
          setEnabled(true);
          setDailyLimit(cfg.costBudget.dailyLimit);
          setEnforcement(cfg.costBudget.enforcement);
        } else {
          setEnabled(false);
          setDailyLimit(10);
          setEnforcement("warning");
        }
        save.resetFromServer();
      }
    }

    subscribe("settings:data", handleMessage);
    send({ type: "settings:get" });

    return function () {
      unsubscribe("settings:data", handleMessage);
    };
  }, []);

  function handleSave() {
    save.startSave();
    var updateMsg: SettingsUpdateMessage = {
      type: "settings:update",
      settings: {
        costBudget: enabled ? { dailyLimit: dailyLimit, enforcement: enforcement as "warning" | "soft-block" | "hard-block" } : undefined,
      } as SettingsUpdateMessage["settings"],
    };
    send(updateMsg);
  }

  return (
    <div className="py-2">
      <p className="text-[12px] text-base-content/40 mb-5">
        Set a daily spending limit to control API costs. The budget resets at midnight.
      </p>

      {budgetStatus && (
        <div className="mb-5 p-3 rounded-xl bg-base-300 border border-base-content/10">
          <div className="text-[11px] text-base-content/40 font-mono mb-1">Today's spend</div>
          <div className="text-[18px] font-mono font-bold text-base-content">
            ${budgetStatus.dailySpend.toFixed(2)}
            {budgetStatus.dailyLimit > 0 && (
              <span className="text-[13px] text-base-content/30 font-normal">
                {" / $" + budgetStatus.dailyLimit.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mb-5">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={function (e) {
              setEnabled(e.target.checked);
              save.markDirty();
            }}
            className="toggle toggle-sm toggle-primary"
          />
          <span className="text-[13px] text-base-content">Enable daily budget</span>
        </label>
      </div>

      {enabled && (
        <>
          <div className="mb-5">
            <label htmlFor="budget-daily-limit" className="block text-[12px] font-semibold text-base-content/40 mb-2">
              Daily limit (USD)
            </label>
            <input
              id="budget-daily-limit"
              type="number"
              min={0.01}
              step={0.5}
              value={dailyLimit}
              onChange={function (e) {
                var val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) {
                  setDailyLimit(val);
                  save.markDirty();
                }
              }}
              className="w-full h-9 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content text-[13px] font-mono focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
            />
          </div>

          <div className="mb-6" role="radiogroup" aria-label="Enforcement mode">
            <div className="text-[12px] font-semibold text-base-content/40 mb-2">Enforcement</div>
            <div className="flex flex-col gap-2">
              {ENFORCEMENT_OPTIONS.map(function (opt) {
                var active = enforcement === opt.id;
                return (
                  <button
                    key={opt.id}
                    role="radio"
                    aria-checked={active}
                    onClick={function () {
                      setEnforcement(opt.id);
                      save.markDirty();
                    }}
                    className={
                      "w-full text-left px-3 py-2.5 rounded-lg border text-[12px] transition-colors duration-[120ms] cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-base-100 " +
                      (active
                        ? "border-primary bg-base-300 text-base-content"
                        : "border-base-content/15 bg-base-300 text-base-content/40 hover:border-base-content/30 hover:text-base-content/60")
                    }
                  >
                    <div className="font-semibold">{opt.label}</div>
                    <div className={"text-[11px] mt-0.5 " + (active ? "text-base-content/50" : "text-base-content/30")}>{opt.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
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
