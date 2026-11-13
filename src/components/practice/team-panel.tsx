"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { addEmployeeAction } from "@/app/actions/practice";
import type { PracticeEmployee } from "@/lib/practice";

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";

export function TeamPanel({ employees }: { employees: PracticeEmployee[] }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [college, setCollege] = useState("");
  const collegeNames = useMemo(
    () => [...new Set(employees.flatMap((employee) => employee.colleges.map((item) => item.name)))].sort((a, b) => a.localeCompare(b)),
    [employees],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return employees.filter((employee) => {
      if (needle && !`${employee.fullName} ${employee.email}`.toLowerCase().includes(needle)) return false;
      if (college === "none" && employee.colleges.length > 0) return false;
      if (college && college !== "none" && !employee.colleges.some((item) => item.name === college)) return false;
      return true;
    });
  }, [college, employees, query]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await addEmployeeAction({ fullName, email, password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFullName("");
      setEmail("");
      setPassword("");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Employees</h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
          These are InfySkill staff. Open a college to give an employee access. They draft questions there.
        </p>
      </header>

      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-line bg-card p-4 sm:grid-cols-2">
        {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger sm:col-span-2">{error}</p> : null}
        <label>
          <span className="mb-1.5 block text-sm font-medium text-ink">Name</span>
          <input className={inputClass} value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-ink">Email</span>
          <input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-ink">Password</span>
          <input
            className={inputClass}
            type="text"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </label>
        <div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add employee"}
          </button>
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-line bg-card">
        {employees.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No employees yet.</p>
        ) : (
          <>
            <div className="grid gap-2 border-b border-line px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name or email"
                className="rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
              <select
                value={college}
                onChange={(event) => setCollege(event.target.value)}
                className="rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              >
                <option value="">All colleges</option>
                <option value="none">No college yet</option>
                {collegeNames.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted">No matches</p>
            ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Colleges</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((employee) => (
                  <tr key={employee.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{employee.fullName}</td>
                    <td className="px-4 py-3 text-ink">{employee.email}</td>
                    <td className="px-4 py-3 text-muted">
                      {employee.colleges.length === 0 ? "No college yet" : employee.colleges.map((college) => college.name).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
