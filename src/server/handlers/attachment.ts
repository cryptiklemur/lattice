import { createWriteStream, createReadStream } from "node:fs";
import { unlink, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Attachment } from "#shared";
import type { AttachmentChunkMessage, AttachmentCompleteMessage, ClientMessage } from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { log } from "../logger";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

interface PendingUpload {
  tempDir: string;
  tempPath: string;
  writeStream: ReturnType<typeof createWriteStream>;
  totalChunks: number;
  receivedCount: number;
  totalBytes: number;
  createdAt: number;
  chunksSeen: Set<number>;
}

const stores = new Map<string, Map<string, PendingUpload>>();
const completed = new Map<string, Map<string, Attachment>>();

const TTL_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

function getClientStore(clientId: string): Map<string, PendingUpload> {
  let store = stores.get(clientId);
  if (!store) {
    store = new Map();
    stores.set(clientId, store);
  }
  return store;
}

function getClientCompleted(clientId: string): Map<string, Attachment> {
  let store = completed.get(clientId);
  if (!store) {
    store = new Map();
    completed.set(clientId, store);
  }
  return store;
}

async function cleanupPending(pending: PendingUpload): Promise<void> {
  try {
    pending.writeStream.destroy();
    await unlink(pending.tempPath).catch(function () {});
    await unlink(pending.tempDir).catch(function () {});
  } catch {}
}

registerHandler("attachment", async function (clientId: string, message: ClientMessage) {
  if (message.type === "attachment:chunk") {
    const msg = message as AttachmentChunkMessage;
    const store = getClientStore(clientId);

    let pending = store.get(msg.attachmentId);
    if (!pending) {
      const tempDir = await mkdtemp(join(tmpdir(), "lattice-attach-"));
      const tempPath = join(tempDir, "data.bin");
      pending = {
        tempDir: tempDir,
        tempPath: tempPath,
        writeStream: createWriteStream(tempPath),
        totalChunks: msg.totalChunks,
        receivedCount: 0,
        totalBytes: 0,
        createdAt: Date.now(),
        chunksSeen: new Set(),
      };
      store.set(msg.attachmentId, pending);
    }

    if (pending.chunksSeen.has(msg.chunkIndex)) {
      sendTo(clientId, {
        type: "attachment:error",
        attachmentId: msg.attachmentId,
        error: "Duplicate chunk index: " + msg.chunkIndex,
      });
      return;
    }

    const chunkBuffer = Buffer.from(msg.data, "base64");
    if (pending.totalBytes + chunkBuffer.length > MAX_ATTACHMENT_SIZE) {
      await cleanupPending(pending);
      store.delete(msg.attachmentId);
      sendTo(clientId, {
        type: "attachment:error",
        attachmentId: msg.attachmentId,
        error: "Attachment exceeds maximum size of " + (MAX_ATTACHMENT_SIZE / 1024 / 1024) + "MB",
      });
      return;
    }

    pending.writeStream.write(chunkBuffer);
    pending.chunksSeen.add(msg.chunkIndex);
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
    const completeMsg = message as AttachmentCompleteMessage;
    const completeStore = getClientStore(clientId);
    const completePending = completeStore.get(completeMsg.attachmentId);

    if (!completePending) {
      sendTo(clientId, {
        type: "attachment:error",
        attachmentId: completeMsg.attachmentId,
        error: "No chunks received for this attachment",
      });
      return;
    }

    if (completePending.receivedCount !== completePending.totalChunks) {
      sendTo(clientId, {
        type: "attachment:error",
        attachmentId: completeMsg.attachmentId,
        error: "Missing chunks: received " + completePending.receivedCount + " of " + completePending.totalChunks,
      });
      return;
    }

    await new Promise<void>(function (resolve) {
      completePending!.writeStream.end(function () { resolve(); });
    });

    try {
      const assembled = await readTempFile(completePending.tempPath);
      const isText = completeMsg.attachmentType === "paste" || isTextMimeType(completeMsg.mimeType);
      const content = isText ? assembled.toString("utf-8") : assembled.toString("base64");

      const attachment: Attachment = {
        type: completeMsg.attachmentType,
        name: completeMsg.name,
        content,
        mimeType: completeMsg.mimeType,
        size: completeMsg.size,
        lineCount: completeMsg.lineCount,
      };

      const finishedStore = getClientCompleted(clientId);
      finishedStore.set(completeMsg.attachmentId, attachment);
    } catch (err) {
      log.ws("Failed to read assembled attachment: %O", err);
      sendTo(clientId, {
        type: "attachment:error",
        attachmentId: completeMsg.attachmentId,
        error: "Failed to assemble attachment",
      });
    }

    await cleanupPending(completePending);
    completeStore.delete(completeMsg.attachmentId);
    return;
  }
});

function readTempFile(path: string): Promise<Buffer> {
  return new Promise(function (resolve, reject) {
    const chunks: Buffer[] = [];
    const stream = createReadStream(path);
    stream.on("data", function (chunk) { chunks.push(chunk as Buffer); });
    stream.on("end", function () { resolve(Buffer.concat(chunks)); });
    stream.on("error", reject);
  });
}

function isTextMimeType(mime: string): boolean {
  if (mime.startsWith("text/")) return true;
  const textTypes = [
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
  const store = getClientCompleted(clientId);
  const result: Attachment[] = [];
  for (let i = 0; i < ids.length; i++) {
    const att = store.get(ids[i]);
    if (att) {
      result.push(att);
      store.delete(ids[i]);
    }
  }
  return result;
}

export function cleanupClient(clientId: string): void {
  const clientStore = stores.get(clientId);
  if (clientStore) {
    for (const [, pending] of clientStore) {
      void cleanupPending(pending);
    }
  }
  stores.delete(clientId);
  completed.delete(clientId);
}

const ttlCleanupInterval = setInterval(function () {
  const now = Date.now();
  stores.forEach(function (store) {
    store.forEach(function (pending, id) {
      if (now - pending.createdAt > TTL_MS) {
        void cleanupPending(pending);
        store.delete(id);
      }
    });
  });
}, CLEANUP_INTERVAL_MS);
ttlCleanupInterval.unref();
