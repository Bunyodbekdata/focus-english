import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { del, get as getBlob, put } from "@vercel/blob";

export function isBlobStorageConfigured(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
      process.env.BLOB_STORE_ID?.trim()
  );
}

export function getDataDir(): string {
  const configured = process.env.FOCUS_DATA_DIR?.trim();
  const baseDir = configured
    ? path.resolve(configured)
    : path.join(process.cwd(), "data");
  if (!process.env.VERCEL) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

export function getUploadsSubdir(kind: "pdfs" | "audio"): string {
  const dir = path.join(getDataDir(), "uploads", kind);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20 MB

const ALLOWED_AUDIO_MIMES: Record<string, string> = {
  "audio/webm": ".webm",
  "audio/webm;codecs=opus": ".webm",
  "audio/mp4": ".m4a",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/ogg;codecs=opus": ".ogg",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
};

/**
 * Stores a validated file either in Vercel Blob (when configured)
 * or on local disk (development / VPS).
 *
 * Stored `relativePath` formats:
 * - Local disk:        `pdfs/<uuid>-name.pdf` or `audio/<uuid>.webm`
 * - Vercel Blob (pub): `blob:public:<url>`
 * - Vercel Blob (prv): `blob:private:<pathname>`
 */
async function uploadToVercelBlob(
  pathname: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const preferred: "public" | "private" =
    process.env.BLOB_ACCESS?.toLowerCase() === "private" ? "private" : "public";
  const fallback: "public" | "private" =
    preferred === "private" ? "public" : "private";

  try {
    const result = await put(pathname, buffer, {
      access: preferred,
      contentType,
      addRandomSuffix: false,
    });
    return preferred === "private"
      ? `blob:private:${result.pathname}`
      : `blob:public:${result.url}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    if (msg.includes("private") || msg.includes("public") || msg.includes("access")) {
      const result = await put(pathname, buffer, {
        access: fallback,
        contentType,
        addRandomSuffix: false,
      });
      return fallback === "private"
        ? `blob:private:${result.pathname}`
        : `blob:public:${result.url}`;
    }
    throw err;
  }
}

export async function savePdfFile(
  buffer: Buffer,
  originalName: string
): Promise<{
  storedName: string;
  relativePath: string;
  sizeBytes: number;
}> {
  if (buffer.byteLength === 0) {
    throw new Error("The uploaded PDF file is empty.");
  }
  if (buffer.byteLength > MAX_PDF_BYTES) {
    throw new Error("PDF file exceeds the 25 MB size limit.");
  }
  const header = buffer.subarray(0, 5).toString("ascii");
  if (header !== "%PDF-") {
    throw new Error("Invalid PDF file. Please upload a standard .pdf document.");
  }

  const safeSlug =
    path
      .basename(originalName, path.extname(originalName))
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "document";

  const storedName = `${crypto.randomUUID()}-${safeSlug}.pdf`;
  const pathname = `pdfs/${storedName}`;

  if (isBlobStorageConfigured()) {
    const ref = await uploadToVercelBlob(pathname, buffer, "application/pdf");
    return { storedName, relativePath: ref, sizeBytes: buffer.byteLength };
  }

  if (process.env.VERCEL) {
    throw new Error(
      "File storage is not configured on Vercel. Connect a Vercel Blob store (BLOB_READ_WRITE_TOKEN) in Project Settings → Storage."
    );
  }

  const targetDir = getUploadsSubdir("pdfs");
  const fullPath = path.join(targetDir, storedName);
  fs.writeFileSync(fullPath, buffer);

  return {
    storedName,
    relativePath: pathname,
    sizeBytes: buffer.byteLength,
  };
}

export async function saveAudioFile(
  buffer: Buffer,
  mimeType: string
): Promise<{
  storedName: string;
  relativePath: string;
  normalizedMime: string;
  sizeBytes: number;
}> {
  if (buffer.byteLength === 0) {
    throw new Error("The recorded audio file is empty.");
  }
  if (buffer.byteLength > MAX_AUDIO_BYTES) {
    throw new Error("Audio recording exceeds the 20 MB size limit.");
  }

  const cleanMime = mimeType.toLowerCase().trim();
  const baseMime = cleanMime.split(";")[0].trim();
  const ext =
    ALLOWED_AUDIO_MIMES[cleanMime] ?? ALLOWED_AUDIO_MIMES[baseMime] ?? ".webm";
  const normalizedMime = baseMime.startsWith("audio/") ? baseMime : "audio/webm";

  const storedName = `${crypto.randomUUID()}${ext}`;
  const pathname = `audio/${storedName}`;

  if (isBlobStorageConfigured()) {
    const ref = await uploadToVercelBlob(pathname, buffer, normalizedMime);
    return {
      storedName,
      relativePath: ref,
      normalizedMime,
      sizeBytes: buffer.byteLength,
    };
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Audio storage is not configured on Vercel. Connect a Vercel Blob store (BLOB_READ_WRITE_TOKEN) in Project Settings → Storage."
    );
  }

  const targetDir = getUploadsSubdir("audio");
  const fullPath = path.join(targetDir, storedName);
  fs.writeFileSync(fullPath, buffer);

  return {
    storedName,
    relativePath: pathname,
    normalizedMime,
    sizeBytes: buffer.byteLength,
  };
}

export function resolveSafeUploadPath(
  kind: "pdfs" | "audio",
  filename: string
): string | null {
  const safeName = path.basename(filename);
  if (!safeName || safeName !== filename || safeName.includes("..")) {
    return null;
  }
  const baseDir = getUploadsSubdir(kind);
  const fullPath = path.resolve(baseDir, safeName);
  if (!fullPath.startsWith(path.resolve(baseDir) + path.sep)) {
    return null;
  }
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fullPath;
}

export async function readBlobReference(ref: string): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentType: string;
} | null> {
  if (ref.startsWith("blob:private:")) {
    const pathname = ref.slice("blob:private:".length);
    if (!pathname || pathname.includes("..")) return null;
    const result = await getBlob(pathname, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return {
      stream: result.stream,
      contentType: result.blob.contentType || "application/octet-stream",
    };
  }

  if (ref.startsWith("blob:public:")) {
    const url = ref.slice("blob:public:".length);
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname.endsWith(".blob.vercel-storage.com")
    ) {
      return null;
    }
    const res = await fetch(url);
    if (!res.ok || !res.body) return null;
    return {
      stream: res.body,
      contentType:
        res.headers.get("content-type") || "application/octet-stream",
    };
  }

  return null;
}

export async function deleteSafeUploadByRelativePath(
  relativePath: string | null
): Promise<void> {
  if (!relativePath) return;

  if (relativePath.startsWith("blob:public:")) {
    const url = relativePath.slice("blob:public:".length);
    try {
      await del(url);
    } catch {
      // ignore already-deleted blob
    }
    return;
  }

  if (relativePath.startsWith("blob:private:")) {
    const pathname = relativePath.slice("blob:private:".length);
    try {
      await del(pathname);
    } catch {
      // ignore already-deleted blob
    }
    return;
  }

  const normalized = relativePath.replace(/\\/g, "/");
  const slashIdx = normalized.indexOf("/");
  if (slashIdx <= 0) return;
  const kind = normalized.slice(0, slashIdx);
  const filename = normalized.slice(slashIdx + 1);
  if (kind !== "pdfs" && kind !== "audio") return;
  const fullPath = resolveSafeUploadPath(kind, filename);
  if (!fullPath) return;
  try {
    fs.unlinkSync(fullPath);
  } catch {
    // ignore file unlink race
  }
}

export function getStorageStatus(): {
  databaseMode: "turso" | "local_sqlite";
  fileStorageMode: "vercel_blob" | "local_disk";
} {
  return {
    databaseMode: process.env.TURSO_DATABASE_URL?.trim()
      ? "turso"
      : "local_sqlite",
    fileStorageMode: isBlobStorageConfigured() ? "vercel_blob" : "local_disk",
  };
}
