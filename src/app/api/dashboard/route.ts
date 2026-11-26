import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getDashboardData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load dashboard data.",
      },
      { status: 500 }
    );
  }
}
