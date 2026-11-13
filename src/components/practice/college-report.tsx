"use client";

import { useMemo, useState } from "react";
import { usePracticeSite } from "@/components/practice/practice-site";
import { reportHref } from "@/lib/practice-host";
import type { CollegeReport } from "@/lib/practice-report";

const filterClass = "rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";

export function CollegeReportView({ collegeId, report }: { collegeId: string; report: CollegeReport }) {
  const { onHost } = usePracticeSite();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [moduleLabel, setModuleLabel] = useState("");
  const departments = useMemo(
    () => [...new Set(report.rows.map((row) => row.department).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [report.rows],
  );
  const years = useMemo(
    () => [...new Set(report.rows.map((row) => row.studyYear).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [report.rows],
  );
  const modules = useMemo(
    () => [...new Set(report.rows.map((row) => row.moduleLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [report.rows],
  );
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return report.rows.filter((row) => {
      if (needle && !`${row.fullName} ${row.email} ${row.rollNumber}`.toLowerCase().includes(needle)) return false;
      if (department && row.department !== department) return false;
      if (year && row.studyYear !== year) return false;
      if (moduleLabel && row.moduleLabel !== moduleLabel) return false;
      return true;
    });
  }, [department, moduleLabel, query, report.rows, year]);
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">Attempt report</h2>
          <p className="mt-1 text-sm text-muted">Published questions only. Attempted and solved are counts of questions for that student.</p>
        </div>
        <a
          href={reportHref(collegeId, onHost)}
          className="rounded-lg bg-accent px-3 py-1.5 text-center text-sm font-medium text-white hover:bg-[#3e5ae0]"
        >
          Download
        </a>
      </div>
      {report.modules.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted">No modules are turned on yet.</p>
      ) : (
        <>
          <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-3">
            {report.modules.map((module) => (
              <article key={module.key} className="rounded-xl bg-background px-3 py-3">
                <p className="text-sm font-medium text-ink">{module.label}</p>
                <p className="mt-1 text-sm text-muted">
                  {module.publishedCount} published · {module.studentsAttempted}{" "}
                  {module.studentsAttempted === 1 ? "student" : "students"} attempted · {module.solvedCount} solved
                </p>
              </article>
            ))}
          </div>
          {report.rows.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted">No students yet.</p>
          ) : (
            <>
              <div className="grid gap-2 border-b border-line px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, email, or roll"
                  className={filterClass}
                />
                <select value={department} onChange={(event) => setDepartment(event.target.value)} className={filterClass}>
                  <option value="">All departments</option>
                  {departments.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select value={year} onChange={(event) => setYear(event.target.value)} className={filterClass}>
                  <option value="">All years</option>
                  {years.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select value={moduleLabel} onChange={(event) => setModuleLabel(event.target.value)} className={filterClass}>
                  <option value="">All modules</option>
                  {modules.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              {rows.length === 0 ? (
                <p className="px-4 py-8 text-sm text-muted">No matches</p>
              ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-line text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Roll number</th>
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 font-medium">Year</th>
                    <th className="px-4 py-3 font-medium">Module</th>
                    <th className="px-4 py-3 font-medium">Attempted</th>
                    <th className="px-4 py-3 font-medium">Solved</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.email}-${row.moduleLabel}`} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-medium text-ink">{row.fullName}</td>
                      <td className="px-4 py-3 text-ink">{row.rollNumber}</td>
                      <td className="px-4 py-3 text-ink">{row.department}</td>
                      <td className="px-4 py-3 text-ink">{row.studyYear}</td>
                      <td className="px-4 py-3 text-ink">{row.moduleLabel}</td>
                      <td className="px-4 py-3 text-ink">{row.attempted}</td>
                      <td className="px-4 py-3 text-ink">{row.solved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
