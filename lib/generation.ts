import { generationAttempts, triviaEmbeddings, triviaItems } from "@/db/schema";
import { getDb } from "@/lib/db";
import { embedTexts } from "@/lib/embeddings";
import { getPriorMemory, scoreNovelty } from "@/lib/novelty";
import {
  finalizeTrivia,
  generateFactPlan,
  sanitizeFinalizedTrivia,
  summarizeNoveltyPromptFacts
} from "@/lib/openai";
import { chooseGenerationRoute } from "@/lib/router";
import type { GenerateRequest } from "@/lib/types";

const MAX_GENERATION_ATTEMPTS = 5;

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown_error";
}

export async function generateTrivia(request: GenerateRequest) {
  const db = getDb();
  let lastFailure: string | null = null;

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const route = await chooseGenerationRoute({
      requestedCategory: request.category,
      requestedDifficulty: request.difficulty
    });

    const memory = await getPriorMemory({
      category: route.category,
      subtopic: route.subtopic
    });

    let factPlan;

    try {
      factPlan = await generateFactPlan({
        category: route.category,
        subtopic: route.subtopic,
        difficulty: route.difficulty,
        priorFacts: summarizeNoveltyPromptFacts(memory.compactFacts)
      });
    } catch (error) {
      lastFailure = toErrorMessage(error);

      await db.insert(generationAttempts).values({
        requestedCategory: request.category ?? route.category,
        requestedDifficulty: request.difficulty ?? route.difficulty,
        factPlanJson: null,
        status: "rejected",
        rejectionReason: lastFailure,
        similarityScore: null
      });

      continue;
    }

    const [factEmbedding] = await embedTexts([factPlan.canonical_fact]);

    const noveltyResult = await scoreNovelty(factPlan, {
      factEmbedding,
      category: route.category,
      subtopic: route.subtopic
    });

    if (!noveltyResult.accepted) {
      lastFailure = noveltyResult.reason ?? "unknown_rejection";

      await db.insert(generationAttempts).values({
        requestedCategory: request.category ?? null,
        requestedDifficulty: request.difficulty ?? null,
        factPlanJson: factPlan,
        status: "rejected",
        rejectionReason: noveltyResult.reason,
        similarityScore: noveltyResult.score
      });

      continue;
    }

    let finalized: Awaited<ReturnType<typeof finalizeTrivia>> | null = null;

    for (let finalizeAttempt = 0; finalizeAttempt < 2; finalizeAttempt += 1) {
      try {
        finalized = sanitizeFinalizedTrivia(
          factPlan,
          await finalizeTrivia(factPlan)
        );
        break;
      } catch (error) {
        lastFailure = toErrorMessage(error);
      }
    }

    if (!finalized) {
      await db.insert(generationAttempts).values({
        requestedCategory: request.category ?? null,
        requestedDifficulty: request.difficulty ?? null,
        factPlanJson: factPlan,
        status: "rejected",
        rejectionReason: lastFailure,
        similarityScore: noveltyResult.score
      });

      continue;
    }

    const [questionEmbedding] = await embedTexts([finalized.question_text]);

    const [inserted] = await db
      .insert(triviaItems)
      .values({
        questionText: finalized.question_text,
        answerText: finalized.answer_text,
        distractors: finalized.distractors,
        category: factPlan.category,
        subtopic: factPlan.subtopic,
        difficulty: factPlan.difficulty,
        canonicalFact: factPlan.canonical_fact,
        relationshipType: factPlan.relationship_type,
        primaryEntity: factPlan.primary_entity,
        explanation: finalized.explanation
      })
      .returning();

    await db.insert(triviaEmbeddings).values({
      triviaItemId: inserted.id,
      questionEmbedding,
      factEmbedding
    });

    await db.insert(generationAttempts).values({
      requestedCategory: request.category ?? null,
      requestedDifficulty: request.difficulty ?? null,
      factPlanJson: factPlan,
      status: "accepted",
      rejectionReason: null,
      similarityScore: noveltyResult.score
    });

    return {
      item: inserted,
      debug: {
        noveltyScore: noveltyResult.score,
        route,
        strongestMatches: noveltyResult.recentMatches
      }
    };
  }

  throw new Error(
    `No acceptable trivia candidate found after ${MAX_GENERATION_ATTEMPTS} attempts. Last rejection: ${lastFailure ?? "unknown"}`
  );
}
