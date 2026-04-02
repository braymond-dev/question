import { and, count, desc, eq, gte, sql } from "drizzle-orm";

import { DEFAULT_SUBTOPICS, CATEGORIES, DIFFICULTIES, type Category, type Difficulty } from "@/lib/constants";
import { getDb } from "@/lib/db";
import { daysAgo } from "@/lib/utils";
import { triviaItems } from "@/db/schema";

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
  input: RouteChoiceInput
): Promise<RouteChoice> {
  const difficulty =
    input.requestedDifficulty ??
    DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)];

  const category =
    input.requestedCategory ?? (await chooseLeastUsedCategory());

  const subtopic = await chooseBalancedSubtopic(category);

  return { category, difficulty, subtopic };
}

async function chooseLeastUsedCategory(): Promise<Category> {
  const recentCounts = await getDb()
    .select({
      category: triviaItems.category,
      uses: count()
    })
    .from(triviaItems)
    .where(gte(triviaItems.createdAt, daysAgo(14)))
    .groupBy(triviaItems.category);

  const usageMap = new Map(recentCounts.map((row) => [row.category, row.uses]));

  return pickLeastUsed(
    CATEGORIES.map((category) => ({
      key: category,
      uses: usageMap.get(category) ?? 0
    }))
  );
}

async function chooseBalancedSubtopic(category: Category) {
  const subtopics = DEFAULT_SUBTOPICS[category];

  const recentCounts = await getDb()
    .select({
      subtopic: triviaItems.subtopic,
      uses: count()
    })
    .from(triviaItems)
    .where(
      and(
        eq(triviaItems.category, category),
        gte(triviaItems.createdAt, daysAgo(14))
      )
    )
    .groupBy(triviaItems.subtopic)
    .orderBy(desc(sql<number>`count(*)`));

  const usageMap = new Map(recentCounts.map((row) => [row.subtopic, row.uses]));

  return pickLeastUsed(
    subtopics.map((subtopic) => ({
      key: subtopic,
      uses: usageMap.get(subtopic) ?? 0
    }))
  );
}
