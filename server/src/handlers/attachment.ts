import type { Attachment } from "@lattice/shared";
import type { AttachmentChunkMessage, AttachmentCompleteMessage, ClientMessage } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";

var MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

interface PendingUpload {
  chunks: Map<number, Buffer>;
  totalChunks: number;
  receivedCount: number;
  totalBytes: number;
  createdAt: number;
}

var stores = new Map<string, Map<string, PendingUpload>>();
var completed = new Map<string, Map<string, Attachment>>();

var TTL_MS = 5 * 60 * 1000;
var CLEANUP_INTERVAL_MS = 60 * 1000;

function getClientStore(clientId: string): Map<string, PendingUpload> {
  var store = stores.get(clientId);
  if (!store) {
    store = new Map();
    stores.set(clientId, store);
  }
  return store;
}

function getClientCompleted(clientId: string): Map<string, Attachment> {
  var store = completed.get(clientId);
  if (!store) {
    store = new Map();
    completed.set(clientId, store);
  }
  return store;
}

registerHandler("attachment", function (clientId: string, message: ClientMessage) {
  if (message.type === "attachment:chunk") {
    var msg = message as AttachmentChunkMessage;
    var store = getClientStore(clientId);

    var pending = store.get(msg.attachmentId);
    if (!pending) {
      pending = {
        chunks: new Map(),
        totalChunks: msg.totalChunks,
        receivedCount: 0,
        totalBytes: 0,
        createdAt: Date.now(),
      };
      store.set(msg.attachmentId, pending);
    }

    if (pending.chunks.has(msg.chunkIndex)) {
      sendTo(clientId, {
        type: "attachment:error",
        attachmentId: msg.attachmentId,
        error: "Duplicate chunk index: " + msg.chunkIndex,
      });
      return;
    }

    var chunkBuffer = Buffer.from(msg.data, "base64");
    if (pending.totalBytes + chunkBuffer.length > MAX_ATTACHMENT_SIZE) {
      store.delete(msg.attachmentId);
      sendTo(clientId, {
        type: "attachment:error",
        attachmentId: msg.attachmentId,
        error: "Attachment exceeds maximum size of " + (MAX_ATTACHMENT_SIZE / 1024 / 1024) + "MB",
      });
      return;
    }

    pending.chunks.set(msg.chunkIndex, chunkBuffer);
    pending.receivedCount++;
    pending.totalBytes += chunkBuffer.length;

    sendTo(clientId, {
      type: "attachment:progress",
      attachmentId: msg.attachmentId,
      received: pending.receivedCount,
      total: pending.totalChunks,
    });
    return;
  }

  if (message.type === "attachment:complete") {
    var msg = message as AttachmentCompleteMessage;
    var store = getClientStore(clientId);
    var pending = store.get(msg.attachmentId);

    if (!pending) {
      sendTo(clientId, {
        type: "attachment:error",
        attachmentId: msg.attachmentId,
        error: "No chunks received for this attachment",
      });
      return;
    }

    if (pending.receivedCount !== pending.totalChunks) {
      sendTo(clientId, {
        type: "attachment:error",
        attachmentId: msg.attachmentId,
        error: "Missing chunks: received " + pending.receivedCount + " of " + pending.totalChunks,
      });
      return;
    }

    var buffers: Buffer[] = [];
    for (var i = 0; i < pending.totalChunks; i++) {
      var chunk = pending.chunks.get(i);
      if (!chunk) {
        sendTo(clientId, {
          type: "attachment:error",
          attachmentId: msg.attachmentId,
          error: "Missing chunk at index " + i,
        });
        return;
      }
      buffers.push(chunk);
    }

    var assembled = Buffer.concat(buffers);
    var isText = msg.attachmentType === "paste" || isTextMimeType(msg.mimeType);
    var content = isText ? assembled.toString("utf-8") : assembled.toString("base64");

    var attachment: Attachment = {
      type: msg.attachmentType,
      name: msg.name,
      content,
      mimeType: msg.mimeType,
      size: msg.size,
      lineCount: msg.lineCount,
    };

    var completedStore = getClientCompleted(clientId);
    completedStore.set(msg.attachmentId, attachment);
    store.delete(msg.attachmentId);
    return;
  }
});

function isTextMimeType(mime: string): boolean {
  if (mime.startsWith("text/")) return true;
  var textTypes = [
    "application/json",
    "application/xml",
    "application/javascript",
    "application/typescript",
    "application/x-yaml",
    "application/yaml",
    "image/svg+xml",
  ];
  return textTypes.indexOf(mime) !== -1;
}

export function getAttachments(clientId: string, ids: string[]): Attachment[] {
  var store = getClientCompleted(clientId);
  var result: Attachment[] = [];
  for (var i = 0; i < ids.length; i++) {
    var att = store.get(ids[i]);
    if (att) {
      result.push(att);
      store.delete(ids[i]);
    }
  }
  return result;
}

export function cleanupClient(clientId: string): void {
  stores.delete(clientId);
  completed.delete(clientId);
}

setInterval(function () {
  var now = Date.now();
  stores.forEach(function (store) {
    store.forEach(function (pending, id) {
      if (now - pending.createdAt > TTL_MS) {
        store.delete(id);
      }
    });
  });
}, CLEANUP_INTERVAL_MS);
