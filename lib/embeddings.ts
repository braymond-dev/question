import OpenAI from "openai";

import { clamp } from "@/lib/utils";

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

export async function embedTexts(values: string[]) {
  const response = await getClient().embeddings.create({
    model: process.env.OPENAI_MODEL_EMBEDDING ?? "text-embedding-3-small",
    input: values,
    dimensions: Number(process.env.EMBEDDING_DIMENSIONS ?? 1536)
  });

  return response.data.map((item) => item.embedding);
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== right.length || left.length === 0) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return clamp(dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)), -1, 1);
}

export function parseVectorLiteral(input: string | number[]) {
  if (Array.isArray(input)) {
    return input;
  }

  const normalized = input.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (!normalized) {
    return [];
  }
  return normalized.split(",").map((value) => Number(value.trim()));
}
