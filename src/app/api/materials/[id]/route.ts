import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteLearningMaterial,
  getLearningMaterialById,
  updateMaterialProgress,
} from "@/lib/db";

export const dynamic = "force-dynamic";

const UpdateMaterialSchema = z.object({
  progressPercent: z.number().min(0).max(100).optional(),
  lastPositionSeconds: z.number().min(0).optional(),
  title: z.string().trim().min(1).max(200).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const material = await getLearningMaterialById(id);
  if (!material) {
    return NextResponse.json({ error: "Material not found." }, { status: 404 });
  }
  return NextResponse.json({ material });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = UpdateMaterialSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid update data." },
        { status: 400 }
      );
    }

    const updated = await updateMaterialProgress(id, parsed.data);
    if (!updated) {
      return NextResponse.json(
        { error: "Material not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ material: updated });
  } catch (error) {
    console.error("PATCH /api/materials/[id] error:", error);
    return NextResponse.json(
      { error: "Unable to update material." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const deleted = await deleteLearningMaterial(id);
  if (!deleted) {
    return NextResponse.json({ error: "Material not found." }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
