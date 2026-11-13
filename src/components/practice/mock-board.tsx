"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { saveMockAction } from "@/app/actions/practice-mocks";
import { usePracticeSite } from "@/components/practice/practice-site";
import { mockReportHref } from "@/lib/practice-host";
import type { MockQuestionOption, MockResultRow, MockSummary } from "@/lib/practice-mocks";
import type { PracticeRole } from "@/lib/practice-auth";

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";

export function MockBoard({
  role,
  collegeId,
  mocks,
  questions,
  results,
}: {
  role: PracticeRole;
  collegeId: string;
  mocks: MockSummary[];
  questions: MockQuestionOption[];
  results: MockResultRow[];
}) {
  const { onHost } = usePracticeSite();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [resultQuery, setResultQuery] = useState("");
  const [mockTitle, setMockTitle] = useState("");
  const visibleMocks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return mocks.filter((mock) => {
      if (needle && !mock.title.toLowerCase().includes(needle)) return false;
      if (status && mock.status !== status) return false;
      return true;
    });
  }, [mocks, query, status]);
  const mockTitles = useMemo(
    () => [...new Set(results.map((row) => row.mockTitle).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [results],
  );
  const visibleResults = useMemo(() => {
    const needle = resultQuery.trim().toLowerCase();
    return results.filter((row) => {
      if (needle && !`${row.fullName} ${row.email} ${row.rollNumber}`.toLowerCase().includes(needle)) return false;
      if (mockTitle && row.mockTitle !== mockTitle) return false;
      return true;
    });
  }, [mockTitle, resultQuery, results]);
  const filterClass = "rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-accent";
  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">Mocks</h2>
          <p className="mt-1 text-sm text-muted">A timed set of published questions. Each student can start once.</p>
        </div>
        {role === "main_admin" && results.length > 0 ? (
          <a href={mockReportHref(collegeId, onHost)} className="text-sm font-medium text-accent">
            Download mock results
          </a>
        ) : null}
        {role === "college_admin" && results.length > 0 ? (
          <a href={mockReportHref(collegeId, onHost)} className="text-sm font-medium text-accent">
            Download mock results
          </a>
        ) : null}
      </div>
      {role === "main_admin" ? <MockForm collegeId={collegeId} questions={questions} /> : null}
      {mocks.length === 0 && role === "main_admin" ? null : mocks.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card px-4 py-8 text-sm text-muted">No mocks yet.</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mocks" className={filterClass} />
            <select value={status} onChange={(event) => setStatus(event.target.value)} className={filterClass}>
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          {visibleMocks.length === 0 ? (
            <p className="rounded-2xl border border-line bg-card px-4 py-8 text-sm text-muted">No matches</p>
          ) : (
        <div className="grid gap-3">
          {visibleMocks.map((mock) => (
            <article key={mock.id} className="rounded-2xl border border-line bg-card px-4 py-4">
              <p className="text-base font-semibold text-ink">{mock.title}</p>
              <p className="mt-1 text-sm text-muted">
                {mock.minutes} minutes · {mock.questionCount} questions · {mock.status === "published" ? "Published" : "Draft"}
                {mock.started ? " · Started" : ""}
              </p>
            </article>
          ))}
        </div>
          )}
        </>
      )}
      {results.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <h3 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Mock results</h3>
          <div className="grid gap-2 border-b border-line px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={resultQuery}
              onChange={(event) => setResultQuery(event.target.value)}
              placeholder="Search name, email, or roll"
              className="rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <select
              value={mockTitle}
              onChange={(event) => setMockTitle(event.target.value)}
              className="rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            >
              <option value="">All mocks</option>
              {mockTitles.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          {visibleResults.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted">No matches</p>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Roll number</th>
                  <th className="px-4 py-3 font-medium">Mock</th>
                  <th className="px-4 py-3 font-medium">Solved</th>
                  <th className="px-4 py-3 font-medium">Points</th>
                </tr>
              </thead>
              <tbody>
                {visibleResults.map((row) => (
                  <tr key={`${row.email}-${row.mockTitle}-${row.startedAt}`} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{row.fullName}</td>
                    <td className="px-4 py-3 text-ink">{row.rollNumber}</td>
                    <td className="px-4 py-3 text-ink">{row.mockTitle}</td>
                    <td className="px-4 py-3 text-ink">
                      {row.solved} / {row.questionCount}
                    </td>
                    <td className="px-4 py-3 text-ink">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function MockForm({ collegeId, questions }: { collegeId: string; questions: MockQuestionOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function save(publish: boolean) {
    setError("");
    startTransition(async () => {
      const result = await saveMockAction(collegeId, null, { title, minutes: Number(minutes), questionIds: selected, publish });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTitle("");
      setSelected([]);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save(false);
      }}
      className="grid gap-3 rounded-2xl border border-line bg-card p-4"
    >
      {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <label>
          <span className="mb-1.5 block text-sm font-medium text-ink">Mock name</span>
          <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-ink">Minutes</span>
          <input className={inputClass} type="number" min={5} max={180} value={minutes} onChange={(event) => setMinutes(event.target.value)} required />
        </label>
      </div>
      <fieldset className="grid max-h-64 gap-2 overflow-y-auto">
        <legend className="mb-1 text-sm font-medium text-ink">Questions</legend>
        {questions.length === 0 ? <p className="text-sm text-muted">Publish a question before creating a mock.</p> : null}
        {questions.map((question) => (
          <label key={question.id} className="flex items-start gap-3 text-sm text-ink">
            <input type="checkbox" checked={selected.includes(question.id)} onChange={() => toggle(question.id)} className="mt-1" />
            <span>
              {question.title}
              <span className="text-muted">
                {" "}
                · {question.moduleLabel} · {question.points}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-ink disabled:opacity-60">
          {pending ? "Saving…" : "Save draft"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => save(true)}
          className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
        >
          Save and publish
        </button>
      </div>
    </form>
  );
}
