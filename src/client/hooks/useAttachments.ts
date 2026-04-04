import { useState, useCallback, useRef } from "react";
import { useWebSocket } from "./useWebSocket";
import type { ServerMessage } from "@lattice/shared";

var CHUNK_SIZE = 64 * 1024;
var MAX_FILE_SIZE = 50 * 1024 * 1024;
var MAX_ATTACHMENTS = 20;
var CHUNK_TIMEOUT_MS = 10000;

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
  var ext = file.name.split(".").pop()?.toLowerCase() || "";
  var map: Record<string, string> = {
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
  var [attachments, setAttachments] = useState<ClientAttachment[]>([]);
  var { send, subscribe, unsubscribe } = useWebSocket();
  var pendingResolvers = useRef(new Map<string, { resolve: () => void; reject: (err: string) => void; timer: ReturnType<typeof setTimeout> }>());
  var fileCache = useRef(new Map<string, File>());

  var updateAttachment = useCallback(function (id: string, updates: Partial<ClientAttachment>) {
    setAttachments(function (prev) {
      return prev.map(function (a) {
        return a.id === id ? { ...a, ...updates } : a;
      });
    });
  }, []);

  var uploadFile = useCallback(function (attachment: ClientAttachment, file: File) {
    var reader = new FileReader();
    reader.onload = function () {
      var buffer = reader.result as ArrayBuffer;
      var bytes = new Uint8Array(buffer);
      var totalChunks = Math.ceil(bytes.length / CHUNK_SIZE);

      var chunkIndex = 0;

      function sendNextChunk() {
        if (chunkIndex >= totalChunks) {
          send({
            type: "attachment:complete",
            attachmentId: attachment.id,
            attachmentType: attachment.type,
            name: attachment.name,
            mimeType: attachment.mimeType,
            size: attachment.size,
            lineCount: attachment.lineCount,
          });
          return;
        }

        var start = chunkIndex * CHUNK_SIZE;
        var end = Math.min(start + CHUNK_SIZE, bytes.length);
        var chunk = bytes.slice(start, end);
        var base64 = btoa(String.fromCharCode.apply(null, chunk as unknown as number[]));

        send({
          type: "attachment:chunk",
          attachmentId: attachment.id,
          chunkIndex,
          totalChunks,
          data: base64,
        });

        var currentChunk = chunkIndex;
        var timer = setTimeout(function () {
          pendingResolvers.current.delete(attachment.id + ":" + currentChunk);
          updateAttachment(attachment.id, { status: "failed", error: "Upload timed out" });
        }, CHUNK_TIMEOUT_MS);

        pendingResolvers.current.set(attachment.id + ":" + currentChunk, {
          resolve: function () {
            clearTimeout(timer);
            chunkIndex++;
            var progress = Math.round((chunkIndex / totalChunks) * 100);
            updateAttachment(attachment.id, { progress });
            sendNextChunk();
          },
          reject: function (err: string) {
            clearTimeout(timer);
            updateAttachment(attachment.id, { status: "failed", error: err });
          },
          timer,
        });
      }

      function handleProgress(msg: ServerMessage) {
        var m = msg as { type: string; attachmentId: string; received: number; total: number };
        if (m.attachmentId !== attachment.id) return;
        var key = attachment.id + ":" + (m.received - 1);
        var resolver = pendingResolvers.current.get(key);
        if (resolver) {
          pendingResolvers.current.delete(key);
          resolver.resolve();
        }
        if (m.received === m.total) {
          updateAttachment(attachment.id, { status: "ready", progress: 100 });
          unsubscribe("attachment:progress", handleProgress);
          unsubscribe("attachment:error", handleError);
        }
      }

      function handleError(msg: ServerMessage) {
        var m = msg as { type: string; attachmentId: string; error: string };
        if (m.attachmentId !== attachment.id) return;
        updateAttachment(attachment.id, { status: "failed", error: m.error });
        unsubscribe("attachment:progress", handleProgress);
        unsubscribe("attachment:error", handleError);
      }

      subscribe("attachment:progress", handleProgress);
      subscribe("attachment:error", handleError);
      sendNextChunk();
    };
    reader.readAsArrayBuffer(file);
  }, [send, subscribe, unsubscribe, updateAttachment]);

  var addFile = useCallback(function (file: File) {
    if (file.size > MAX_FILE_SIZE) {
      return;
    }
    if (attachments.length >= MAX_ATTACHMENTS) {
      return;
    }

    var id = crypto.randomUUID();
    var mime = guessMimeType(file);
    var type: "file" | "image" = isImageType(mime) ? "image" : "file";

    var previewUrl: string | undefined;
    if (type === "image") {
      previewUrl = URL.createObjectURL(file);
    }

    var att: ClientAttachment = {
      id,
      name: file.name,
      type,
      mimeType: mime,
      size: file.size,
      status: "uploading",
      progress: 0,
      previewUrl,
    };

    fileCache.current.set(id, file);
    setAttachments(function (prev) { return [...prev, att]; });
    uploadFile(att, file);
  }, [attachments.length, uploadFile]);

  var addPaste = useCallback(function (text: string) {
    if (attachments.length >= MAX_ATTACHMENTS) return;

    var id = crypto.randomUUID();
    var blob = new Blob([text], { type: "text/plain" });
    var file = new File([blob], "pasted-text.txt", { type: "text/plain" });
    var lineCount = text.split("\n").length;

    var att: ClientAttachment = {
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

    fileCache.current.set(id, file);
    setAttachments(function (prev) { return [...prev, att]; });
    uploadFile(att, file);
  }, [attachments.length, uploadFile]);

  var removeAttachment = useCallback(function (id: string) {
    setAttachments(function (prev) {
      var removed = prev.find(function (a) { return a.id === id; });
      if (removed && removed.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter(function (a) { return a.id !== id; });
    });
    fileCache.current.delete(id);
  }, []);

  var retryAttachment = useCallback(function (id: string) {
    var file = fileCache.current.get(id);
    var att = attachments.find(function (a) { return a.id === id; });
    if (!file || !att) return;
    updateAttachment(id, { status: "uploading", progress: 0, error: undefined });
    uploadFile(att, file);
  }, [attachments, uploadFile, updateAttachment]);

  var clearAll = useCallback(function () {
    attachments.forEach(function (a) {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
    });
    setAttachments([]);
    fileCache.current.clear();
  }, [attachments]);

  var readyIds = attachments
    .filter(function (a) { return a.status === "ready"; })
    .map(function (a) { return a.id; });

  var hasUploading = attachments.some(function (a) { return a.status === "uploading"; });
  var canAttach = attachments.length < MAX_ATTACHMENTS;

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
