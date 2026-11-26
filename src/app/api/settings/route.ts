import { NextResponse } from "next/server";
import { z } from "zod";
import { getAiStatus } from "@/lib/ai";
import { getUserProfile, updateUserProfile } from "@/lib/db";
import { getStorageStatus } from "@/lib/storage";

export const dynamic = "force-dynamic";

const UpdateSettingsSchema = z.object({
  name: z.string().trim().min(1, "Display name is required").max(80).optional(),
  email: z
    .string()
    .trim()
    .max(120)
    .refine(
      (val) => val === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      "Please enter a valid email address."
    )
    .optional(),
  targetLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).optional(),
  nativeLanguage: z.string().trim().min(1).max(40).optional(),
  readingWidth: z.enum(["narrow", "medium", "wide"]).optional(),
  readingFontSize: z.enum(["sm", "md", "lg"]).optional(),
  theme: z.enum(["sage", "ocean", "warm", "lavender", "forest"]).optional(),
});

export async function GET() {
  try {
    return NextResponse.json({
      user: await getUserProfile(),
      ai: getAiStatus(),
      storage: getStorageStatus(),
    });
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json(
      { error: "Unable to load settings." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = UpdateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ?? "Invalid settings payload.",
        },
        { status: 400 }
      );
    }

    const updated = await updateUserProfile(parsed.data);
    return NextResponse.json({
      user: updated,
      ai: getAiStatus(),
      storage: getStorageStatus(),
    });
  } catch (error) {
    console.error("PATCH /api/settings error:", error);
    return NextResponse.json(
      { error: "Unable to save settings." },
      { status: 500 }
    );
  }
}
