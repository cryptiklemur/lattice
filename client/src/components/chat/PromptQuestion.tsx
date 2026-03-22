import { useState } from "react";
import { Check, MessageCircleQuestion } from "lucide-react";
import type { HistoryMessage } from "@lattice/shared";
import { useWebSocket } from "../../hooks/useWebSocket";
import { resolvePromptQuestion } from "../../stores/session";

interface PromptQuestionProps {
  message: HistoryMessage;
}

export function PromptQuestion(props: PromptQuestionProps) {
  var msg = props.message;
  var { send } = useWebSocket();
  var [otherText, setOtherText] = useState("");
  var [selectedMulti, setSelectedMulti] = useState<Set<string>>(new Set());

  var questions = msg.promptQuestions || [];
  var answers = msg.promptAnswers;
  var status = msg.promptStatus || "pending";
  var requestId = msg.toolId || "";

  function submitAnswer(questionText: string, answer: string) {
    var answerMap: Record<string, string> = {};
    answerMap[questionText] = answer;
    resolvePromptQuestion(requestId, answerMap);
    send({
      type: "chat:prompt_response",
      requestId: requestId,
      answers: answerMap,
    });
  }

  function submitMultiSelect(questionText: string) {
    var answer = Array.from(selectedMulti).join(", ");
    submitAnswer(questionText, answer);
  }

  function submitOther(questionText: string) {
    if (!otherText.trim()) return;
    submitAnswer(questionText, otherText.trim());
  }

  if (status === "answered" && answers) {
    return (
      <div className="px-5 py-1.5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-base-300/50 border border-base-content/5 text-[12px]">
          <Check size={14} className="text-success/70 flex-shrink-0" />
          <span className="text-base-content/40 font-mono">Answered:</span>
          {Object.entries(answers).map(function (entry) {
            return (
              <span key={entry[0]} className="text-base-content/70">
                {entry[1]}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  if (status === "timed_out") {
    return (
      <div className="px-5 py-1.5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/5 border border-warning/20 text-[12px] text-warning/60">
          Prompt timed out
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-2">
      {questions.map(function (q, qi) {
        return (
          <div
            key={qi}
            className="rounded-xl border border-primary/20 bg-base-300/60 overflow-hidden shadow-sm"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-base-content/6 bg-base-content/3">
              <MessageCircleQuestion size={14} className="text-primary/50 flex-shrink-0" />
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-primary/40">{q.header}</span>
            </div>

            <div className="px-4 py-3">
              <div className="text-[13px] text-base-content/80 mb-3 leading-relaxed">{q.question}</div>

              <div className="flex flex-col gap-1.5" role={q.multiSelect ? "group" : "radiogroup"} aria-label={q.question}>
                {q.options.map(function (opt, oi) {
                  var isSelected = selectedMulti.has(opt.label);
                  return (
                    <button
                      key={oi}
                      onClick={function () {
                        if (q.multiSelect) {
                          setSelectedMulti(function (prev) {
                            var next = new Set(prev);
                            if (next.has(opt.label)) {
                              next.delete(opt.label);
                            } else {
                              next.add(opt.label);
                            }
                            return next;
                          });
                        } else {
                          submitAnswer(q.question, opt.label);
                        }
                      }}
                      className={
                        "text-left px-3 py-2 rounded-lg text-[12px] transition-colors " +
                        (isSelected
                          ? "bg-primary/15 border border-primary/30 text-base-content/80"
                          : "bg-base-content/3 border border-base-content/8 text-base-content/60 hover:bg-base-content/6 hover:border-base-content/12")
                      }
                    >
                      <div className="font-medium">{opt.label}</div>
                      {opt.description && (
                        <div className="text-[11px] text-base-content/40 mt-0.5">{opt.description}</div>
                      )}
                    </button>
                  );
                })}

                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    placeholder="Other..."
                    value={otherText}
                    onChange={function (e) { setOtherText(e.target.value); }}
                    onKeyDown={function (e) {
                      if (e.key === "Enter" && !q.multiSelect) {
                        submitOther(q.question);
                      }
                    }}
                    className="flex-1 bg-base-content/3 border border-base-content/8 rounded-lg px-3 py-1.5 text-[12px] text-base-content/60 placeholder:text-base-content/25 outline-none focus:border-primary/30"
                  />
                  {!q.multiSelect && otherText.trim() && (
                    <button
                      onClick={function () { submitOther(q.question); }}
                      className="px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-[11px] font-medium hover:bg-primary/25 transition-colors"
                    >
                      Submit
                    </button>
                  )}
                </div>

                {q.multiSelect && (
                  <button
                    onClick={function () { submitMultiSelect(q.question); }}
                    disabled={selectedMulti.size === 0 && !otherText.trim()}
                    className={
                      "mt-1 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors " +
                      (selectedMulti.size > 0 || otherText.trim()
                        ? "bg-primary text-primary-content hover:bg-primary/80"
                        : "bg-base-content/5 text-base-content/20 cursor-not-allowed")
                    }
                  >
                    Submit ({selectedMulti.size} selected)
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
