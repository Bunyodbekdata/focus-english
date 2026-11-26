import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteVocabulary, updateVocabulary } from "@/lib/db";

export const dynamic = "force-dynamic";

const UpdateVocabularySchema = z.object({
  word: z.string().trim().min(1).max(120).optional(),
  meaningUz: z.string().trim().min(1).max(240).optional(),
  example: z.string().trim().max(400).optional(),
  personalNote: z.string().trim().max(500).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = UpdateVocabularySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid update payload." },
        { status: 400 }
      );
    }

    const entry = await updateVocabulary(id, parsed.data);
    if (!entry) {
      return NextResponse.json(
        { error: "Vocabulary entry not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ entry });
  } catch (error) {
    console.error("PATCH /api/vocabulary/[id] error:", error);
    return NextResponse.json(
      { error: "Unable to update vocabulary entry." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const deleted = await deleteVocabulary(id);
  if (!deleted) {
    return NextResponse.json(
      { error: "Vocabulary entry not found." },
      { status: 404 }
    );
  }
  return NextResponse.json({ deleted: true });
}
