import { useState, useCallback, useRef, useEffect } from "react";
import { useWebSocket } from "./useWebSocket";
import type { ServerMessage } from "#shared";

const CHUNK_SIZE = 64 * 1024;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_ATTACHMENTS = 20;
const CHUNK_TIMEOUT_MS = 10000;
const UPLOAD_TIMEOUT_MS = 30000;

export type AttachmentStatus = "uploading" | "ready" | "failed";

export interface ClientAttachment {
  id: string;
  name: string;
  type: "file" | "image" | "paste";
  mimeType: string;
  size: number;
  lineCount?: number;
  status: AttachmentStatus;
  progress: number;
  error?: string;
  previewUrl?: string;
  content?: string;
}

export interface UseAttachmentsReturn {
  attachments: ClientAttachment[];
  addFile: (file: File) => void;
  addPaste: (text: string) => void;
  removeAttachment: (id: string) => void;
  retryAttachment: (id: string) => void;
  clearAll: () => void;
  readyIds: string[];
  hasUploading: boolean;
  canAttach: boolean;
}

function guessMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "application/typescript",
    tsx: "application/typescript",
    js: "application/javascript",
    jsx: "application/javascript",
    json: "application/json",
    yaml: "application/yaml",
    yml: "application/yaml",
    md: "text/markdown",
    txt: "text/plain",
    csv: "text/csv",
    py: "text/x-python",
    rs: "text/x-rust",
    go: "text/x-go",
    rb: "text/x-ruby",
    sh: "text/x-shellscript",
    css: "text/css",
    html: "text/html",
    xml: "application/xml",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
  };
  return map[ext] || "application/octet-stream";
}

function isImageType(mime: string): boolean {
  return mime.startsWith("image/") && mime !== "image/svg+xml";
}

