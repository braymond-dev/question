import OpenAI from "openai";

import { NOVELTY_CONFIG } from "@/lib/constants";
import type { FactPlan, FinalizedTrivia } from "@/lib/types";
import { factPlanSchema, finalizedTriviaSchema } from "@/lib/types";

let client: OpenAI | null = null;

function getClient() {
  if (client) {
    return client;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  client = new OpenAI({ apiKey });
  return client;
}

function extractText(response: OpenAI.Responses.Response) {
  if ("output_text" in response && typeof response.output_text === "string") {
    return response.output_text;
  }

  const textParts = response.output.flatMap((item) => {
    if (!("content" in item) || !Array.isArray(item.content)) {
      return [];
    }

    return item.content.flatMap((content) => {
      if ("text" in content && typeof content.text === "string") {
        return [content.text];
      }

      return [];
    });
  });

  return textParts.join("\n").trim();
}

const factPlanJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: { type: "string", enum: ["history", "science", "geography", "entertainment"] },
    subtopic: { type: "string" },
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
    primary_entity: { type: "string" },
    relationship_type: { type: "string" },
    canonical_fact: { type: "string" },
    answer_text: { type: "string" },
    novelty_explanation: { type: "string" }
  },
  required: [
    "category",
    "subtopic",
    "difficulty",
    "primary_entity",
    "relationship_type",
    "canonical_fact",
    "answer_text",
    "novelty_explanation"
  ]
} satisfies Record<string, unknown>;

const finalizedTriviaJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    question_text: { type: "string" },
    answer_text: { type: "string" },
    distractors: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 3
    },
    explanation: { type: "string" }
  },
  required: ["question_text", "answer_text", "distractors", "explanation"]
} satisfies Record<string, unknown>;

async function createStructuredResponse<T>({
  model,
  schema,
  name,
  instructions,
  input
}: {
  model: string;
  schema: Record<string, unknown>;
  name: string;
  instructions: string;
  input: string;
}) {
  const response = await getClient().responses.create({
    model,
    instructions,
    input,
    text: {
      format: {
        type: "json_schema",
        name,
        schema,
        strict: true
      }
    }
  });

  const text = extractText(response);
  return JSON.parse(text) as T;
}

export async function generateFactPlan(input: {
  category: string;
  subtopic: string;
  difficulty: string;
  priorFacts: string[];
}) {
  const prompt = [
    `Target category: ${input.category}`,
    `Target subtopic: ${input.subtopic}`,
    `Target difficulty: ${input.difficulty}`,
    "",
    "Prior facts and patterns to avoid:",
    ...(input.priorFacts.length > 0
      ? input.priorFacts.map((fact, index) => `${index + 1}. ${fact}`)
      : ["1. No recent facts were supplied. Still prioritize factual novelty over paraphrasing."]),
    "",
    "Return a concise fact plan for a single trivia item.",
    "Optimize for novelty at the fact level, not just different wording.",
    "Avoid reusing the same answer, entity-relationship pair, or obvious neighboring fact."
  ].join("\n");

  const parsed = await createStructuredResponse<FactPlan>({
    model: process.env.OPENAI_MODEL_FACT_PLAN ?? "gpt-4.1-mini",
    name: "fact_plan",
    schema: factPlanJsonSchema,
    instructions:
      "You are building fresh trivia inventory. Return only valid JSON that matches the schema exactly.",
    input: prompt
  });

  return factPlanSchema.parse(parsed);
}

export async function finalizeTrivia(plan: FactPlan) {
  const prompt = [
    `Category: ${plan.category}`,
    `Subtopic: ${plan.subtopic}`,
    `Difficulty: ${plan.difficulty}`,
    `Primary entity: ${plan.primary_entity}`,
    `Relationship type: ${plan.relationship_type}`,
    `Canonical fact: ${plan.canonical_fact}`,
    `Correct answer: ${plan.answer_text}`,
    "",
    "Turn this into one polished multiple-choice trivia question.",
    "Make the wording clear, concise, and natural.",
    "The question_text must be no more than 120 characters long.",
    "The correct answer and each distractor must be a short answer choice, not a sentence or explanation.",
    "Do not include years, extra clauses, or justification inside answer choices unless they are essential to the name itself.",
    "Keep answer choices short when possible, but prefer correctness over forced brevity.",
    "Provide 3 plausible distractors that are not ambiguous or overlapping.",
    "Keep the explanation short and confidence-building."
  ].join("\n");

  const parsed = await createStructuredResponse<FinalizedTrivia>({
    model: process.env.OPENAI_MODEL_FINALIZE ?? "gpt-4.1-mini",
    name: "finalized_trivia",
    schema: finalizedTriviaJsonSchema,
    instructions:
      "Return only valid JSON. Do not add markdown. Distractors should be plausible but clearly incorrect.",
    input: prompt
  });

  return finalizedTriviaSchema.parse(parsed);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForComparison(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulTokens(value: string) {
  return normalizeForComparison(value)
    .split(" ")
    .filter((token) => token.length >= 4);
}

function stripTrailingPunctuation(value: string) {
  return value.replace(/[.?!]+$/, "").trim();
}

function isSentenceLikeChoice(value: string) {
  const normalized = normalizeWhitespace(value);
  const wordCount = normalized.split(" ").filter(Boolean).length;

  return (
    wordCount > 10 ||
    /[.?!]/.test(normalized) ||
    /\b(is|was|were|who|which|that)\b/i.test(normalized)
  );
}

function leaksAnswer(choice: string, answer: string) {
  const normalizedChoice = normalizeForComparison(choice);
  const normalizedAnswer = normalizeForComparison(answer);

  if (!normalizedChoice || !normalizedAnswer) {
    return false;
  }

  if (normalizedChoice.includes(normalizedAnswer)) {
    return true;
  }

  const answerTokens = meaningfulTokens(answer);
  if (answerTokens.length === 0) {
    return false;
  }

  const sharedTokens = answerTokens.filter((token) =>
    normalizedChoice.split(" ").includes(token)
  );

  return sharedTokens.length >= Math.min(2, answerTokens.length);
}

export function sanitizeFinalizedTrivia(plan: FactPlan, trivia: FinalizedTrivia) {
  const sanitizedAnswer = stripTrailingPunctuation(
    isSentenceLikeChoice(trivia.answer_text) ? plan.answer_text : trivia.answer_text
  );

  const sanitizedDistractors = trivia.distractors.map((choice) =>
    stripTrailingPunctuation(choice)
  );

  if (sanitizedDistractors.some(isSentenceLikeChoice)) {
    throw new Error("Finalized trivia included sentence-like distractors");
  }

  if (sanitizedDistractors.some((choice) => choice.toLowerCase() === sanitizedAnswer.toLowerCase())) {
    throw new Error("Finalized trivia included a distractor matching the correct answer");
  }

  if (sanitizedDistractors.some((choice) => leaksAnswer(choice, sanitizedAnswer))) {
    throw new Error("Finalized trivia included a distractor that leaks the correct answer");
  }

  return finalizedTriviaSchema.parse({
    ...trivia,
    answer_text: sanitizedAnswer,
    distractors: sanitizedDistractors,
    explanation: normalizeWhitespace(trivia.explanation)
  });
}

export function summarizeNoveltyPromptFacts(facts: string[]) {
  return facts.slice(0, NOVELTY_CONFIG.maxRecentFactsInPrompt);
}
