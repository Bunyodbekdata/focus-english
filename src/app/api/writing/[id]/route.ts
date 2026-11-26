import { NextResponse } from "next/server";
import { deleteWritingSession } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const deleted = await deleteWritingSession(id);
  if (!deleted) {
    return NextResponse.json(
      { error: "Writing session not found." },
      { status: 404 }
    );
  }
  return NextResponse.json({ deleted: true });
}
