import { NextResponse } from "next/server";

import { getCurrentTestRun } from "@/lib/test-runner";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    run: await getCurrentTestRun()
  });
}
