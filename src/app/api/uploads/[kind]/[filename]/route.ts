import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveSafeUploadPath } from "@/lib/storage";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".webm": "audio/webm",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ kind: string; filename: string }> }
) {
  const { kind, filename } = await context.params;
  if (kind !== "pdfs" && kind !== "audio") {
    return NextResponse.json({ error: "Invalid resource type." }, { status: 400 });
  }

  const fullPath = resolveSafeUploadPath(kind, filename);
  if (!fullPath) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
  const fileBuffer = fs.readFileSync(fullPath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileBuffer.byteLength),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
