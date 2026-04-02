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

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
          Admin and Debug
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Inspect recent fact plans, rejection reasons, similarity scores, and the
          latest accepted trivia items.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card rounded-3xl p-6">
          <h2 className="text-xl font-semibold text-slate-900">Generation Attempts</h2>
          <div className="mt-5 space-y-4">
            {data.recentAttempts.map((attempt) => (
              <article key={attempt.id} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
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
          <h2 className="text-xl font-semibold text-slate-900">Accepted Trivia</h2>
          <div className="mt-5 space-y-4">
            {data.recentTrivia.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
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
  );
}
