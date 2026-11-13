"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { importQuestionsAction } from "@/app/actions/practice-questions";
import { usePracticeSite } from "@/components/practice/practice-site";
import { moduleHref } from "@/lib/practice-host";
import { ImportError, questionsFromCsv, templateCsv } from "@/lib/practice-import-format";

export function QuestionImport({
  collegeId,
  collegeName,
  moduleKey,
  moduleLabel,
}: {
  collegeId: string;
  collegeName: string;
  moduleKey: string;
  moduleLabel: string;
}) {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();
  const { onHost } = usePracticeSite();
  const listHref = moduleHref(collegeId, moduleKey, onHost);
  const preview = useMemo(() => {
    if (!source.trim()) return null;
    try {
      const count = questionsFromCsv(moduleKey, source).length;
      return { ok: true, text: `${count} question${count === 1 ? "" : "s"} ready` };
    } catch (error) {
      return { ok: false, text: error instanceof ImportError ? error.message : "This file could not be read." };
    }
  }, [moduleKey, source]);

  function download() {
    const blob = new Blob([templateCsv(moduleKey)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${moduleKey}-questions.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function readFile(file: File | undefined) {
    if (!file) return;
    setMessage("");
    file.text().then((text) => setSource(text));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setOk(false);
    startTransition(async () => {
      const result = await importQuestionsAction(collegeId, moduleKey, source);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setOk(true);
      setMessage(`Imported ${result.count} draft${result.count === 1 ? "" : "s"}.`);
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header>
        <Link href={listHref} className="text-sm text-accent">
          {collegeName} · {moduleLabel}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Import questions</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          Upload a CSV for this module. Each row becomes a new draft. A problem in any row saves nothing. Importing the same file again adds the questions again.
        </p>
      </header>
      <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-line bg-card p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={download}
            className="rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-ink hover:bg-background"
          >
            Download template
          </button>
          <label className="rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-ink hover:bg-background">
            Choose CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => readFile(event.target.files?.[0])}
            />
          </label>
        </div>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-ink">Sheet</span>
          <textarea
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="min-h-64 w-full rounded-lg border border-line bg-background px-3 py-2 font-mono text-sm text-ink outline-none focus:border-accent"
            placeholder="Paste the sheet here, or choose a CSV."
          />
        </label>
        {preview ? <p className={`text-sm ${preview.ok ? "text-muted" : "text-danger"}`}>{preview.text}</p> : null}
        {message ? (
          <p className={`rounded-lg px-3 py-2 text-sm ${ok ? "bg-accent-soft text-accent" : "bg-[#fdecec] text-danger"}`}>{message}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending || !preview?.ok}
          className="justify-self-start rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
        >
          {pending ? "Importing…" : "Import drafts"}
        </button>
      </form>
    </main>
  );
}
