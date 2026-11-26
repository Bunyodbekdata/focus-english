import type {
  AiStatusInfo,
  SpeakingAssessment,
  WritingAssessment,
} from "./types";

const AI_TIMEOUT_MS = 45_000;

export class AiNotConfiguredError extends Error {
  public readonly missingEnvVar: string;
  public readonly provider: "gemini" | "openai";

  constructor(provider: "gemini" | "openai", missingEnvVar: string) {
    super(
      `AI assessment is not configured yet. Add ${missingEnvVar} to your server environment (.env.local) and restart the server.`
    );
    this.name = "AiNotConfiguredError";
    this.provider = provider;
    this.missingEnvVar = missingEnvVar;
  }
}

export class AiProviderError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = "AiProviderError";
    this.statusCode = statusCode;
  }
}

export function getAiStatus(): AiStatusInfo {
  const providerRaw = (process.env.AI_PROVIDER ?? "gemini").toLowerCase().trim();
  const provider: "gemini" | "openai" =
    providerRaw === "openai" ? "openai" : "gemini";

  if (provider === "openai") {
    const configured = Boolean(process.env.OPENAI_API_KEY?.trim());
    return {
      configured,
      provider,
      speakingModel:
        process.env.OPENAI_SPEAKING_MODEL?.trim() || "gpt-4o-audio-preview",
      writingModel: process.env.OPENAI_WRITING_MODEL?.trim() || "gpt-4o-mini",
      missingEnvVar: configured ? null : "OPENAI_API_KEY",
      note: configured
        ? "Connected to OpenAI server-side evaluation (multimodal audio + writing)."
        : "Set OPENAI_API_KEY in .env.local to activate live Speaking and Writing AI evaluations.",
    };
  }

  const configured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  return {
    configured,
    provider: "gemini",
    speakingModel: model,
    writingModel: model,
    missingEnvVar: configured ? null : "GEMINI_API_KEY",
    note: configured
      ? "Connected to Google Gemini server-side multimodal audio and writing evaluation."
      : "Set GEMINI_API_KEY in .env.local to activate live audio-based Speaking and Writing AI evaluations.",
  };
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

// --- SPEAKING (Audio-Based Multimodal Assessment) ---

export async function evaluateSpeakingAudio(input: {
  audioBuffer: Buffer;
  mimeType: string;
  examType: "ielts" | "cefr";
  levelOrPart: string;
  promptQuestion: string;
  conversationContext?: string;
}): Promise<SpeakingAssessment> {
  const status = getAiStatus();
  if (!status.configured) {
    throw new AiNotConfiguredError(
      status.provider,
      status.missingEnvVar ?? "GEMINI_API_KEY"
    );
  }

  const isIelts = input.examType === "ielts";
  const criteriaSpec = isIelts
    ? `Use the 4 official IELTS Speaking criteria:
1. "Fluency and Coherence" (band 0.0–9.0 in 0.5 increments)
2. "Lexical Resource" (band 0.0–9.0 in 0.5 increments)
3. "Grammatical Range and Accuracy" (band 0.0–9.0 in 0.5 increments)
4. "Pronunciation" (band 0.0–9.0 in 0.5 increments — evaluate DIRECTLY from the audio acoustics: phoneme articulation, word stress, intonation, rhythm, connected speech, and intelligibility).
Set estimatedOverall as "Band X.X" (rounded to nearest 0.5).`
    : `Evaluate against CEFR level ${input.levelOrPart} across these 6 criteria:
1. "Grammar"
2. "Vocabulary"
3. "Fluency"
4. "Pronunciation" (evaluate DIRECTLY from the audio acoustics: sound clarity, stress, intonation, pacing, and intelligibility)
5. "Coherence"
6. "Communicative Effectiveness"
Score each criterion with a CEFR estimate (e.g., "B1", "B2") or concise rating and set estimatedOverall as the estimated CEFR level (e.g., "B1+ (Developing B2)").`;

  const systemPrompt = `You are a calm, rigorous certified English speaking examiner (${
    isIelts ? "IELTS Speaking" : "CEFR Speaking"
  }).
You are receiving the candidate's ACTUAL AUDIO recording.
CRITICAL REQUIREMENTS:
- Transcribe faithfully what the speaker actually said (including hesitations/self-corrections where meaningful).
- Evaluate pronunciation STRICTLY from the acoustic audio signal, never pretending from text alone.
- Distinguish clearly between what the user actually said, grammar accuracy, vocabulary quality, fluency, and pronunciation.
- Never fabricate speech if the audio is silent or unintelligible; report that honestly in transcript and feedback.
- Provide ONE natural examiner follow-up question in "followUpQuestion" if the exercise invites continuing the conversation.
- Return ONLY a valid JSON object matching this exact schema:
{
  "estimatedOverall": "string",
  "transcript": "string",
  "pronunciationAnalysis": "string describing acoustic pronunciation observations (stress, intonation, clarity, specific sounds)",
  "criteria": [
    { "name": "string", "score": "string", "feedback": "string" }
  ],
  "mistakes": [
    { "original": "string", "correction": "string", "category": "Grammar | Vocabulary | Pronunciation | Fluency", "explanation": "string" }
  ],
  "strengths": ["string"],
  "improvements": ["string"],
  "followUpQuestion": "string"
}
${criteriaSpec}`;

  const userContext = `Exam Type: ${input.examType.toUpperCase()}
Level / Part: ${input.levelOrPart}
Examiner Prompt: ${input.promptQuestion}
${input.conversationContext ? `Previous Conversation Context:\n${input.conversationContext}` : ""}

Listen carefully to the attached audio recording and return the structured JSON assessment.`;

  const audioBase64 = input.audioBuffer.toString("base64");

  let parsed: Record<string, unknown>;

  if (status.provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY!.trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      status.speakingModel
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          {
            role: "user",
            parts: [
              { text: userContext },
              {
                inlineData: {
                  mimeType: input.mimeType.split(";")[0] || "audio/webm",
                  data: audioBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new AiProviderError(
        `Gemini speaking evaluation failed (${response.status}): ${detail.slice(0, 220)}`,
        response.status
      );
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new AiProviderError("Gemini returned an empty speaking evaluation.");
    }
    parsed = extractJsonObject(text) as Record<string, unknown>;
  } else {
    // OpenAI multimodal audio endpoint
    const apiKey = process.env.OPENAI_API_KEY!.trim();
    const audioFormat = input.mimeType.includes("wav") ? "wav" : "mp3";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      body: JSON.stringify({
        model: status.speakingModel,
        modalities: ["text"],
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userContext },
              {
                type: "input_audio",
                input_audio: { data: audioBase64, format: audioFormat },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new AiProviderError(
        `OpenAI speaking evaluation failed (${response.status}): ${detail.slice(0, 220)}`,
        response.status
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content;
    if (!text) {
      throw new AiProviderError("OpenAI returned an empty speaking evaluation.");
    }
    parsed = extractJsonObject(text) as Record<string, unknown>;
  }

  return {
    examType: input.examType,
    levelOrPart: input.levelOrPart,
    estimatedOverall: String(parsed.estimatedOverall ?? "Estimate unavailable"),
    transcript: String(parsed.transcript ?? ""),
    pronunciationAnalysis: String(parsed.pronunciationAnalysis ?? ""),
    criteria: Array.isArray(parsed.criteria)
      ? parsed.criteria.map((c: Record<string, unknown>) => ({
          name: String(c.name ?? ""),
          score: String(c.score ?? ""),
          feedback: String(c.feedback ?? ""),
        }))
      : [],
    mistakes: Array.isArray(parsed.mistakes)
      ? parsed.mistakes.map((m: Record<string, unknown>) => ({
          original: String(m.original ?? ""),
          correction: String(m.correction ?? ""),
          category: String(m.category ?? "General"),
          explanation: String(m.explanation ?? ""),
        }))
      : [],
    strengths: Array.isArray(parsed.strengths)
      ? parsed.strengths.map(String)
      : [],
    improvements: Array.isArray(parsed.improvements)
      ? parsed.improvements.map(String)
      : [],
    followUpQuestion: parsed.followUpQuestion
      ? String(parsed.followUpQuestion)
      : undefined,
    disclaimer:
      "Practice estimate generated by AI for learning purposes. This is not an official IELTS or CEFR examination result.",
  };
}

// --- WRITING ASSESSMENT ---

export async function evaluateWritingSubmission(input: {
  examType: "ielts_academic" | "ielts_general" | "cefr";
  levelOrTask: string;
  promptTitle: string;
  promptText: string;
  answerText: string;
  wordCount: number;
}): Promise<WritingAssessment> {
  const status = getAiStatus();
  if (!status.configured) {
    throw new AiNotConfiguredError(
      status.provider,
      status.missingEnvVar ?? "GEMINI_API_KEY"
    );
  }

  const isIelts = input.examType !== "cefr";
  const taskCriterionName =
    input.levelOrTask === "Task 1" ? "Task Achievement" : "Task Response";

  const rubric = isIelts
    ? `Follow official IELTS Writing assessment criteria (${
        input.examType === "ielts_academic" ? "Academic" : "General Training"
      } ${input.levelOrTask}):
1. "${taskCriterionName}" (band 0.0–9.0 in 0.5 steps)
2. "Coherence and Cohesion" (band 0.0–9.0 in 0.5 steps)
3. "Lexical Resource" (band 0.0–9.0 in 0.5 steps)
4. "Grammatical Range and Accuracy" (band 0.0–9.0 in 0.5 steps)
Set estimatedOverall as "Band X.X".`
    : `Evaluate against CEFR level ${input.levelOrTask} across these 6 criteria:
1. "Grammar"
2. "Vocabulary"
3. "Sentence Construction"
4. "Coherence"
5. "Organization"
6. "Task Completion"
Set estimatedOverall as the estimated CEFR level (e.g., "B2 (Solid)").`;

  const systemPrompt = `You are a calm, thorough certified English writing examiner.
Evaluate the student's writing accurately and constructively.
CRITICAL RULES:
- Do NOT simply rewrite the student's entire essay. Explain clearly WHY specific sentences, vocabulary choices, or structural sections need improvement.
- Quote exact segments from the student's answer when highlighting grammar mistakes or vocabulary weaknesses.
- Return ONLY a valid JSON object matching this schema:
{
  "estimatedOverall": "string",
  "summary": "string (2-3 calm sentences summarizing overall readiness)",
  "criteria": [
    { "name": "string", "score": "string", "feedback": "string" }
  ],
  "grammarMistakes": [
    { "original": "string", "correction": "string", "category": "Grammar", "explanation": "string" }
  ],
  "vocabularyWeaknesses": [
    { "phrase": "string", "suggestion": "string", "reason": "string" }
  ],
  "structuralIssues": ["string"],
  "improvements": ["string"]
}
${rubric}`;

  const userPrompt = `Exam Mode: ${input.examType}
Level / Task: ${input.levelOrTask}
Task Title: ${input.promptTitle}
Task Instructions:
${input.promptText}

Student Word Count: ${input.wordCount}
Student Response:
${input.answerText}`;

  let parsed: Record<string, unknown>;

  if (status.provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY!.trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      status.writingModel
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new AiProviderError(
        `Gemini writing evaluation failed (${response.status}): ${detail.slice(0, 220)}`,
        response.status
      );
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new AiProviderError("Gemini returned an empty writing evaluation.");
    }
    parsed = extractJsonObject(text) as Record<string, unknown>;
  } else {
    const apiKey = process.env.OPENAI_API_KEY!.trim();
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      body: JSON.stringify({
        model: status.writingModel,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new AiProviderError(
        `OpenAI writing evaluation failed (${response.status}): ${detail.slice(0, 220)}`,
        response.status
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content;
    if (!text) {
      throw new AiProviderError("OpenAI returned an empty writing evaluation.");
    }
    parsed = extractJsonObject(text) as Record<string, unknown>;
  }

  return {
    examType: input.examType,
    levelOrTask: input.levelOrTask,
    estimatedOverall: String(parsed.estimatedOverall ?? "Estimate unavailable"),
    summary: String(parsed.summary ?? ""),
    criteria: Array.isArray(parsed.criteria)
      ? parsed.criteria.map((c: Record<string, unknown>) => ({
          name: String(c.name ?? ""),
          score: String(c.score ?? ""),
          feedback: String(c.feedback ?? ""),
        }))
      : [],
    grammarMistakes: Array.isArray(parsed.grammarMistakes)
      ? parsed.grammarMistakes.map((m: Record<string, unknown>) => ({
          original: String(m.original ?? ""),
          correction: String(m.correction ?? ""),
          category: String(m.category ?? "Grammar"),
          explanation: String(m.explanation ?? ""),
        }))
      : [],
    vocabularyWeaknesses: Array.isArray(parsed.vocabularyWeaknesses)
      ? parsed.vocabularyWeaknesses.map((v: Record<string, unknown>) => ({
          phrase: String(v.phrase ?? ""),
          suggestion: String(v.suggestion ?? ""),
          reason: String(v.reason ?? ""),
        }))
      : [],
    structuralIssues: Array.isArray(parsed.structuralIssues)
      ? parsed.structuralIssues.map(String)
      : [],
    improvements: Array.isArray(parsed.improvements)
      ? parsed.improvements.map(String)
      : [],
    disclaimer:
      "Practice estimate generated by AI for learning purposes. This is not an official IELTS or CEFR examination score.",
  };
}
