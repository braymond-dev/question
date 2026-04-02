"use client";

import { useEffect, useState, useTransition } from "react";

import { CATEGORIES, DIFFICULTIES, type Category, type Difficulty } from "@/lib/constants";
import { cn } from "@/lib/utils";

type TriviaPayload = {
  item: {
    id: number;
    questionText: string;
    answerText: string;
    distractors: string[];
    category: string;
    subtopic: string;
    difficulty: string;
    explanation: string;
  };
  debug: {
    noveltyScore: number;
  };
};

function shuffle<T>(values: T[]) {
  const cloned = [...values];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[randomIndex]] = [cloned[randomIndex], cloned[index]];
  }
  return cloned;
}

export function TriviaApp() {
  const [category, setCategory] = useState<Category | "">("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [data, setData] = useState<TriviaPayload | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!data) {
      setChoices([]);
      return;
    }

    setChoices(shuffle([data.item.answerText, ...data.item.distractors]));
  }, [data]);

  const handleGenerate = () => {
    setError(null);
    setSelectedAnswer(null);
    setRevealed(false);

    startTransition(async () => {
      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            category: category || undefined,
            difficulty
          })
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to generate trivia");
        }

        setData(payload);
      } catch (caught) {
        setData(null);
        setError(
          caught instanceof Error ? caught.message : "Failed to generate trivia"
        );
      }
    });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-4">
        <span className="w-fit rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-teal-700">
          Trivia Generation MVP
        </span>
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
            Generate trivia that feels fresh, not lightly paraphrased.
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            This MVP routes generation through subtopics, retrieves nearby memory,
            plans a candidate fact, scores novelty, and only then turns it into a
            playable question.
          </p>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card rounded-3xl p-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">Category</span>
              <select
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                value={category}
                onChange={(event) => setCategory(event.target.value as Category | "")}
              >
                <option value="">Auto-balance for me</option>
                {CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">Difficulty</span>
              <select
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as Difficulty)}
              >
                {DIFFICULTIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-teal-700 px-5 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleGenerate}
            disabled={isPending}
          >
            {isPending ? "Generating..." : "Generate Question"}
          </button>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {data ? (
            <div className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-6">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <span>{data.item.category}</span>
                <span>•</span>
                <span>{data.item.subtopic}</span>
                <span>•</span>
                <span>{data.item.difficulty}</span>
              </div>

              <h2 className="mt-4 text-2xl font-semibold text-slate-900">
                {data.item.questionText}
              </h2>

              <div className="mt-6 grid gap-3">
                {choices.map((choice) => {
                  const isCorrect = choice === data.item.answerText;
                  const isSelected = selectedAnswer === choice;

                  return (
                    <button
                      key={choice}
                      onClick={() => !revealed && setSelectedAnswer(choice)}
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-left transition",
                        "border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50",
                        isSelected && "border-teal-600 bg-teal-50",
                        revealed &&
                          isCorrect &&
                          "border-emerald-600 bg-emerald-50 text-emerald-900",
                        revealed &&
                          isSelected &&
                          !isCorrect &&
                          "border-red-400 bg-red-50 text-red-800"
                      )}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  className="rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-50"
                  disabled={!selectedAnswer || revealed}
                  onClick={() => setRevealed(true)}
                >
                  Submit Answer
                </button>
                <button
                  className="rounded-2xl border border-slate-300 px-5 py-3 font-semibold text-slate-700"
                  onClick={handleGenerate}
                  disabled={isPending}
                >
                  Generate Another
                </button>
              </div>

              {revealed ? (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="font-semibold text-slate-900">
                    Correct answer: {data.item.answerText}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {data.item.explanation}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-8 rounded-3xl border border-dashed border-slate-300 px-6 py-10 text-slate-500">
              Generate a question to see the play experience here.
            </div>
          )}
        </div>

        <aside className="card rounded-3xl p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-slate-900">Pipeline snapshot</h3>
          <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600">
            <p>
              Stage A balances categories and subtopics so the app does not settle
              into the same niche.
            </p>
            <p>
              Stage B retrieves compact memory from accepted trivia instead of
              stuffing full history into the prompt.
            </p>
            <p>
              Stage C and D separate planning from novelty scoring, so the app can
              reject stale facts before wording the final question.
            </p>
          </div>

          {data ? (
            <div className="mt-6 rounded-2xl bg-amber-50 px-4 py-4 text-sm text-amber-900">
              Novelty score for the accepted item: <strong>{data.debug.noveltyScore}</strong>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
