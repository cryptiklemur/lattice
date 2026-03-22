import { useState, useRef, useEffect } from "react";
import { Check, Circle, CheckCircle2, MessageCircleQuestion, ChevronDown, Send } from "lucide-react";
import type { HistoryMessage } from "@lattice/shared";
import { useWebSocket } from "../../hooks/useWebSocket";
import { resolvePromptQuestion } from "../../stores/session";

interface PromptQuestionProps {
  message: HistoryMessage;
}

var LETTERS = ["A", "B", "C", "D"];

export function PromptQuestion(props: PromptQuestionProps) {
  var msg = props.message;
  var { send } = useWebSocket();
  var [otherText, setOtherText] = useState("");
  var [selectedMulti, setSelectedMulti] = useState<Set<string>>(new Set());
  var [focusIndex, setFocusIndex] = useState(-1);
  var [expanded, setExpanded] = useState(false);
  var optionsRef = useRef<HTMLDivElement>(null);

  var questions = msg.promptQuestions || [];
  var answers = msg.promptAnswers;
  var status = msg.promptStatus || "pending";
  var requestId = msg.toolId || "";

  useEffect(function () {
    if (status === "pending" && optionsRef.current) {
      var firstBtn = optionsRef.current.querySelector("button");
      if (firstBtn) firstBtn.focus();
    }
  }, [status]);

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
    var parts = Array.from(selectedMulti);
    if (otherText.trim()) parts.push(otherText.trim());
    submitAnswer(questionText, parts.join(", "));
  }

  function submitOther(questionText: string) {
    if (!otherText.trim()) return;
    submitAnswer(questionText, otherText.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent, optionCount: number, q: { question: string; multiSelect: boolean }, options: Array<{ label: string }>) {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      var next = focusIndex < optionCount - 1 ? focusIndex + 1 : 0;
      setFocusIndex(next);
      var btns = optionsRef.current?.querySelectorAll("[data-option]");
      if (btns && btns[next]) (btns[next] as HTMLElement).focus();
    }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      var prev = focusIndex > 0 ? focusIndex - 1 : optionCount - 1;
      setFocusIndex(prev);
      var btns = optionsRef.current?.querySelectorAll("[data-option]");
      if (btns && btns[prev]) (btns[prev] as HTMLElement).focus();
    }
    if (e.key === "Enter" && !q.multiSelect && focusIndex >= 0 && focusIndex < options.length) {
      e.preventDefault();
      submitAnswer(q.question, options[focusIndex].label);
    }
  }

  if (status === "answered" && answers) {
    var firstAnswer = Object.entries(answers)[0];
    var answeredQuestion = questions.length > 0 ? questions[0] : null;
    return (
      <div className="px-5 py-1.5" aria-live="polite">
        <div
          className="rounded-xl border border-success/15 bg-base-300/40 overflow-hidden cursor-pointer transition-colors hover:bg-base-300/60"
          onClick={function () { setExpanded(!expanded); }}
        >
          <div className="flex items-center gap-2.5 px-4 py-2.5">
            <CheckCircle2 size={15} className="text-success/60 flex-shrink-0" />
            {answeredQuestion && (
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-base-content/30">{answeredQuestion.header}</span>
            )}
            <span className="text-[12px] text-base-content/50">{firstAnswer ? firstAnswer[0] : ""}</span>
            <span className="flex-1" />
            <span className="text-[12px] font-medium text-base-content/70">{firstAnswer ? firstAnswer[1] : ""}</span>
            <ChevronDown
              size={12}
              className={"text-base-content/25 transition-transform duration-200 " + (expanded ? "rotate-180" : "")}
            />
          </div>

          {expanded && answeredQuestion && (
            <div className="px-4 pb-3 border-t border-base-content/5">
              <div className="flex flex-col gap-1 pt-2">
                {answeredQuestion.options.map(function (opt, oi) {
                  var isChosen = firstAnswer && firstAnswer[1] === opt.label;
                  return (
                    <div
                      key={oi}
                      className={
                        "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] " +
                        (isChosen ? "bg-success/8 text-base-content/70" : "text-base-content/30")
                      }
                    >
                      <span className={
                        "w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold flex-shrink-0 " +
                        (isChosen ? "bg-success/20 text-success/80" : "bg-base-content/5 text-base-content/20")
                      }>
                        {LETTERS[oi] || ""}
                      </span>
                      <span className={isChosen ? "font-medium" : ""}>{opt.label}</span>
                      {isChosen && <Check size={12} className="text-success/60 ml-auto" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === "timed_out") {
    return (
      <div className="px-5 py-1.5">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-warning/5 border border-warning/15 text-[12px] text-warning/50 font-mono">
          <Circle size={13} className="flex-shrink-0" />
          Prompt timed out — no response sent
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-2" aria-live="polite">
      {questions.map(function (q, qi) {
        return (
          <div
            key={qi}
            className="rounded-xl border border-primary/15 bg-base-300/50 overflow-hidden shadow-[0_2px_8px_oklch(from_var(--color-primary)_l_c_h/0.06)]"
          >
            <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-base-content/5 bg-base-content/[0.02]">
              <MessageCircleQuestion size={14} className="text-primary/40 flex-shrink-0" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary/35">{q.header}</span>
              <span className="flex-1" />
              <span className="text-[9px] font-mono text-base-content/20">select one</span>
            </div>

            <div className="px-4 py-3.5">
              <div className="text-[13px] text-base-content/80 mb-3.5 leading-relaxed">{q.question}</div>

              <div
                ref={optionsRef}
                className="flex flex-col gap-1.5"
                role={q.multiSelect ? "group" : "radiogroup"}
                aria-label={q.question}
                onKeyDown={function (e) { handleKeyDown(e, q.options.length, q, q.options); }}
              >
                {q.options.map(function (opt, oi) {
                  var isSelected = selectedMulti.has(opt.label);
                  var isFocused = focusIndex === oi;
                  return (
                    <button
                      key={oi}
                      data-option={oi}
                      role={q.multiSelect ? "checkbox" : "radio"}
                      aria-checked={isSelected}
                      tabIndex={q.multiSelect ? 0 : (isFocused || (focusIndex === -1 && oi === 0) ? 0 : -1)}
                      onFocus={function () { setFocusIndex(oi); }}
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
                        "group text-left flex items-start gap-3 px-3.5 py-2.5 rounded-lg text-[12px] cursor-pointer transition-all duration-150 outline-none " +
                        (isSelected
                          ? "bg-primary/10 border border-primary/25 text-base-content/85 shadow-[0_0_0_1px_oklch(from_var(--color-primary)_l_c_h/0.1)]"
                          : "bg-base-content/[0.02] border border-base-content/8 text-base-content/60 hover:bg-base-content/5 hover:border-base-content/15 hover:text-base-content/75") +
                        " focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-base-300"
                      }
                    >
                      <span className={
                        "w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold flex-shrink-0 mt-px transition-colors duration-150 " +
                        (isSelected
                          ? "bg-primary/25 text-primary"
                          : "bg-base-content/6 text-base-content/30 group-hover:bg-base-content/10 group-hover:text-base-content/45")
                      }>
                        {q.multiSelect
                          ? (isSelected ? <Check size={11} /> : LETTERS[oi] || "")
                          : LETTERS[oi] || ""
                        }
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium leading-snug">{opt.label}</div>
                        {opt.description && (
                          <div className="text-[11px] text-base-content/35 mt-0.5 leading-relaxed group-hover:text-base-content/45 transition-colors duration-150">{opt.description}</div>
                        )}
                      </div>
                    </button>
                  );
                })}

                <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-base-content/5">
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
                    aria-label="Custom answer"
                    className="flex-1 bg-base-content/[0.02] border border-base-content/8 rounded-lg px-3 py-2 text-[12px] text-base-content/60 placeholder:text-base-content/20 outline-none focus:border-primary/30 focus:bg-base-content/[0.04] transition-colors duration-150"
                  />
                  {!q.multiSelect && otherText.trim() && (
                    <button
                      onClick={function () { submitOther(q.question); }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/15 text-primary text-[11px] font-medium hover:bg-primary/25 transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/40"
                      aria-label="Submit custom answer"
                    >
                      <Send size={10} />
                      Send
                    </button>
                  )}
                </div>

                {q.multiSelect && (
                  <button
                    onClick={function () { submitMultiSelect(q.question); }}
                    disabled={selectedMulti.size === 0 && !otherText.trim()}
                    className={
                      "mt-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-medium transition-all duration-150 cursor-pointer " +
                      (selectedMulti.size > 0 || otherText.trim()
                        ? "bg-primary text-primary-content hover:bg-primary/85 shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base-300"
                        : "bg-base-content/5 text-base-content/20 cursor-not-allowed")
                    }
                  >
                    <Send size={12} />
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
