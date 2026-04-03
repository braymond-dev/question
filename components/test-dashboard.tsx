"use client";

import { useEffect, useMemo, useState } from "react";

type TestRunPoint = {
  successNumber: number;
  failedAttemptsBeforeSuccess: number;
  durationMs: number;
  createdAt: string;
};

type TestRunFailure = {
  questionNumber: number;
  reason: string;
  createdAt: string;
};

type TestRun = {
  id: string;
  status: "idle" | "running" | "completed" | "failed";
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

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDuration(durationMs: number) {
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} s`;
}

function percentile(values: number[], p: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );

  return sorted[index];
}

function percentage(count: number, total: number) {
  if (total === 0) {
    return "0%";
  }

  return `${Math.round((count / total) * 100)}%`;
}

function StatCard({
  label,
  value,
  accent
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className={`mt-3 text-3xl font-semibold ${accent}`}>{value}</p>
    </article>
  );
}

function LineChart({
  points,
  yAccessor,
  yLabel,
  stroke,
  emptyText
}: {
  points: TestRunPoint[];
  yAccessor: (point: TestRunPoint) => number;
  yLabel: string;
  stroke: string;
  emptyText: string;
}) {
  if (points.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-sm text-slate-500">
        {emptyText}
      </div>
    );
  }

  const chartWidth = 760;
  const chartHeight = 280;
  const padding = 30;
  const maxY = Math.max(...points.map((point) => yAccessor(point)), 1);
  const yTicks = Array.from({ length: 5 }, (_, index) =>
    Math.round((maxY / 4) * (4 - index))
  );

  const getX = (index: number) =>
    padding +
    (points.length === 1
      ? (chartWidth - padding * 2) / 2
      : (index / (points.length - 1)) * (chartWidth - padding * 2));

  const getY = (value: number) =>
    chartHeight - padding - (value / maxY) * (chartHeight - padding * 2);

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${getX(index)} ${getY(yAccessor(point))}`)
    .join(" ");

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-slate-500">
        <span>X axis: successful generations</span>
        <span>{yLabel}</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/80 p-4">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-[280px] min-w-[760px] w-full"
        >
          {yTicks.map((tick, index) => {
            const y = getY(tick);

            return (
              <g key={`${tick}-${index}`}>
                <line
                  x1={padding}
                  y1={y}
                  x2={chartWidth - padding}
                  y2={y}
                  stroke="#dbe4ef"
                  strokeDasharray="4 6"
                />
                <text x={10} y={y + 4} fontSize="11" fill="#64748b">
                  {tick}
                </text>
              </g>
            );
          })}

          <line
            x1={padding}
            y1={chartHeight - padding}
            x2={chartWidth - padding}
            y2={chartHeight - padding}
            stroke="#94a3b8"
          />
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={chartHeight - padding}
            stroke="#94a3b8"
          />

          <path
            d={path}
            fill="none"
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point, index) => {
            const x = getX(index);
            const yValue = yAccessor(point);
            const y = getY(yValue);

            return (
              <g key={`${point.successNumber}-${point.createdAt}-${yLabel}`}>
                <circle cx={x} cy={y} r="5" fill={stroke} />
                <text
                  x={x}
                  y={chartHeight - 8}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#64748b"
                >
                  {point.successNumber}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function TestDashboard() {
  const [run, setRun] = useState<TestRun | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetQuestions, setTargetQuestions] = useState(100);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const response = await fetch("/api/test/status", { cache: "no-store" });
        const payload = await response.json();

        if (!cancelled) {
          setRun(payload.run);
          if (payload.run?.status === "running") {
            setTargetQuestions(payload.run.targetQuestions);
          }
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load status");
        }
      }
    }

    void loadStatus();
    const interval = window.setInterval(loadStatus, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const retries = useMemo(
    () => (run?.points ?? []).map((point) => point.failedAttemptsBeforeSuccess),
    [run]
  );

  const durations = useMemo(
    () => (run?.points ?? []).map((point) => point.durationMs),
    [run]
  );

  const retryDistribution = useMemo(() => {
    const points = run?.points ?? [];

    return {
      zero: points.filter((point) => point.failedAttemptsBeforeSuccess === 0).length,
      one: points.filter((point) => point.failedAttemptsBeforeSuccess === 1).length,
      twoOrMore: points.filter((point) => point.failedAttemptsBeforeSuccess >= 2).length,
      fiveOrMore: points.filter((point) => point.failedAttemptsBeforeSuccess >= 5).length
    };
  }, [run]);

  const averageFailures = useMemo(() => {
    if (!run || run.points.length === 0) {
      return "0.0";
    }

    const total = run.points.reduce(
      (sum, point) => sum + point.failedAttemptsBeforeSuccess,
      0
    );
    return (total / run.points.length).toFixed(1);
  }, [run]);

  const isLocked = run?.status === "running";

  async function handleStart() {
    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch("/api/test/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          targetQuestions
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to start test run");
      }

      setRun(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to start test run");
    } finally {
      setIsStarting(false);
    }
  }

  const completionText = run
    ? `${run.successfulGenerations}/${run.targetQuestions}`
    : `0/${targetQuestions}`;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            Pipeline Test
          </h1>
          <p className="mt-3 text-slate-600">
            Press Play to generate a batch of questions in sequence. The run
            fails if any single question needs 10 attempts. Metrics update
            automatically and both charts grow in real time.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Generations
            </span>
            <input
              type="number"
              min={1}
              max={1000}
              value={targetQuestions}
              disabled={isLocked}
              onChange={(event) => setTargetQuestions(Number(event.target.value))}
              className="w-36 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            />
          </label>

          <button
            className="rounded-2xl bg-teal-700 px-5 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleStart}
            disabled={isStarting || isLocked}
          >
            {isLocked ? "Running..." : isStarting ? "Starting..." : "Play"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 sm:grid-cols-4 xl:grid-cols-7">
        <StatCard
          label="Successful Generations"
          value={run ? String(run.successfulGenerations) : "0"}
          accent="text-emerald-700"
        />
        <StatCard
          label="Current Progress"
          value={completionText}
          accent="text-teal-700"
        />
        <StatCard
          label="Failed Attempts"
          value={run ? String(run.totalFailedAttempts) : "0"}
          accent="text-amber-700"
        />
        <StatCard
          label="Avg Failures Before Success"
          value={averageFailures}
          accent="text-slate-900"
        />
        <StatCard
          label="P50 Failures"
          value={String(percentile(retries, 50))}
          accent="text-slate-900"
        />
        <StatCard
          label="P90 Failures"
          value={String(percentile(retries, 90))}
          accent="text-slate-900"
        />
        <StatCard
          label="Max Failures Observed"
          value={String(Math.max(...retries, 0))}
          accent="text-slate-900"
        />
      </section>

      <section className="card rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Failure Before Success
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              X-axis is successful generation number. Y-axis is failed attempts
              before that success.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
            Status: {run?.status ?? "idle"}
          </div>
        </div>

        <LineChart
          points={run?.points ?? []}
          yAccessor={(point) => point.failedAttemptsBeforeSuccess}
          yLabel="Y axis: failed attempts before success"
          stroke="#0f766e"
          emptyText="Press Play to start the test run. Successful generations will grow the failure chart in real time."
        />
      </section>

      <section className="card mt-6 rounded-3xl p-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Time Until Success
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            X-axis is successful generation number. Y-axis is milliseconds until
            that success completed.
          </p>
        </div>

        <LineChart
          points={run?.points ?? []}
          yAccessor={(point) => point.durationMs}
          yLabel="Y axis: milliseconds until success"
          stroke="#2563eb"
          emptyText="Timing data will appear as soon as the first successful generation finishes."
        />

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="P50 Time"
            value={formatDuration(percentile(durations, 50))}
            accent="text-blue-700"
          />
          <StatCard
            label="P90 Time"
            value={formatDuration(percentile(durations, 90))}
            accent="text-blue-700"
          />
          <StatCard
            label="Max Time"
            value={formatDuration(Math.max(...durations, 0))}
            accent="text-blue-700"
          />
        </div>
      </section>

      <section className="card mt-6 rounded-3xl p-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Retry Distribution
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            A quick breakdown of how often the pipeline succeeds immediately
            versus needing multiple retries.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "0 retries",
              count: retryDistribution.zero,
              accent: "bg-emerald-500"
            },
            {
              label: "1 retry",
              count: retryDistribution.one,
              accent: "bg-sky-500"
            },
            {
              label: "2+ retries",
              count: retryDistribution.twoOrMore,
              accent: "bg-amber-500"
            },
            {
              label: "5+ retries",
              count: retryDistribution.fiveOrMore,
              accent: "bg-rose-500"
            }
          ].map((bucket) => (
            <article
              key={bucket.label}
              className="rounded-2xl border border-slate-200 bg-white/80 p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  {bucket.label}
                </p>
                <p className="text-sm font-medium text-slate-500">
                  {bucket.count} / {run?.points.length ?? 0}
                </p>
              </div>
              <p className="mt-3 text-3xl font-semibold text-slate-900">
                {percentage(bucket.count, run?.points.length ?? 0)}
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${bucket.accent}`}
                  style={{
                    width: percentage(bucket.count, run?.points.length ?? 0)
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card rounded-3xl p-6">
          <h2 className="text-xl font-semibold text-slate-900">
            Run Summary
          </h2>
          <div className="mt-5 space-y-3 text-sm text-slate-700">
            <p>
              Started:{" "}
              <strong>{run ? formatTimestamp(run.startedAt) : "Not started"}</strong>
            </p>
            <p>
              Current question:{" "}
              <strong>{run?.currentQuestionNumber ?? 0}</strong>
            </p>
            <p>
              Max attempts per question:{" "}
              <strong>{run?.maxAttemptsPerQuestion ?? 10}</strong>
            </p>
            <p>
              Latest error: <strong>{run?.latestError ?? "None"}</strong>
            </p>
            <p>
              Completed:{" "}
              <strong>
                {run?.completedAt ? formatTimestamp(run.completedAt) : "In progress"}
              </strong>
            </p>
          </div>
        </section>

        <section className="card rounded-3xl p-6">
          <h2 className="text-xl font-semibold text-slate-900">
            Failures
          </h2>
          <div className="mt-5 space-y-3">
            {(run?.failures ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">
                No test-ending failures recorded yet.
              </p>
            ) : (
              run?.failures.map((failure) => (
                <article
                  key={`${failure.questionNumber}-${failure.createdAt}`}
                  className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                >
                  <p className="font-semibold">
                    Question {failure.questionNumber}
                  </p>
                  <p className="mt-2">{failure.reason}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
