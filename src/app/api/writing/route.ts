import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AiNotConfiguredError,
  AiProviderError,
  evaluateWritingSubmission,
} from "@/lib/ai";
import { createWritingSession, listWritingSessions } from "@/lib/db";

export const dynamic = "force-dynamic";

const SubmitWritingSchema = z.object({
  examType: z.enum(["ielts_academic", "ielts_general", "cefr"]),
  levelOrTask: z.string().trim().min(1).max(40),
  promptTitle: z.string().trim().min(1).max(200),
  promptText: z.string().trim().min(1).max(4000),
  answerText: z
    .string()
    .trim()
    .min(
      20,
      "Please write at least 20 characters before submitting for evaluation."
    )
    .max(20_000),
});

export async function GET() {
  try {
    const sessions = await listWritingSessions(20);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("GET /api/writing error:", error);
    return NextResponse.json(
      { error: "Unable to load writing sessions." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = SubmitWritingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid writing payload.",
        },
        { status: 400 }
      );
    }

    const words = parsed.data.answerText
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    try {
      const assessment = await evaluateWritingSubmission({
        ...parsed.data,
        wordCount: words,
      });

      const session = await createWritingSession({
        ...parsed.data,
        wordCount: words,
        assessment,
        status: "evaluated",
      });

      return NextResponse.json({ session }, { status: 201 });
    } catch (aiError) {
      if (aiError instanceof AiNotConfiguredError) {
        const session = await createWritingSession({
          ...parsed.data,
          wordCount: words,
          assessment: null,
          status: "ai_unconfigured",
        });

        return NextResponse.json(
          {
            code: "AI_NOT_CONFIGURED",
            error: aiError.message,
            missingEnvVar: aiError.missingEnvVar,
            provider: aiError.provider,
            session,
          },
          { status: 503 }
        );
      }

      const session = await createWritingSession({
        ...parsed.data,
        wordCount: words,
        assessment: null,
        status: "error",
      });

      const status =
        aiError instanceof AiProviderError ? aiError.statusCode : 502;
      return NextResponse.json(
        {
          code: "AI_PROVIDER_ERROR",
          error:
            aiError instanceof Error
              ? aiError.message
              : "AI writing evaluation failed.",
          session,
        },
        { status }
      );
    }
  } catch (error) {
    console.error("POST /api/writing error:", error);
    return NextResponse.json(
      { error: "Unable to process writing submission." },
      { status: 500 }
    );
  }
}
