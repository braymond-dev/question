import { desc, eq } from "drizzle-orm";

import {
  testGenerationAttempts,
  testRuns,
  testTriviaEmbeddings,
  testTriviaItems
} from "@/db/schema";
import { getDb } from "@/lib/db";
import { generateTriviaWithOptions } from "@/lib/generation";

export type TestRunStatus = "idle" | "running" | "completed" | "failed";

export type TestRunPoint = {
  successNumber: number;
  failedAttemptsBeforeSuccess: number;
  durationMs: number;
  createdAt: string;
};

export type TestRunFailure = {
  questionNumber: number;
  reason: string;
  createdAt: string;
};

export type TestRun = {
  id: string;
  status: TestRunStatus;
  targetQuestions: number;
  maxAttemptsPerQuestion: number;
  startedAt: string;
  completedAt: string | null;
  currentQuestionNumber: number;
  successfulGenerations: number;
  totalFailedAttempts: number;
  latestError: string | null;
  points: TestRunPoint[];
  failures: TestRunFailure[];
};

type MutableTestRun = {
  id: string;
  status: Exclude<TestRunStatus, "idle">;
  targetQuestions: number;
  maxAttemptsPerQuestion: number;
  startedAt: Date;
  completedAt: Date | null;
  currentQuestionNumber: number;
  successfulGenerations: number;
  totalFailedAttempts: number;
  latestError: string | null;
  points: TestRunPoint[];
  failures: TestRunFailure[];
};

declare global {
  // eslint-disable-next-line no-var
  var __questionTestRunPromise: Promise<void> | null | undefined;
  // eslint-disable-next-line no-var
  var __questionActiveTestRunId: string | null | undefined;
}

function getStore() {
  if (global.__questionTestRunPromise === undefined) {
    global.__questionTestRunPromise = null;
  }

  if (global.__questionActiveTestRunId === undefined) {
    global.__questionActiveTestRunId = null;
  }

  return global;
}

function mapRun(row: typeof testRuns.$inferSelect): TestRun {
  return {
    id: row.id,
    status: row.status,
    targetQuestions: row.targetQuestions,
    maxAttemptsPerQuestion: row.maxAttemptsPerQuestion,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    currentQuestionNumber: row.currentQuestionNumber,
    successfulGenerations: row.successfulGenerations,
    totalFailedAttempts: row.totalFailedAttempts,
    latestError: row.latestError,
    points: row.points,
    failures: row.failures
  };
}

function createRun(
  targetQuestions: number,
  maxAttemptsPerQuestion: number
): MutableTestRun {
  return {
    id: crypto.randomUUID(),
    status: "running" as const,
    targetQuestions,
    maxAttemptsPerQuestion,
    startedAt: new Date(),
    completedAt: null,
    currentQuestionNumber: 0,
    successfulGenerations: 0,
    totalFailedAttempts: 0,
    latestError: null,
    points: [] as TestRunPoint[],
    failures: [] as TestRunFailure[]
  };
}

async function persistRun(run: MutableTestRun) {
  const db = getDb();

  await db
    .update(testRuns)
    .set({
      status: run.status,
      completedAt: run.completedAt,
      currentQuestionNumber: run.currentQuestionNumber,
      successfulGenerations: run.successfulGenerations,
      totalFailedAttempts: run.totalFailedAttempts,
      latestError: run.latestError,
      points: run.points,
      failures: run.failures
    })
    .where(eq(testRuns.id, run.id));
}

export async function getCurrentTestRun() {
  const db = getDb();
  const [row] = await db.select().from(testRuns).orderBy(desc(testRuns.startedAt)).limit(1);
  return row ? mapRun(row) : null;
}

export async function isTestRunning() {
  return (await getCurrentTestRun())?.status === "running";
}

async function executeRun(run: MutableTestRun) {
  const store = getStore();

  for (let questionNumber = 1; questionNumber <= run.targetQuestions; questionNumber += 1) {
    if (store.__questionActiveTestRunId !== run.id) {
      return;
    }

    run.currentQuestionNumber = questionNumber;
    await persistRun(run);

    try {
      const startedAtMs = Date.now();
      const result = await generateTriviaWithOptions(
        {},
        {
          maxAttempts: run.maxAttemptsPerQuestion,
          pipelineTarget: "test"
        }
      );
      const durationMs = Date.now() - startedAtMs;

      const failedAttemptsBeforeSuccess = Math.max(0, result.debug.attemptsUsed - 1);

      run.successfulGenerations += 1;
      run.totalFailedAttempts += failedAttemptsBeforeSuccess;
      run.points.push({
        successNumber: run.successfulGenerations,
        failedAttemptsBeforeSuccess,
        durationMs,
        createdAt: new Date().toISOString()
      });
      await persistRun(run);
    } catch (error) {
      run.status = "failed";
      run.latestError =
        error instanceof Error ? error.message : "unknown_test_failure";
      run.failures.push({
        questionNumber,
        reason: run.latestError,
        createdAt: new Date().toISOString()
      });
      run.completedAt = new Date();
      await persistRun(run);
      store.__questionTestRunPromise = null;
      return;
    }
  }

  run.status = "completed";
  run.completedAt = new Date();
  await persistRun(run);

  store.__questionTestRunPromise = null;
}

export async function startTestRun(input?: {
  targetQuestions?: number;
  maxAttemptsPerQuestion?: number;
}) {
  const store = getStore();

  const currentRun = await getCurrentTestRun();
  if (currentRun?.status === "running") {
    return currentRun;
  }

  const run = createRun(
    input?.targetQuestions ?? 100,
    input?.maxAttemptsPerQuestion ?? 10
  );

  const db = getDb();
  await db.delete(testRuns);
  await db.delete(testGenerationAttempts);
  await db.delete(testTriviaEmbeddings);
  await db.delete(testTriviaItems);
  await db.insert(testRuns).values(run);

  store.__questionActiveTestRunId = run.id;
  store.__questionTestRunPromise = executeRun(run);

  return mapRun(run);
}
