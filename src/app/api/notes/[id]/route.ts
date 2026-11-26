import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteNote, getNoteById, updateNote } from "@/lib/db";

export const dynamic = "force-dynamic";

const UpdateNoteSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  content: z.string().max(50_000).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const note = await getNoteById(id);
  if (!note) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }
  return NextResponse.json({ note });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = UpdateNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid note update." },
        { status: 400 }
      );
    }

    const note = await updateNote(id, parsed.data);
    if (!note) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 });
    }
    return NextResponse.json({ note });
  } catch (error) {
    console.error("PATCH /api/notes/[id] error:", error);
    return NextResponse.json(
      { error: "Unable to update note." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const deleted = await deleteNote(id);
  if (!deleted) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
