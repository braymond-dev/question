export const CATEGORIES = [
  "history",
  "science",
  "geography",
  "entertainment"
] as const;

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DEFAULT_SUBTOPICS: Record<Category, string[]> = {
  history: [
    "ancient empires",
    "revolutions",
    "world wars",
    "presidential history"
  ],
  science: [
    "astronomy",
    "biology",
    "chemistry",
    "physics discoveries"
  ],
  geography: [
    "capitals",
    "landmarks",
    "rivers and mountains",
    "countries and borders"
  ],
  entertainment: [
    "film awards",
    "classic television",
    "music milestones",
    "animation"
  ]
};

export const NOVELTY_CONFIG = {
  canonicalFactHardReject: 0.9,
  canonicalFactSoftReject: 0.82,
  questionSimilarityWeight: 0.2,
  factSimilarityWeight: 0.55,
  sameAnswerPenalty: 0.14,
  sameEntityPenalty: 0.08,
  sameRelationshipPenalty: 0.08,
  sameSubtopicPenalty: 0.08,
  recentWindowDays: 21,
  maxRecentFactsInPrompt: 8,
  maxRecentTriviaLookup: 20
} as const;
