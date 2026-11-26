import { NextResponse } from "next/server";
import { z } from "zod";
import { createVocabulary, listVocabulary } from "@/lib/db";

export const dynamic = "force-dynamic";

const CreateVocabularySchema = z.object({
  word: z.string().trim().min(1, "English word is required").max(120),
  meaningUz: z.string().trim().min(1, "Uzbek meaning is required").max(240),
  example: z.string().trim().max(400).optional(),
  personalNote: z.string().trim().max(500).optional(),
  sourceMaterialId: z.string().nullable().optional(),
  sourceTitle: z.string().trim().max(200).optional(),
  sourceType: z.enum(["youtube", "pdf", "reading", "manual"]).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? undefined;
    const sourceMaterialId = searchParams.get("sourceMaterialId") ?? undefined;
    const sourceType = searchParams.get("sourceType") ?? undefined;

    const entries = await listVocabulary({
      query,
      sourceMaterialId,
      sourceType,
    });
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("GET /api/vocabulary error:", error);
    return NextResponse.json(
      { error: "Unable to load vocabulary entries." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CreateVocabularySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ?? "Invalid vocabulary entry.",
        },
        { status: 400 }
      );
    }

    const entry = await createVocabulary(parsed.data);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("POST /api/vocabulary error:", error);
    return NextResponse.json(
      { error: "Unable to save vocabulary entry." },
      { status: 500 }
    );
  }
}
