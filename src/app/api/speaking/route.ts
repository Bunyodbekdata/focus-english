import { NextResponse } from "next/server";
import {
  AiNotConfiguredError,
  AiProviderError,
  evaluateSpeakingAudio,
} from "@/lib/ai";
import { createSpeakingSession, listSpeakingSessions } from "@/lib/db";
import { saveAudioFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessions = await listSpeakingSessions(20);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("GET /api/speaking error:", error);
    return NextResponse.json(
      { error: "Unable to load speaking history." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");
    const examTypeRaw = String(formData.get("examType") ?? "").trim();
    const levelOrPart = String(formData.get("levelOrPart") ?? "").trim();
    const promptQuestion = String(formData.get("promptQuestion") ?? "").trim();
    const durationSeconds = Number(formData.get("durationSeconds") ?? 0);
    const conversationContext = String(
      formData.get("conversationContext") ?? ""
    ).trim();

    if (examTypeRaw !== "ielts" && examTypeRaw !== "cefr") {
      return NextResponse.json(
        { error: "Please select IELTS or CEFR speaking mode." },
        { status: 400 }
      );
    }

    if (!levelOrPart || !promptQuestion) {
      return NextResponse.json(
        { error: "Speaking level/part and prompt question are required." },
        { status: 400 }
      );
    }

    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json(
        {
          error:
            "An audio recording is required for speaking assessment. Pronunciation cannot be assessed from text alone.",
        },
        { status: 400 }
      );
    }

    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    const savedAudio = await saveAudioFile(
      audioBuffer,
      audio.type || "audio/webm"
    );

    try {
      const assessment = await evaluateSpeakingAudio({
        audioBuffer,
        mimeType: savedAudio.normalizedMime,
        examType: examTypeRaw,
        levelOrPart,
        promptQuestion,
        conversationContext: conversationContext || undefined,
      });

      const session = await createSpeakingSession({
        examType: examTypeRaw,
        levelOrPart,
        promptQuestion,
        audioPath: savedAudio.relativePath,
        audioMimeType: savedAudio.normalizedMime,
        durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
        transcript: assessment.transcript,
        assessment,
        status: "evaluated",
      });

      return NextResponse.json({ session }, { status: 201 });
    } catch (aiError) {
      if (aiError instanceof AiNotConfiguredError) {
        const session = await createSpeakingSession({
          examType: examTypeRaw,
          levelOrPart,
          promptQuestion,
          audioPath: savedAudio.relativePath,
          audioMimeType: savedAudio.normalizedMime,
          durationSeconds: Number.isFinite(durationSeconds)
            ? durationSeconds
            : 0,
          transcript: null,
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

      const session = await createSpeakingSession({
        examType: examTypeRaw,
        levelOrPart,
        promptQuestion,
        audioPath: savedAudio.relativePath,
        audioMimeType: savedAudio.normalizedMime,
        durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
        transcript: null,
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
              : "AI speaking evaluation failed.",
          session,
        },
        { status }
      );
    }
  } catch (error) {
    console.error("POST /api/speaking error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process speaking submission.",
      },
      { status: 400 }
    );
  }
}
