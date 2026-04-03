import { and, count, desc, eq, gte, sql } from "drizzle-orm";

import { DEFAULT_SUBTOPICS, CATEGORIES, DIFFICULTIES, type Category, type Difficulty } from "@/lib/constants";
import { testTriviaItems, triviaItems } from "@/db/schema";
import { getDb } from "@/lib/db";
import { daysAgo } from "@/lib/utils";

export type PipelineTarget = "live" | "test";

type RouteChoiceInput = {
  requestedCategory?: Category;
  requestedDifficulty?: Difficulty;
};

export type RouteChoice = {
  category: Category;
  difficulty: Difficulty;
  subtopic: string;
};

function pickLeastUsed<T extends string>(items: Array<{ key: T; uses: number }>) {
  const sorted = [...items].sort((a, b) => a.uses - b.uses);
  const contenders = sorted.slice(0, 2);
  return contenders[Math.floor(Math.random() * contenders.length)].key;
}

export async function chooseGenerationRoute(
  input: RouteChoiceInput,
  pipelineTarget: PipelineTarget = "live"
): Promise<RouteChoice> {
  const difficulty =
    input.requestedDifficulty ??
    DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)];

  const category =
    input.requestedCategory ?? (await chooseLeastUsedCategory(pipelineTarget));

  const subtopic = await chooseBalancedSubtopic(category, pipelineTarget);

  return { category, difficulty, subtopic };
}

async function chooseLeastUsedCategory(
  pipelineTarget: PipelineTarget
): Promise<Category> {
  const itemsTable = pipelineTarget === "test" ? testTriviaItems : triviaItems;

  const recentCounts = await getDb()
    .select({
      category: itemsTable.category,
      uses: count()
    })
    .from(itemsTable)
    .where(gte(itemsTable.createdAt, daysAgo(14)))
    .groupBy(itemsTable.category);

  const usageMap = new Map(recentCounts.map((row) => [row.category, row.uses]));

  return pickLeastUsed(
    CATEGORIES.map((category) => ({
      key: category,
      uses: usageMap.get(category) ?? 0
    }))
  );
}

async function chooseBalancedSubtopic(
  category: Category,
  pipelineTarget: PipelineTarget
) {
  const subtopics = DEFAULT_SUBTOPICS[category];
  const itemsTable = pipelineTarget === "test" ? testTriviaItems : triviaItems;

  const recentCounts = await getDb()
    .select({
      subtopic: itemsTable.subtopic,
      uses: count()
    })
    .from(itemsTable)
    .where(
      and(
        eq(itemsTable.category, category),
        gte(itemsTable.createdAt, daysAgo(14))
      )
    )
    .groupBy(itemsTable.subtopic)
    .orderBy(desc(sql<number>`count(*)`));

  const usageMap = new Map(recentCounts.map((row) => [row.subtopic, row.uses]));

  return pickLeastUsed(
    subtopics.map((subtopic) => ({
      key: subtopic,
      uses: usageMap.get(subtopic) ?? 0
    }))
  );
}
