"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createPracticeCollegeAction } from "@/app/actions/practice";
import { CollegeMark } from "@/components/practice/college-mark";
import type { PracticeCollegeSummary } from "@/lib/practice";
import type { PracticeRole } from "@/lib/practice-auth";

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";

export function CollegeList({
  role,
  colleges,
  addressRoot,
}: {
  role: PracticeRole;
  colleges: PracticeCollegeSummary[];
  addressRoot: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [address, setAddress] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return colleges.filter((college) => {
      if (needle && !`${college.name} ${college.webSlug}`.toLowerCase().includes(needle)) return false;
      if (address === "set" && !college.webSlug) return false;
      if (address === "open" && college.webSlug) return false;
      return true;
    });
  }, [address, colleges, query]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await createPracticeCollegeAction(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      if (result.id) router.push(`/practice/colleges/${result.id}`);
      else router.refresh();
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {role === "main_admin" ? "Colleges" : "Your colleges"}
        </h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
          {role === "main_admin"
            ? "Add a college, then add its students, college admins, and InfySkill employees."
            : role === "college_admin"
              ? "Open a college to see its modules, attempt counts, and student download."
              : "You can open only the colleges assigned to you."}
        </p>
      </header>

      {role === "main_admin" ? (
        <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-line bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label>
            <span className="mb-1.5 block text-sm font-medium text-ink">College name</span>
            <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add college"}
          </button>
          {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger sm:col-span-2">{error}</p> : null}
        </form>
      ) : null}

      {colleges.length === 0 ? (
        <section className="rounded-2xl border border-line bg-card px-4 py-14 text-center">
          <p className="text-base font-medium text-ink">{role === "main_admin" ? "No colleges yet" : "No college assigned"}</p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">
            {role === "main_admin"
              ? "Add the first college name. Students and staff are added after you open it."
              : "Ask the main admin to assign this account to a college."}
          </p>
        </section>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search colleges"
              className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <select
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            >
              <option value="">All addresses</option>
              <option value="set">Has an address</option>
              <option value="open">No separate address</option>
            </select>
          </div>
          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-line bg-card px-4 py-8 text-sm text-muted">No colleges match</p>
          ) : (
        <section className="grid gap-3 sm:grid-cols-2">
          {filtered.map((college) => (
            <Link
              key={college.id}
              href={`/practice/colleges/${college.id}`}
              className="rounded-2xl border border-line bg-card px-4 py-4 hover:border-accent"
            >
              <div className="flex items-center gap-3">
                <CollegeMark collegeId={college.id} name={college.name} hasLogo={college.hasLogo} logoAt={college.logoAt} />
                <p className="text-base font-semibold text-ink">{college.name}</p>
              </div>
              <p className="mt-2 text-sm text-muted">
                {college.studentCount} students · {college.collegeAdminCount} college admins · {college.employeeCount} employees
              </p>
              {college.webSlug ? <p className="mt-1 text-sm text-ink">{college.webSlug}.{addressRoot}</p> : null}
            </Link>
          ))}
        </section>
          )}
        </>
      )}
    </main>
  );
}
