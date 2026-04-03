import { getRecentAdminData } from "@/lib/novelty";

type AdminData = {
  recentTrivia: Array<{
    id: number;
    questionText: string;
    category: string;
    subtopic: string;
    difficulty: string;
    canonicalFact: string;
    answerText: string;
    createdAt: string;
  }>;
  recentAttempts: Array<{
    id: number;
    requested_category: string | null;
    requested_difficulty: string | null;
    fact_plan_json: Record<string, unknown> | null;
    status: string;
    rejection_reason: string | null;
    similarity_score: number | null;
    created_at: string;
  }>;
};

type GenerationRun = {
  label: string;
  status: "accepted" | "in_progress";
  failedAttempts: number;
  totalAttempts: number;
  requestedCategory: string;
  requestedDifficulty: string;
  latestScore: number | null;
  lastReason: string | null;
  createdAt: string;
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function buildGenerationRuns(attempts: AdminData["recentAttempts"]): GenerationRun[] {
  const chronological = [...attempts].reverse();
  const runs: GenerationRun[] = [];
  let buffer: AdminData["recentAttempts"] = [];

  for (const attempt of chronological) {
    buffer.push(attempt);

    if (attempt.status === "accepted") {
      runs.push({
        label: `Run ${runs.length + 1}`,
        status: "accepted",
        failedAttempts: buffer.filter((item) => item.status === "rejected").length,
        totalAttempts: buffer.length,
        requestedCategory:
          attempt.requested_category ??
          String(attempt.fact_plan_json?.category ?? "auto"),
        requestedDifficulty:
          attempt.requested_difficulty ??
          String(attempt.fact_plan_json?.difficulty ?? "auto"),
        latestScore: attempt.similarity_score,
        lastReason: null,
        createdAt: attempt.created_at
      });
      buffer = [];
    }
  }

  if (buffer.length > 0) {
    const latest = buffer[buffer.length - 1];
    runs.push({
      label: `Run ${runs.length + 1}`,
      status: "in_progress",
      failedAttempts: buffer.filter((item) => item.status === "rejected").length,
      totalAttempts: buffer.length,
      requestedCategory:
        latest.requested_category ??
        String(latest.fact_plan_json?.category ?? "auto"),
      requestedDifficulty:
        latest.requested_difficulty ??
        String(latest.fact_plan_json?.difficulty ?? "auto"),
      latestScore: latest.similarity_score,
      lastReason: latest.rejection_reason,
      createdAt: latest.created_at
    });
  }

  return runs.reverse();
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

export async function AdminDashboard() {
  const source = await getRecentAdminData();
  const data: AdminData = {
    recentTrivia: source.recentTrivia.map((item) => ({
      id: item.id,
      questionText: item.questionText,
      category: item.category,
      subtopic: item.subtopic,
      difficulty: item.difficulty,
      canonicalFact: item.canonicalFact,
      answerText: item.answerText,
      createdAt: item.createdAt.toISOString()
    })),
    recentAttempts: source.recentAttempts as AdminData["recentAttempts"]
  };

  const runs = buildGenerationRuns(data.recentAttempts);
  const maxAttempts = Math.max(...runs.map((run) => run.totalAttempts), 1);
  const acceptedRuns = runs.filter((run) => run.status === "accepted");
  const totalRejectedAttempts = data.recentAttempts.filter(
    (attempt) => attempt.status === "rejected"
  ).length;
  const acceptanceRate =
    data.recentAttempts.length > 0
      ? Math.round((acceptedRuns.length / data.recentAttempts.length) * 100)
      : 0;
  const averageFailures =
    acceptedRuns.length > 0
      ? (
          acceptedRuns.reduce((sum, run) => sum + run.failedAttempts, 0) /
          acceptedRuns.length
        ).toFixed(1)
      : "0.0";

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
          Admin and Debug
        </h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          Inspect recent fact plans, see how many retries happen before an
          accepted question, and spot where novelty or finalization is making the
          generator less efficient.
        </p>
      </div>

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Accepted Runs"
          value={String(acceptedRuns.length)}
          accent="text-emerald-700"
        />
        <StatCard
          label="Rejected Attempts"
          value={String(totalRejectedAttempts)}
          accent="text-amber-700"
        />
        <StatCard
          label="Avg Failures Before Accept"
          value={averageFailures}
          accent="text-teal-700"
        />
      </section>

      <div className="grid gap-6">
        <section className="card rounded-3xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Generation Efficiency
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Each bar is one generation run. Taller bars mean more retries
                before an accepted question.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
              Attempt acceptance rate: {acceptanceRate}%
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {runs.map((run) => (
              <article
                key={`${run.label}-${run.createdAt}`}
                className="rounded-2xl border border-slate-200 bg-white/85 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {run.label}
                    </p>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      {run.requestedCategory} • {run.requestedDifficulty}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] ${
                      run.status === "accepted"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {run.status === "accepted" ? "accepted" : "in progress"}
                  </span>
                </div>

                <div className="mt-5">
                  <div className="flex h-32 items-end gap-3">
                    <div className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-28 w-full items-end rounded-2xl bg-slate-100 p-2">
                        <div
                          className="w-full rounded-xl bg-amber-400/85"
                          style={{
                            height: `${Math.max(
                              12,
                              (run.failedAttempts / maxAttempts) * 100
                            )}%`
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-600">
                        fails
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-28 w-full items-end rounded-2xl bg-slate-100 p-2">
                        <div
                          className={`w-full rounded-xl ${
                            run.status === "accepted"
                              ? "bg-teal-600"
                              : "bg-slate-400"
                          }`}
                          style={{
                            height: `${Math.max(
                              12,
                              (run.totalAttempts / maxAttempts) * 100
                            )}%`
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-600">
                        total
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
                  <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <span className="font-semibold text-slate-900">
                      {run.failedAttempts}
                    </span>{" "}
                    failed
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <span className="font-semibold text-slate-900">
                      {run.totalAttempts}
                    </span>{" "}
                    total
                  </div>
                </div>

                <p className="mt-4 text-xs text-slate-500">
                  {formatTimestamp(run.createdAt)}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="card rounded-3xl p-6">
          <h2 className="text-xl font-semibold text-slate-900">
            Attempt Sheet
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            A growing row view of recent attempts, including status, score, and
            the latest rejection reason.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Time</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Category</th>
                  <th className="px-3 py-3 font-semibold">Difficulty</th>
                  <th className="px-3 py-3 font-semibold">Score</th>
                  <th className="px-3 py-3 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAttempts.map((attempt) => (
                  <tr
                    key={attempt.id}
                    className="border-b border-slate-100 text-slate-700"
                  >
                    <td className="px-3 py-3 whitespace-nowrap">
                      {formatTimestamp(attempt.created_at)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                          attempt.status === "accepted"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {attempt.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {attempt.requested_category ??
                        String(attempt.fact_plan_json?.category ?? "auto")}
                    </td>
                    <td className="px-3 py-3">
                      {attempt.requested_difficulty ??
                        String(attempt.fact_plan_json?.difficulty ?? "auto")}
                    </td>
                    <td className="px-3 py-3">
                      {attempt.similarity_score ?? "n/a"}
                    </td>
                    <td className="px-3 py-3 max-w-xs">
                      {attempt.rejection_reason ?? "Accepted"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card rounded-3xl p-6">
            <h2 className="text-xl font-semibold text-slate-900">
              Latest Fact Plans
            </h2>
            <div className="mt-5 space-y-4">
              {data.recentAttempts.map((attempt) => (
                <article
                  key={attempt.id}
                  className="rounded-2xl border border-slate-200 bg-white/80 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <span>{attempt.status}</span>
                    <span>•</span>
                    <span>score {attempt.similarity_score ?? "n/a"}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    {attempt.rejection_reason ?? "Accepted"}
                  </p>
                  <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                    {JSON.stringify(attempt.fact_plan_json, null, 2)}
                  </pre>
                </article>
              ))}
            </div>
          </section>

          <section className="card rounded-3xl p-6">
            <h2 className="text-xl font-semibold text-slate-900">
              Accepted Trivia
            </h2>
            <div className="mt-5 space-y-4">
              {data.recentTrivia.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white/80 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <span>{item.category}</span>
                    <span>•</span>
                    <span>{item.subtopic}</span>
                    <span>•</span>
                    <span>{item.difficulty}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">
                    {item.questionText}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">
                    Answer: <strong>{item.answerText}</strong>
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Canonical fact: {item.canonicalFact}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
