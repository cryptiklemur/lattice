import { useState, useCallback, useRef } from "react";

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

export interface UseVoiceRecorderReturn {
  isRecording: boolean;
  isSupported: boolean;
  isSpeaking: boolean;
  elapsed: number;
  interimTranscript: string;
  start: () => void;
  stop: () => string;
  cancel: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  var [isRecording, setIsRecording] = useState(false);
  var [isSpeaking, setIsSpeaking] = useState(false);
  var [elapsed, setElapsed] = useState(0);
  var [interimTranscript, setInterimTranscript] = useState("");

  var recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  var timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  var finalTranscriptRef = useRef("");
  var startTimeRef = useRef(0);

  var SpeechRecognitionClass = typeof window !== "undefined"
    ? (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition
    : undefined;

  var isSupported = !!SpeechRecognitionClass;

  var cleanup = useCallback(function () {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setIsSpeaking(false);
    setElapsed(0);
    setInterimTranscript("");
    recognitionRef.current = null;
  }, []);

  var start = useCallback(function () {
    if (!SpeechRecognitionClass || isRecording) return;

    var recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    recognitionRef.current = recognition;
    finalTranscriptRef.current = "";

    recognition.onresult = function (event: SpeechRecognitionEvent) {
      var interim = "";
      var final = "";
      for (var i = 0; i < event.results.length; i++) {
        var result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      finalTranscriptRef.current = final;
      setInterimTranscript(final + interim);
    };

    recognition.onspeechstart = function () {
      setIsSpeaking(true);
    };

    recognition.onspeechend = function () {
      setIsSpeaking(false);
    };

    recognition.onerror = function (event: SpeechRecognitionErrorEvent) {
      console.error("[voice] Recognition error:", event.error);
      cleanup();
    };

    recognition.onend = function () {
      cleanup();
    };

    recognition.start();
    setIsRecording(true);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(function () {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, [SpeechRecognitionClass, isRecording, cleanup]);

  var stop = useCallback(function (): string {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    var transcript = finalTranscriptRef.current || interimTranscript;
    cleanup();
    return transcript;
  }, [interimTranscript, cleanup]);

  var cancel = useCallback(function () {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    finalTranscriptRef.current = "";
    cleanup();
  }, [cleanup]);

  return {
    isRecording,
    isSupported,
    isSpeaking,
    elapsed,
    interimTranscript,
    start,
    stop,
    cancel,
  };
}
