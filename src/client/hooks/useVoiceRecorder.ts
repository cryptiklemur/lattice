import { useState, useCallback, useRef } from "react";

interface SpeechRecognitionResult {
  readonly transcript: string;
  readonly confidence: number;
  readonly isFinal: boolean;
}

interface SpeechRecognitionResultItem {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResultItem;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

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
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const startTimeRef = useRef(0);

  interimTranscriptRef.current = interimTranscript;

  const SpeechRecognitionClass = typeof window !== "undefined"
    ? (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition
    : undefined;

  const isSupported = !!SpeechRecognitionClass;

  const cleanup = useCallback(function () {
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

  const start = useCallback(function () {
    if (!SpeechRecognitionClass || isRecording) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    recognitionRef.current = recognition;
    finalTranscriptRef.current = "";

    recognition.onresult = function (event: SpeechRecognitionEvent) {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
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

  const stop = useCallback(function (): string {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    const transcript = finalTranscriptRef.current || interimTranscriptRef.current;
    cleanup();
    return transcript;
  }, [cleanup]);

  const cancel = useCallback(function () {
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
