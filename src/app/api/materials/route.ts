import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listLearningMaterials,
  upsertReadingMaterialHistory,
  upsertYouTubeMaterial,
} from "@/lib/db";
import type { MaterialType } from "@/lib/types";
import { parseYouTubeUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";

const CreateMaterialSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("youtube"),
    url: z.string().trim().min(1, "Please enter a YouTube URL."),
    customTitle: z.string().trim().max(180).optional(),
  }),
  z.object({
    type: z.literal("reading"),
    readingId: z.string().trim().min(1),
    title: z.string().trim().min(1).max(200),
    progressPercent: z.number().min(0).max(100).optional(),
  }),
]);

async function fetchYouTubeOEmbed(canonicalUrl: string): Promise<{
  title: string | null;
  thumbnailUrl: string | null;
  embeddable: boolean;
  reason?: string;
}> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      canonicalUrl
    )}&format=json`;
    const res = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: "application/json" },
    });

    if (res.status === 401 || res.status === 403) {
      return {
        title: null,
        thumbnailUrl: null,
        embeddable: false,
        reason:
          "The video owner has disabled embedding or the video is private/restricted.",
      };
    }

    if (res.status === 404) {
      return {
        title: null,
        thumbnailUrl: null,
        embeddable: false,
        reason: "This YouTube video could not be found or is unavailable.",
      };
    }

    if (!res.ok) {
      return { title: null, thumbnailUrl: null, embeddable: true };
    }

    const data = (await res.json()) as {
      title?: string;
      thumbnail_url?: string;
    };
    return {
      title: data.title?.trim() || null,
      thumbnailUrl: data.thumbnail_url?.trim() || null,
      embeddable: true,
    };
  } catch {
    return { title: null, thumbnailUrl: null, embeddable: true };
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get("type");
    const validType: MaterialType | undefined =
      typeParam === "youtube" || typeParam === "pdf" || typeParam === "reading"
        ? typeParam
        : undefined;

    const materials = await listLearningMaterials(validType);
    return NextResponse.json({ materials });
  } catch (error) {
    console.error("GET /api/materials error:", error);
    return NextResponse.json(
      { error: "Unable to load learning materials." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CreateMaterialSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ?? "Invalid material request.",
        },
        { status: 400 }
      );
    }

    if (parsed.data.type === "reading") {
      const material = await upsertReadingMaterialHistory({
        readingId: parsed.data.readingId,
        title: parsed.data.title,
        progressPercent: parsed.data.progressPercent,
      });
      return NextResponse.json({ material }, { status: 201 });
    }

    const yt = parseYouTubeUrl(parsed.data.url);
    if (!yt) {
      return NextResponse.json(
        {
          error:
            "Please paste a valid YouTube link (youtube.com/watch, youtu.be, or youtube.com/shorts).",
        },
        { status: 400 }
      );
    }

    const meta = await fetchYouTubeOEmbed(yt.canonicalUrl);
    if (!meta.embeddable) {
      return NextResponse.json(
        {
          error:
            meta.reason ??
            "This YouTube video cannot be embedded due to owner or regional restrictions.",
          code: "YOUTUBE_NOT_EMBEDDABLE",
        },
        { status: 422 }
      );
    }

    const title =
      parsed.data.customTitle?.trim() ||
      meta.title ||
      `YouTube Video (${yt.videoId})`;

    const material = await upsertYouTubeMaterial({
      videoId: yt.videoId,
      sourceUrl: yt.canonicalUrl,
      title,
      thumbnailUrl: meta.thumbnailUrl || yt.thumbnailUrl,
    });

    return NextResponse.json({ material }, { status: 201 });
  } catch (error) {
    console.error("POST /api/materials error:", error);
    return NextResponse.json(
      { error: "Unable to save learning material." },
      { status: 500 }
    );
  }
}
