import { z } from "zod";

import { CATEGORIES, DIFFICULTIES } from "@/lib/constants";

export const factPlanSchema = z.object({
  category: z.enum(CATEGORIES),
  subtopic: z.string().min(2).max(80),
  difficulty: z.enum(DIFFICULTIES),
  primary_entity: z.string().min(1).max(120),
  relationship_type: z.string().min(1).max(80),
  canonical_fact: z.string().min(15).max(240),
  answer_text: z.string().min(1).max(200),
  novelty_explanation: z.string().min(10).max(240)
});

export const finalizedTriviaSchema = z.object({
  question_text: z.string().min(20).max(120),
  answer_text: z.string().min(1).max(200),
  distractors: z.array(z.string().min(1).max(200)).length(3),
  explanation: z.string().min(20).max(300)
});

export const generateRequestSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  difficulty: z.enum(DIFFICULTIES).optional()
});

export const answerRequestSchema = z.object({
  selectedAnswer: z.string(),
  correctAnswer: z.string()
});

export type FactPlan = z.infer<typeof factPlanSchema>;
export type FinalizedTrivia = z.infer<typeof finalizedTriviaSchema>;
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
