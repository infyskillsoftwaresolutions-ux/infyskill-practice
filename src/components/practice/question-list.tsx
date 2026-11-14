"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { setPublishedAction } from "@/app/actions/practice-questions";
import { CollegeMark } from "@/components/practice/college-mark";
import { DifficultyLabel } from "@/components/practice/marks";
import { ModuleRail } from "@/components/practice/module-rail";
import { usePracticeSite } from "@/components/practice/practice-site";
import { collegeHref, homeHref, moduleImportHref, moduleNewHref, questionHref } from "@/lib/practice-host";
import type { ModuleCard, QuestionListItem } from "@/lib/practice-questions";
import type { PracticeRole } from "@/lib/practice-auth";

export function QuestionList({
  role,
  collegeId,
  collegeName,
  hasLogo,
  logoAt,
  moduleKey,
  moduleLabel,
  questions,
  modules,
  studentCount = 0,
}: {
  role: PracticeRole;
  collegeId: string;
  collegeName: string;
  hasLogo: boolean;
  logoAt: string;
  moduleKey: string;
  moduleLabel: string;
  questions: QuestionListItem[];
  modules: ModuleCard[];
  studentCount?: number;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [progress, setProgress] = useState("");
  const [status, setStatus] = useState("");
  const canEdit = role === "main_admin" || role === "employee";
  const { onHost } = usePracticeSite();
  const back = role === "student" ? homeHref(onHost) : collegeHref(collegeId, onHost);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return questions.filter((question) => {
      if (needle && !question.title.toLowerCase().includes(needle)) return false;
      if (difficulty && question.difficulty !== difficulty) return false;
      if (role === "student" && progress && question.progress !== progress) return false;
      if (canEdit && status && question.status !== status) return false;
      return true;
    });
  }, [canEdit, difficulty, progress, query, questions, role, status]);

  function publish(questionId: string, next: boolean) {
    setError("");
    startTransition(async () => {
      const result = await setPublishedAction(collegeId, questionId, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const overview = role === "student" ? homeHref(onHost) : collegeHref(collegeId, onHost);
  return (
    <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
      <ModuleRail
        role={role}
        collegeId={collegeId}
        modules={modules}
        activeKey={moduleKey}
        homeHref={overview}
        homeLabel={role === "student" ? "Practice" : "College"}
        studentCount={studentCount}
      />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link href={back} className="text-sm text-accent">
            {role === "student" ? "Home" : collegeName}
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <CollegeMark collegeId={collegeId} name={collegeName} hasLogo={hasLogo} logoAt={logoAt} />
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{moduleLabel}</h1>
          </div>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            {canEdit
              ? "Draft questions stay hidden from students until the main admin publishes them."
              : "Published questions for your college."}
          </p>
        </div>
        {canEdit ? (
          <div className="flex gap-2">
            <Link
              href={moduleImportHref(collegeId, moduleKey, onHost)}
              className="rounded-lg border border-line bg-card px-3.5 py-2 text-center text-sm font-medium text-ink hover:bg-background"
            >
              Import
            </Link>
            <Link
              href={moduleNewHref(collegeId, moduleKey, onHost)}
              className="rounded-lg bg-accent px-3.5 py-2 text-center text-sm font-medium text-white hover:bg-[#3e5ae0]"
            >
              Add question
            </Link>
          </div>
        ) : null}
      </header>
      {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
      {questions.length === 0 ? (
        <section className="rounded-2xl border border-line bg-card px-4 py-14 text-center">
          <p className="text-base font-medium text-ink">{canEdit ? "No questions yet" : "No published questions"}</p>
        </section>
      ) : (
        <>
          <div className={`grid gap-2 ${role === "student" || canEdit ? "sm:grid-cols-[minmax(0,1fr)_auto_auto]" : "sm:grid-cols-[minmax(0,1fr)_auto]"}`}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search questions"
              className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <select
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
              className="rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            >
              <option value="">All difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
            {role === "student" ? (
              <select
                value={progress}
                onChange={(event) => setProgress(event.target.value)}
                className="rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              >
                <option value="">All progress</option>
                <option value="todo">To do</option>
                <option value="attempted">Attempted</option>
                <option value="solved">Solved</option>
              </select>
            ) : canEdit ? (
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              >
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            ) : null}
          </div>
          {filtered.length === 0 ? (
            <section className="rounded-2xl border border-line bg-card px-4 py-14 text-center">
              <p className="text-base font-medium text-ink">No questions match</p>
            </section>
          ) : (
        <section className="overflow-hidden rounded-2xl border border-line bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Question</th>
                  <th className="px-4 py-3 font-medium">Difficulty</th>
                  <th className="px-4 py-3 font-medium">Acceptance</th>
                  <th className="px-4 py-3 font-medium">Points</th>
                  {role === "student" || canEdit ? <th className="px-4 py-3 font-medium">Status</th> : null}
                  <th className="px-4 py-3 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((question) => (
                  <tr key={question.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{question.title}</td>
                    <td className="px-4 py-3">
                      <DifficultyLabel difficulty={question.difficulty} />
                    </td>
                    <td className="px-4 py-3 text-ink">{question.acceptance === null ? "—" : `${question.acceptance}%`}</td>
                    <td className="px-4 py-3 text-ink">{question.points}</td>
                    {role === "student" ? (
                      <td className="px-4 py-3">
                        <span className={question.progress === "solved" ? "text-accent" : "text-muted"}>
                          {question.progress === "solved" ? "Solved" : question.progress === "attempted" ? "Attempted" : "To do"}
                        </span>
                      </td>
                    ) : canEdit ? (
                      <td className="px-4 py-3">
                        <span className={question.status === "published" ? "text-accent" : "text-muted"}>
                          {question.status === "published" ? "Published" : "Draft"}
                        </span>
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-right">
                      <Link href={questionHref(collegeId, onHost ? question.slug : question.id, onHost)} className="text-accent">
                        {role === "student" ? "Solve" : canEdit && (role === "main_admin" || question.status === "draft") ? "Edit" : "Open"}
                      </Link>
                      {role === "main_admin" ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => publish(question.id, question.status !== "published")}
                          className="ml-3 text-ink hover:underline disabled:opacity-60"
                        >
                          {question.status === "published" ? "Unpublish" : "Publish"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
          )}
        </>
      )}
      </main>
    </div>
  );
}