export function useAttachments(): UseAttachmentsReturn {
  const [attachments, setAttachments] = useState<ClientAttachment[]>([]);
  const { send, subscribe, unsubscribe } = useWebSocket();
  const pendingResolvers = useRef(new Map<string, { resolve: () => void; reject: (err: string) => void; timer: ReturnType<typeof setTimeout> }>());
  const uploadTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const fileCache = useRef(new Map<string, File>());
  const sendRef = useRef(send);
  sendRef.current = send;
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  const updateAttachment = useCallback(function (id: string, updates: Partial<ClientAttachment>) {
    setAttachments(function (prev) {
      return prev.map(function (a) {
        return a.id === id ? { ...a, ...updates } : a;
      });
    });
  }, []);

  useEffect(function () {
    function handleProgress(msg: ServerMessage) {
      const m = msg as { type: string; attachmentId: string; received: number; total: number };
      const key = m.attachmentId + ":" + (m.received - 1);
      const resolver = pendingResolvers.current.get(key);
      if (resolver) {
        pendingResolvers.current.delete(key);
        resolver.resolve();
      }
      if (m.received === m.total) {
        updateAttachment(m.attachmentId, { status: "ready", progress: 100 });
        const timer = uploadTimers.current.get(m.attachmentId);
        if (timer) {
          clearTimeout(timer);
          uploadTimers.current.delete(m.attachmentId);
        }
      }
    }

    function handleError(msg: ServerMessage) {
      const m = msg as { type: string; attachmentId: string; error: string };
      updateAttachment(m.attachmentId, { status: "failed", error: m.error });
      const timer = uploadTimers.current.get(m.attachmentId);
      if (timer) {
        clearTimeout(timer);
        uploadTimers.current.delete(m.attachmentId);
      }
    }

    subscribe("attachment:progress", handleProgress);
    subscribe("attachment:error", handleError);
    return function () {
      unsubscribe("attachment:progress", handleProgress);
      unsubscribe("attachment:error", handleError);
    };
  }, [subscribe, unsubscribe, updateAttachment]);

  const uploadFile = useCallback(function (attachment: ClientAttachment, file: File) {
    const attachmentId = attachment.id;

    const overallTimer = setTimeout(function () {
      updateAttachment(attachmentId, { status: "failed", error: "Upload timed out" });
    }, UPLOAD_TIMEOUT_MS);
    uploadTimers.current.set(attachmentId, overallTimer);

    const reader = new FileReader();
    reader.onerror = function () {
      clearTimeout(overallTimer);
      uploadTimers.current.delete(attachmentId);
      updateAttachment(attachmentId, { status: "failed", error: "Failed to read file" });
    };
    reader.onload = function () {
      const buffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(buffer);
      const totalChunks = Math.ceil(bytes.length / CHUNK_SIZE);

      let chunkIndex = 0;

      function sendNextChunk() {
        if (chunkIndex >= totalChunks) {
          sendRef.current({
            type: "attachment:complete",
            attachmentId: attachmentId,
            attachmentType: attachment.type,
            name: attachment.name,
            mimeType: attachment.mimeType,
            size: attachment.size,
            lineCount: attachment.lineCount,
          });
          return;
        }

        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, bytes.length);
        const chunk = bytes.slice(start, end);
        let binary = "";
        for (let bi = 0; bi < chunk.length; bi++) {
          binary += String.fromCharCode(chunk[bi]);
        }
        const base64 = btoa(binary);

        sendRef.current({
          type: "attachment:chunk",
          attachmentId: attachmentId,
          chunkIndex,
          totalChunks,
          data: base64,
        });

        const currentChunk = chunkIndex;
        const chunkTimer = setTimeout(function () {
          pendingResolvers.current.delete(attachmentId + ":" + currentChunk);
          updateAttachment(attachmentId, { status: "failed", error: "Chunk upload timed out" });
        }, CHUNK_TIMEOUT_MS);

        pendingResolvers.current.set(attachmentId + ":" + currentChunk, {
          resolve: function () {
            clearTimeout(chunkTimer);
            chunkIndex++;
            const progress = Math.round((chunkIndex / totalChunks) * 100);
            updateAttachment(attachmentId, { progress });
            sendNextChunk();
          },
          reject: function (err: string) {
            clearTimeout(chunkTimer);
            updateAttachment(attachmentId, { status: "failed", error: err });
          },
          timer: chunkTimer,
        });
      }

      sendNextChunk();
    };
    reader.readAsArrayBuffer(file);
  }, [updateAttachment]);

  const addFile = useCallback(function (file: File) {
    if (file.size > MAX_FILE_SIZE) {
      return;
    }

    const id = crypto.randomUUID();
    const mime = guessMimeType(file);
    const type: "file" | "image" = isImageType(mime) ? "image" : "file";

    let previewUrl: string | undefined;
    if (type === "image") {
      previewUrl = URL.createObjectURL(file);
    }

    const att: ClientAttachment = {
      id,
      name: file.name,
      type,
      mimeType: mime,
      size: file.size,
      status: "uploading",
      progress: 0,
      previewUrl,
    };

    let added = false;
    setAttachments(function (prev) {
      if (prev.length >= MAX_ATTACHMENTS) {
        return prev;
      }
      added = true;
      return [...prev, att];
    });

    if (added) {
      fileCache.current.set(id, file);
      uploadFile(att, file);
    } else if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [uploadFile]);

  const addPaste = useCallback(function (text: string) {
    const id = crypto.randomUUID();
    const blob = new Blob([text], { type: "text/plain" });
    const file = new File([blob], "pasted-text.txt", { type: "text/plain" });
    const lineCount = text.split("\n").length;

    const att: ClientAttachment = {
      id,
      name: "Pasted text",
      type: "paste",
      mimeType: "text/plain",
      size: blob.size,
      lineCount,
      status: "uploading",
      progress: 0,
      content: text,
    };

    let added = false;
    setAttachments(function (prev) {
      if (prev.length >= MAX_ATTACHMENTS) {
        return prev;
      }
      added = true;
      return [...prev, att];
    });

    if (added) {
      fileCache.current.set(id, file);
      uploadFile(att, file);
    }
  }, [uploadFile]);

  const removeAttachment = useCallback(function (id: string) {
    setAttachments(function (prev) {
      const removed = prev.find(function (a) { return a.id === id; });
      if (removed && removed.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter(function (a) { return a.id !== id; });
    });
    fileCache.current.delete(id);
    const timer = uploadTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      uploadTimers.current.delete(id);
    }
  }, []);

  const retryAttachment = useCallback(function (id: string) {
    const file = fileCache.current.get(id);
    if (!file) return;
    setAttachments(function (prev) {
      const att = prev.find(function (a) { return a.id === id; });
      if (!att) return prev;
      return prev.map(function (a) {
        return a.id === id ? { ...a, status: "uploading" as const, progress: 0, error: undefined } : a;
      });
    });
    const att = attachmentsRef.current.find(function (a) { return a.id === id; });
    if (att) uploadFile(att, file);
  }, [uploadFile]);

  const clearAll = useCallback(function () {
    setAttachments(function (prev) {
      prev.forEach(function (a) {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
      return [];
    });
    fileCache.current.clear();
    uploadTimers.current.forEach(function (timer) { clearTimeout(timer); });
    uploadTimers.current.clear();
  }, []);

  useEffect(function () {
    return function () {
      attachmentsRef.current.forEach(function (att) {
        if (att.previewUrl) {
          URL.revokeObjectURL(att.previewUrl);
        }
      });
      uploadTimers.current.forEach(function (timer) { clearTimeout(timer); });
    };
  }, []);

  const readyIds = attachments
    .filter(function (a) { return a.status === "ready"; })
    .map(function (a) { return a.id; });

  const hasUploading = attachments.some(function (a) { return a.status === "uploading"; });
  const canAttach = attachments.length < MAX_ATTACHMENTS;

  return {
    attachments,
    addFile,
    addPaste,
    removeAttachment,
    retryAttachment,
    clearAll,
    readyIds,
    hasUploading,
    canAttach,
  };
}
