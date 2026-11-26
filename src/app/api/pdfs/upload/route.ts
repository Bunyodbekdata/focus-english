import { NextResponse } from "next/server";
import { createPdfMaterial } from "@/lib/db";
import { getUploadedAssetUrl } from "@/lib/format";
import { savePdfFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please select a PDF file to upload." },
        { status: 400 }
      );
    }

    if (
      file.type &&
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        { error: "Only PDF documents (.pdf) are supported." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const saved = await savePdfFile(buffer, file.name);

    const customTitle = formData.get("title");
    const cleanTitle =
      typeof customTitle === "string" && customTitle.trim()
        ? customTitle.trim().slice(0, 180)
        : file.name.replace(/\.pdf$/i, "").trim() || "Uploaded PDF";

    const material = await createPdfMaterial({
      title: cleanTitle,
      filePath: saved.relativePath,
    });

    return NextResponse.json(
      {
        material,
        fileUrl: getUploadedAssetUrl(saved.relativePath),
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upload PDF file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
