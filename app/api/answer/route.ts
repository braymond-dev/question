import { NextResponse } from "next/server";

import { answerRequestSchema } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const payload = answerRequestSchema.parse(await request.json());

    return NextResponse.json({
      correct: payload.selectedAnswer === payload.correctAnswer
    });
  } catch {
    return NextResponse.json({ error: "Invalid answer payload" }, { status: 400 });
  }
}
