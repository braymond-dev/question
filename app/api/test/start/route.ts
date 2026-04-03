import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentTestRun, isTestRunning, startTestRun } from "@/lib/test-runner";

export const dynamic = "force-dynamic";

const startTestSchema = z.object({
  targetQuestions: z.number().int().min(1).max(1000).optional()
});

export async function POST(request: Request) {
  try {
    if (await isTestRunning()) {
      return NextResponse.json(await getCurrentTestRun());
    }

    let payload = {};
    try {
      payload = startTestSchema.parse(await request.json());
    } catch {
      payload = {};
    }

    const run = await startTestRun({
      targetQuestions:
        "targetQuestions" in payload && typeof payload.targetQuestions === "number"
          ? payload.targetQuestions
          : 100,
      maxAttemptsPerQuestion: 10
    });

    return NextResponse.json(run);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to start test run"
      },
      { status: 500 }
    );
  }
}
