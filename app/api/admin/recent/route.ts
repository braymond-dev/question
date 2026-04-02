import { NextResponse } from "next/server";

import { getRecentAdminData } from "@/lib/novelty";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getRecentAdminData();
    return NextResponse.json(data);
  } catch (caught) {
    return NextResponse.json(
      {
        error: caught instanceof Error ? caught.message : "Failed to load admin data"
      },
      { status: 500 }
    );
  }
}
