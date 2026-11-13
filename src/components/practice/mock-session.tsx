"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { startMockAction } from "@/app/actions/practice-mocks";
import { CollegeMark } from "@/components/practice/college-mark";
import { usePracticeSite } from "@/components/practice/practice-site";
import { homeHref, questionHref } from "@/lib/practice-host";
import type { MockPaper } from "@/lib/practice-mocks";

export function MockSession({
  collegeId,
  collegeName,
  hasLogo,
  logoAt,
  paper,
}: {
  collegeId: string;
  collegeName: string;
  hasLogo: boolean;
  logoAt: string;
  paper: MockPaper;
}) {
  const router = useRouter();
  const { onHost } = usePracticeSite();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [left, setLeft] = useState("");

  useEffect(() => {
    if (paper.state !== "open" || !paper.endsAt) return;
    const tick = () => {
      const remaining = new Date(paper.endsAt).getTime() - Date.now();
      if (remaining <= 0) {
        setLeft("0:00");
        router.refresh();
        return;
      }
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setLeft(`${minutes}:${String(seconds).padStart(2, "0")}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [paper.endsAt, paper.state, router]);

  function start() {
    setError("");
    startTransition(async () => {
      const result = await startMockAction(collegeId, paper.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Link href={homeHref(onHost)} className="text-sm text-accent">
            Home
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <CollegeMark collegeId={collegeId} name={collegeName} hasLogo={hasLogo} logoAt={logoAt} />
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{paper.title}</h1>
          </div>
          <p className="mt-1 text-sm text-muted">
            {paper.minutes} minutes · {paper.questions.length} questions · {paper.solved} solved · {paper.points} points
          </p>
        </div>
        {paper.state === "open" ? <p className="text-lg font-semibold text-ink">{left}</p> : null}
      </header>
      {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
      {paper.state === "ready" ? (
        <button
          type="button"
          disabled={pending}
          onClick={start}
          className="justify-self-start rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
        >
          {pending ? "Starting…" : "Start"}
        </button>
      ) : null}
      {paper.state === "finished" ? <p className="text-sm text-muted">Time is up. This score counts answers made before the clock ended.</p> : null}
      <section className="overflow-hidden rounded-2xl border border-line bg-card">
        <ul>
          {paper.questions.map((question, index) => (
            <li key={question.id} className="border-b border-line last:border-0">
              {paper.state === "open" ? (
                <Link href={questionHref(collegeId, onHost ? question.slug : question.id, onHost, paper.id)} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-background">
                  <span className="text-sm font-medium text-ink">
                    {index + 1}. {question.title}
                    <span className="font-normal text-muted"> · {question.moduleLabel}</span>
                  </span>
                  <span className="text-sm text-muted">{question.progress === "solved" ? "Solved" : question.progress === "attempted" ? "Attempted" : `${question.points} pts`}</span>
                </Link>
              ) : (
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm font-medium text-ink">
                    {index + 1}. {question.title}
                    <span className="font-normal text-muted"> · {question.moduleLabel}</span>
                  </span>
                  <span className="text-sm text-muted">{question.progress === "solved" ? "Solved" : question.progress === "attempted" ? "Attempted" : `${question.points} pts`}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
