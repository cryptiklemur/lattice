import { Mic } from "lucide-react";

interface VoiceRecorderProps {
  isRecording: boolean;
  isSupported: boolean;
  isSpeaking: boolean;
  elapsed: number;
  interimTranscript: string;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
}

function formatTime(seconds: number): string {
  var m = Math.floor(seconds / 60);
  var s = seconds % 60;
  return m + ":" + (s < 10 ? "0" : "") + s;
}

export function VoiceRecorder(props: VoiceRecorderProps) {
  if (!props.isRecording) {
    return (
      <button
        aria-label={props.isSupported ? "Start voice input" : "Voice input not supported"}
        disabled={!props.isSupported}
        onClick={props.onStart}
        className={
          "w-7 h-7 rounded-md flex items-center justify-center transition-colors flex-shrink-0 " +
          (props.isSupported
            ? "text-base-content/30 hover:text-base-content/50 border border-base-content/10 hover:border-base-content/20"
            : "text-base-content/15 cursor-not-allowed")
        }
        title={props.isSupported ? "Voice input" : "Voice input not supported in this browser"}
      >
        <Mic size={13} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <button
        aria-label="Stop recording"
        onClick={props.onStop}
        className="w-7 h-7 rounded-md flex items-center justify-center bg-error/15 text-error border border-error/30 animate-pulse flex-shrink-0"
      >
        <Mic size={13} />
      </button>

      <div className="flex items-center gap-[2px] h-5" aria-hidden="true">
        {Array.from({ length: 8 }).map(function (_, i) {
          return (
            <div
              key={i}
              className={
                "w-[2px] rounded-sm bg-error transition-all duration-300 " +
                (props.isSpeaking ? "animate-waveform" : "")
              }
              style={{
                height: props.isSpeaking ? undefined : "4px",
                opacity: props.isSpeaking ? undefined : 0.3,
                animationDelay: (i * 0.1) + "s",
              }}
            />
          );
        })}
      </div>

      <span className="text-[12px] text-error font-mono flex-shrink-0">{formatTime(props.elapsed)}</span>

      {props.interimTranscript && (
        <span className="text-[11px] text-base-content/30 truncate flex-1 min-w-0">
          {props.interimTranscript.slice(-60)}
        </span>
      )}

      <button
        onClick={props.onCancel}
        className="text-[11px] text-base-content/40 hover:text-base-content/60 border border-base-content/10 rounded-md px-2 py-0.5 flex-shrink-0"
      >
        Cancel
      </button>
    </div>
  );
}
