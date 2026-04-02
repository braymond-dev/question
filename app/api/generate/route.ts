import { NextResponse } from "next/server";

import { generateTrivia } from "@/lib/generation";
import { generateRequestSchema } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const payload = generateRequestSchema.parse(await request.json());
    const result = await generateTrivia(payload);

    return NextResponse.json({
      item: result.item,
      debug: result.debug
    });
  } catch (caught) {
    return NextResponse.json(
      {
        error:
          caught instanceof Error ? caught.message : "Trivia generation failed"
      },
      { status: 500 }
    );
  }
}
