import { and, desc, eq, gte, sql } from "drizzle-orm";

import {
  testTriviaEmbeddings,
  testTriviaItems,
  triviaEmbeddings,
  triviaItems
} from "@/db/schema";
import { NOVELTY_CONFIG } from "@/lib/constants";
import { getDb } from "@/lib/db";
import { cosineSimilarity, parseVectorLiteral } from "@/lib/embeddings";
import type { PipelineTarget } from "@/lib/router";
import type { FactPlan } from "@/lib/types";
import { daysAgo, clamp, dedupeStrings } from "@/lib/utils";

type NoveltyContext = {
  factEmbedding: number[];
  questionEmbedding?: number[];
  category: string;
  subtopic: string;
};

export type NoveltyResult = {
  accepted: boolean;
  score: number;
  reason: string | null;
  recentMatches: Array<{
    id: number;
    questionText: string;
    canonicalFact: string;
    answerText: string;
    category: string;
    subtopic: string;
    factSimilarity: number;
    questionSimilarity: number;
  }>;
};

export async function getPriorMemory(input: {
  category: string;
  subtopic: string;
  pipelineTarget?: PipelineTarget;
}) {
  const db = getDb();
  const itemsTable =
    input.pipelineTarget === "test" ? testTriviaItems : triviaItems;
  const embeddingsTable =
    input.pipelineTarget === "test" ? testTriviaEmbeddings : triviaEmbeddings;

  const recentItems = await db
    .select({
      id: itemsTable.id,
      questionText: itemsTable.questionText,
      canonicalFact: itemsTable.canonicalFact,
      answerText: itemsTable.answerText,
      primaryEntity: itemsTable.primaryEntity,
      relationshipType: itemsTable.relationshipType,
      category: itemsTable.category,
      subtopic: itemsTable.subtopic,
      createdAt: itemsTable.createdAt,
      factEmbedding: embeddingsTable.factEmbedding,
      questionEmbedding: embeddingsTable.questionEmbedding
    })
    .from(itemsTable)
    .leftJoin(embeddingsTable, eq(embeddingsTable.triviaItemId, itemsTable.id))
    .where(
      and(
        eq(itemsTable.category, input.category),
        gte(itemsTable.createdAt, daysAgo(NOVELTY_CONFIG.recentWindowDays))
      )
    )
    .orderBy(desc(itemsTable.createdAt))
    .limit(NOVELTY_CONFIG.maxRecentTriviaLookup);

  const sameSubtopic = recentItems.filter((item) => item.subtopic === input.subtopic);
  const centroidSource = sameSubtopic
    .map((item) => (item.factEmbedding ? parseVectorLiteral(item.factEmbedding) : null))
    .filter((item): item is number[] => item !== null && item.length > 0);

  const centroid =
    centroidSource.length > 0
      ? centroidSource[0].map(
          (_, dimensionIndex) =>
            centroidSource.reduce(
              (sum, vector) => sum + (vector[dimensionIndex] ?? 0),
              0
            ) / centroidSource.length
        )
      : null;

  const nearestNeighbors = centroid
    ? recentItems
        .filter((item) => item.factEmbedding)
        .map((item) => ({
          canonicalFact: item.canonicalFact,
          similarity: cosineSimilarity(
            centroid,
            parseVectorLiteral(item.factEmbedding as number[] | string)
          )
        }))
        .sort((left, right) => right.similarity - left.similarity)
        .slice(0, 6)
        .map((item) => item.canonicalFact)
    : [];

  const compactFacts = dedupeStrings([
    ...sameSubtopic.map((item) => item.canonicalFact),
    ...nearestNeighbors
  ]);

  return {
    recentItems,
    compactFacts
  };
}

