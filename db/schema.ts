import {
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const pgVector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    const normalized = value.trim().replace(/^\[/, "").replace(/\]$/, "");
    return normalized
      .split(",")
      .map((entry) => Number(entry.trim()))
      .filter((entry) => !Number.isNaN(entry));
  }
});

export const generationStatusEnum = pgEnum("generation_status", [
  "accepted",
  "rejected"
]);

export const triviaItems = pgTable(
  "trivia_items",
  {
    id: serial("id").primaryKey(),
    questionText: text("question_text").notNull(),
    answerText: varchar("answer_text", { length: 200 }).notNull(),
    distractors: jsonb("distractors").$type<string[]>().notNull(),
    category: varchar("category", { length: 40 }).notNull(),
    subtopic: varchar("subtopic", { length: 80 }).notNull(),
    difficulty: varchar("difficulty", { length: 20 }).notNull(),
    canonicalFact: text("canonical_fact").notNull(),
    relationshipType: varchar("relationship_type", { length: 80 }).notNull(),
    primaryEntity: varchar("primary_entity", { length: 120 }).notNull(),
    explanation: text("explanation").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    categoryIdx: index("trivia_items_category_idx").on(table.category),
    subtopicIdx: index("trivia_items_subtopic_idx").on(table.subtopic),
    createdAtIdx: index("trivia_items_created_at_idx").on(table.createdAt)
  })
);

export const triviaEmbeddings = pgTable(
  "trivia_embeddings",
  {
    triviaItemId: integer("trivia_item_id")
      .primaryKey()
      .references(() => triviaItems.id, { onDelete: "cascade" }),
    questionEmbedding: pgVector("question_embedding", { dimensions: 1536 }).notNull(),
    factEmbedding: pgVector("fact_embedding", { dimensions: 1536 }).notNull()
  }
);

export const generationAttempts = pgTable(
  "generation_attempts",
  {
    id: serial("id").primaryKey(),
    requestedCategory: varchar("requested_category", { length: 40 }),
    requestedDifficulty: varchar("requested_difficulty", { length: 20 }),
    factPlanJson: jsonb("fact_plan_json").$type<Record<string, unknown> | null>(),
    status: generationStatusEnum("status").notNull(),
    rejectionReason: text("rejection_reason"),
    similarityScore: integer("similarity_score"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    createdAtIdx: index("generation_attempts_created_at_idx").on(table.createdAt)
  })
);

export const subtopicSummaries = pgTable(
  "subtopic_summaries",
  {
    id: serial("id").primaryKey(),
    category: varchar("category", { length: 40 }).notNull(),
    subtopic: varchar("subtopic", { length: 80 }).notNull(),
    summaryText: text("summary_text").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    categorySubtopicUniqueIdx: uniqueIndex(
      "subtopic_summaries_category_subtopic_unique_idx"
    ).on(table.category, table.subtopic)
  })
);

export const schemaSetupNotes = `
-- Enable pgvector once per database:
create extension if not exists vector;

create index if not exists trivia_embeddings_fact_embedding_idx
  on trivia_embeddings using ivfflat (fact_embedding vector_cosine_ops)
  with (lists = 100);
`;

export function vectorColumnSql(columnName: "question_embedding" | "fact_embedding") {
  return sql.raw(columnName);
}

export { pgVector };
