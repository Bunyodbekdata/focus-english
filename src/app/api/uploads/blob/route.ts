import { NextResponse } from "next/server";
import { readBlobReference } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ref = searchParams.get("ref") ?? "";

    if (!ref.startsWith("blob:public:") && !ref.startsWith("blob:private:")) {
      return NextResponse.json(
        { error: "Invalid blob reference." },
        { status: 400 }
      );
    }

    const result = await readBlobReference(ref);
    if (!result) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    return new NextResponse(result.stream, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("GET /api/uploads/blob error:", error);
    return NextResponse.json(
      { error: "Unable to stream file." },
      { status: 500 }
    );
  }
}