export async function scoreNovelty(
  plan: FactPlan,
  context: NoveltyContext & { pipelineTarget?: PipelineTarget }
): Promise<NoveltyResult> {
  const db = getDb();
  const itemsTable =
    context.pipelineTarget === "test" ? testTriviaItems : triviaItems;
  const embeddingsTable =
    context.pipelineTarget === "test" ? testTriviaEmbeddings : triviaEmbeddings;

  const recentItems = await db
    .select({
      id: itemsTable.id,
      questionText: itemsTable.questionText,
      canonicalFact: itemsTable.canonicalFact,
      answerText: itemsTable.answerText,
      primaryEntity: itemsTable.primaryEntity,
      relationshipType: itemsTable.relationshipType,
      category: itemsTable.category,
      subtopic: itemsTable.subtopic,
      questionEmbedding: embeddingsTable.questionEmbedding,
      factEmbedding: embeddingsTable.factEmbedding
    })
    .from(itemsTable)
    .leftJoin(embeddingsTable, eq(embeddingsTable.triviaItemId, itemsTable.id))
    .where(gte(itemsTable.createdAt, daysAgo(120)))
    .orderBy(desc(itemsTable.createdAt))
    .limit(60);

  const scoredMatches = recentItems.map((item) => {
    const factSimilarity = item.factEmbedding
      ? cosineSimilarity(context.factEmbedding, parseVectorLiteral(item.factEmbedding))
      : 0;

    const questionSimilarity =
      item.questionEmbedding && context.questionEmbedding
        ? cosineSimilarity(
            context.questionEmbedding,
            parseVectorLiteral(item.questionEmbedding)
          )
        : 0;

    return {
      ...item,
      factSimilarity,
      questionSimilarity
    };
  });

  const strongestMatch = scoredMatches.reduce(
    (best, current) =>
      current.factSimilarity > best.factSimilarity ? current : best,
    {
      id: 0,
      questionText: "",
      canonicalFact: "",
      answerText: "",
      category: "",
      subtopic: "",
      primaryEntity: "",
      relationshipType: "",
      questionEmbedding: null,
      factEmbedding: null,
      factSimilarity: 0,
      questionSimilarity: 0
    }
  );

  if (strongestMatch.factSimilarity >= NOVELTY_CONFIG.canonicalFactHardReject) {
    return {
      accepted: false,
      score: Math.round(strongestMatch.factSimilarity * 100),
      reason: "canonical_fact_too_similar",
      recentMatches: scoredMatches.slice(0, 5)
    };
  }

  let noveltyScore = 1;

  noveltyScore -= strongestMatch.factSimilarity * NOVELTY_CONFIG.factSimilarityWeight;
  noveltyScore -= strongestMatch.questionSimilarity * NOVELTY_CONFIG.questionSimilarityWeight;

  const exactAnswerHit = scoredMatches.some(
    (item) => item.answerText.toLowerCase() === plan.answer_text.toLowerCase()
  );
  if (exactAnswerHit) {
    noveltyScore -= NOVELTY_CONFIG.sameAnswerPenalty;
  }

  const sameEntityHit = scoredMatches.some(
    (item) => item.primaryEntity.toLowerCase() === plan.primary_entity.toLowerCase()
  );
  if (sameEntityHit) {
    noveltyScore -= NOVELTY_CONFIG.sameEntityPenalty;
  }

  const sameRelationshipHit = scoredMatches.some(
    (item) =>
      item.primaryEntity.toLowerCase() === plan.primary_entity.toLowerCase() &&
      item.relationshipType.toLowerCase() === plan.relationship_type.toLowerCase()
  );
  if (sameRelationshipHit) {
    noveltyScore -= NOVELTY_CONFIG.sameRelationshipPenalty;
  }

  const repetitiveSubtopicHit = scoredMatches.filter(
    (item) =>
      item.category === context.category && item.subtopic === context.subtopic
  ).length;
  if (repetitiveSubtopicHit >= 3) {
    noveltyScore -= NOVELTY_CONFIG.sameSubtopicPenalty;
  }

  const clampedScore = clamp(noveltyScore, 0, 1);
  let reason: string | null = null;

  if (strongestMatch.factSimilarity >= NOVELTY_CONFIG.canonicalFactSoftReject) {
    reason = "canonical_fact_borderline_repeat";
  } else if (exactAnswerHit) {
    reason = "answer_used_recently";
  } else if (sameRelationshipHit) {
    reason = "entity_relationship_recently_used";
  } else if (repetitiveSubtopicHit >= 4) {
    reason = "subtopic_recently_overused";
  }

  return {
    accepted: reason === null && clampedScore >= 0.45,
    score: Math.round(clampedScore * 100),
    reason,
    recentMatches: scoredMatches
      .sort((left, right) => right.factSimilarity - left.factSimilarity)
      .slice(0, 5)
  };
}

export async function getRecentAdminData() {
  const db = getDb();

  const [recentTrivia, recentAttempts] = await Promise.all([
    db
      .select()
      .from(triviaItems)
      .orderBy(desc(triviaItems.createdAt))
      .limit(12),
    db.execute(sql`
      select id, requested_category, requested_difficulty, fact_plan_json, status,
             rejection_reason, similarity_score, created_at
      from generation_attempts
      order by created_at desc
      limit 20
    `)
  ]);

  return {
    recentTrivia,
    recentAttempts: recentAttempts.rows
  };
}
