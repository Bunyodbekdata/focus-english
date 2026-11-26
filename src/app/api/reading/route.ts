import { NextResponse } from "next/server";
import { z } from "zod";
import { addReadingPassage, listReadingLibrary } from "@/lib/db";

export const dynamic = "force-dynamic";

const CreateReadingSchema = z.object({
  title: z.string().trim().min(2).max(180),
  cefrLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  category: z.enum([
    "Technology",
    "Science",
    "History",
    "Business",
    "Nature",
    "Society",
  ]),
  summary: z.string().trim().min(5).max(320),
  content: z.string().trim().min(20).max(50_000),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cefrLevel = searchParams.get("cefrLevel") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const query = searchParams.get("q") ?? undefined;

    const passages = await listReadingLibrary({ cefrLevel, category, query });
    return NextResponse.json({ passages });
  } catch (error) {
    console.error("GET /api/reading error:", error);
    return NextResponse.json(
      { error: "Unable to load reading library." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CreateReadingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ?? "Invalid reading passage.",
        },
        { status: 400 }
      );
    }

    const passage = await addReadingPassage(parsed.data);
    return NextResponse.json({ passage }, { status: 201 });
  } catch (error) {
    console.error("POST /api/reading error:", error);
    return NextResponse.json(
      { error: "Unable to add reading passage." },
      { status: 500 }
    );
  }
}
