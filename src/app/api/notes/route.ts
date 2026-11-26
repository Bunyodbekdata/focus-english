import { NextResponse } from "next/server";
import { z } from "zod";
import { createNote, listNotes } from "@/lib/db";

export const dynamic = "force-dynamic";

const CreateNoteSchema = z.object({
  materialId: z.string().nullable().optional(),
  materialType: z.enum(["youtube", "pdf", "reading", "general"]).optional(),
  materialTitle: z.string().max(200).optional(),
  title: z.string().trim().min(1, "Note title is required").max(180),
  content: z.string().max(50_000).default(""),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get("materialId") ?? undefined;
    const materialType = searchParams.get("materialType") ?? undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    const notes = await listNotes({
      materialId,
      materialType,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return NextResponse.json({ notes });
  } catch (error) {
    console.error("GET /api/notes error:", error);
    return NextResponse.json(
      { error: "Unable to load notes." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CreateNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid note payload." },
        { status: 400 }
      );
    }

    const note = await createNote(parsed.data);
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("POST /api/notes error:", error);
    return NextResponse.json(
      { error: "Unable to save note." },
      { status: 500 }
    );
  }
}
