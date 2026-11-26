import { NextResponse } from "next/server";
import { deleteSpeakingSession } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const deleted = await deleteSpeakingSession(id);
  if (!deleted) {
    return NextResponse.json(
      { error: "Speaking session not found." },
      { status: 404 }
    );
  }
  return NextResponse.json({ deleted: true });
}
