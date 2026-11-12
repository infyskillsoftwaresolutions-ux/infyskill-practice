"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteCollegeAction } from "@/app/actions/colleges";
import { CollegeDialog } from "@/components/colleges/college-dialog";
import type { College } from "@/lib/colleges";

type SortKey = "newest" | "name";

export function CollegesWorkspace({ colleges }: { colleges: College[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [formOpen, setFormOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = colleges.filter((college) => {
      if (!needle) return true;
      return college.name.toLowerCase().includes(needle);
    });
    return filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [colleges, query, sort]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Colleges</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Collaborations</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            Add a college name and save. Open the college to add its details, then each program and price.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0]"
        >
          Add college
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">Colleges</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{colleges.length}</p>
        </article>
        <article className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">Programs</p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {colleges.reduce((total, college) => total + college.programs.length, 0)}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-line bg-card">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search college name"
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent sm:max-w-md"
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            Sort
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="rounded-lg border border-line bg-background px-2 py-2 text-sm text-ink"
            >
              <option value="newest">Newest</option>
              <option value="name">College name</option>
            </select>
          </label>
        </div>
        {error ? <p className="mx-4 mt-3 rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
        {colleges.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="text-base font-medium text-ink">No colleges yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">
              Save a college name first. Details and programs are added after you open it.
            </p>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="mt-4 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0]"
            >
              Add college
            </button>
          </div>
        ) : (
          <ul>
            {visible.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-muted">Nothing matches that search.</li>
            ) : (
              visible.map((college) => (
                <li key={college.id} className="flex items-center justify-between gap-4 border-b border-line px-4 py-4 last:border-0">
                  <div className="min-w-0">
                    <Link href={`/colleges/${college.id}`} className="font-medium text-ink hover:text-accent">
                      {college.name}
                    </Link>
                    <p className="mt-1 text-sm text-muted">
                      {college.programs.length === 0
                        ? "No programs yet"
                        : `${college.programs.length} program${college.programs.length === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  {confirmId === college.id ? (
                    <div className="flex shrink-0 gap-3 text-sm">
                      <button
                        type="button"
                        disabled={pending}
                        className="font-medium text-danger"
                        onClick={() => {
                          setError("");
                          startTransition(async () => {
                            const result = await deleteCollegeAction(college.id);
                            if (!result.ok) setError(result.error);
                            setConfirmId(null);
                          });
                        }}
                      >
                        Delete
                      </button>
                      <button type="button" className="text-muted" onClick={() => setConfirmId(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="shrink-0 text-sm font-medium text-danger"
                      onClick={() => setConfirmId(college.id)}
                    >
                      Delete
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      <CollegeDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(id) => {
          setFormOpen(false);
          router.push(`/colleges/${id}`);
        }}
      />
    </main>
  );
}
