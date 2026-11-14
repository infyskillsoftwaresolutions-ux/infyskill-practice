"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { addStudentAction, importStudentsAction, removeStudentAction } from "@/app/actions/practice";
import { CollegeMark } from "@/components/practice/college-mark";
import { ModuleRail } from "@/components/practice/module-rail";
import { usePracticeSite } from "@/components/practice/practice-site";
import { collegeHref, studentsHref } from "@/lib/practice-host";
import type { PracticeRole } from "@/lib/practice-auth";
import type { PracticePerson } from "@/lib/practice";
import type { ModuleCard } from "@/lib/practice-questions";
import { StudentImportError, studentTemplateCsv, studentsFromCsv } from "@/lib/practice-student-import";

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";

export function StudentBoard({
  role,
  collegeId,
  collegeName,
  hasLogo,
  logoAt,
  modules,
  students,
  mode,
}: {
  role: PracticeRole;
  collegeId: string;
  collegeName: string;
  hasLogo: boolean;
  logoAt: string;
  modules: ModuleCard[];
  students: PracticePerson[];
  mode: "list" | "add" | "upload";
}) {
  const { onHost } = usePracticeSite();
  const activeKey = mode === "add" ? "students-add" : mode === "upload" ? "students-upload" : "students";
  return (
    <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
      <ModuleRail
        role={role}
        collegeId={collegeId}
        modules={modules}
        activeKey={activeKey}
        homeHref={collegeHref(collegeId, onHost)}
        homeLabel="College"
        studentCount={students.length}
      />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header>
          <Link href={collegeHref(collegeId, onHost)} className="text-sm text-accent">
            {collegeName}
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <CollegeMark collegeId={collegeId} name={collegeName} hasLogo={hasLogo} logoAt={logoAt} />
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {mode === "add" ? "Add student" : mode === "upload" ? "Upload students" : "Students"}
            </h1>
          </div>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            {mode === "upload"
              ? `Upload a spreadsheet for ${collegeName} only. A problem in any row adds nobody.`
              : mode === "add"
                ? `Add one student to ${collegeName}. They can sign in with this email and password.`
                : `Students of ${collegeName}. Other colleges are not listed here.`}
          </p>
        </header>
        {mode === "add" && role === "main_admin" ? <AddStudentForm collegeId={collegeId} /> : null}
        {mode === "upload" && role === "main_admin" ? <UploadStudents collegeId={collegeId} collegeName={collegeName} /> : null}
        <StudentList collegeId={collegeId} students={students} canRemove={role === "main_admin"} />
      </main>
    </div>
  );
}

function AddStudentForm({ collegeId }: { collegeId: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [studyYear, setStudyYear] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await addStudentAction(collegeId, { fullName, email, rollNumber, department, studyYear, password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFullName("");
      setEmail("");
      setRollNumber("");
      setDepartment("");
      setStudyYear("");
      setPassword("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-line bg-card px-4 py-4 sm:grid-cols-2">
      {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger sm:col-span-2">{error}</p> : null}
      <Field label="Student name" value={fullName} onChange={setFullName} />
      <Field label="Email" type="email" value={email} onChange={setEmail} />
      <Field label="Roll number" value={rollNumber} onChange={setRollNumber} />
      <Field label="Department" value={department} onChange={setDepartment} />
      <Field label="Year" value={studyYear} onChange={setStudyYear} />
      <Field label="Password" value={password} onChange={setPassword} />
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add student"}
        </button>
      </div>
    </form>
  );
}

function UploadStudents({ collegeId, collegeName }: { collegeId: string; collegeName: string }) {
  const router = useRouter();
  const { onHost } = usePracticeSite();
  const [source, setSource] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();
  const preview = useMemo(() => {
    if (!source.trim()) return null;
    try {
      const count = studentsFromCsv(source).length;
      return { ok: true, text: `${count} ${count === 1 ? "student" : "students"} ready for ${collegeName}` };
    } catch (error) {
      return { ok: false, text: error instanceof StudentImportError ? error.message : "This file could not be read." };
    }
  }, [collegeName, source]);

  function download() {
    const blob = new Blob([studentTemplateCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "students.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function readFile(file: File | undefined) {
    if (!file) return;
    setMessage("");
    setOk(false);
    file.text().then((text) => setSource(text));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setOk(false);
    startTransition(async () => {
      const result = await importStudentsAction(collegeId, source);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setOk(true);
      setSource("");
      setMessage(`Added ${result.count} ${result.count === 1 ? "student" : "students"} to ${collegeName}.`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-line bg-card px-4 py-4">
      <p className="text-sm leading-6 text-muted">
        Columns: name, email, roll, department, year, password. Each student is added only to this college.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={download} className="rounded-lg border border-line px-3.5 py-2 text-sm text-ink hover:bg-background">
          Download sample
        </button>
        <Link href={studentsHref(collegeId, onHost, "add")} className="rounded-lg border border-line px-3.5 py-2 text-sm text-ink hover:bg-background">
          Add one instead
        </Link>
      </div>
      <label>
        <span className="mb-1.5 block text-sm font-medium text-ink">Spreadsheet</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => readFile(event.target.files?.[0])}
          className="block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent"
        />
      </label>
      {preview ? <p className={`text-sm ${preview.ok ? "text-ink" : "text-danger"}`}>{preview.text}</p> : null}
      {message ? (
        <p className={`rounded-lg px-3 py-2 text-sm ${ok ? "bg-accent-soft text-accent" : "bg-[#fdecec] text-danger"}`}>{message}</p>
      ) : null}
      <div>
        <button
          type="submit"
          disabled={pending || !source.trim()}
          className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
        >
          {pending ? "Uploading…" : "Upload students"}
        </button>
      </div>
    </form>
  );
}

function StudentList({
  collegeId,
  students,
  canRemove,
}: {
  collegeId: string;
  students: PracticePerson[];
  canRemove: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [pending, startTransition] = useTransition();
  const departments = useMemo(
    () => [...new Set(students.map((person) => person.department).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [students],
  );
  const years = useMemo(
    () => [...new Set(students.map((person) => person.studyYear).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [students],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return students.filter((person) => {
      if (needle && !`${person.fullName} ${person.email} ${person.rollNumber}`.toLowerCase().includes(needle)) return false;
      if (department && person.department !== department) return false;
      if (year && person.studyYear !== year) return false;
      return true;
    });
  }, [department, query, students, year]);

  function remove(userId: string) {
    setError("");
    setPendingId(userId);
    startTransition(async () => {
      const result = await removeStudentAction(collegeId, userId);
      setPendingId("");
      if (!result.ok) {
        setError(result.error ?? "Could not remove this student.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card">
      <h2 className="border-b border-line px-4 py-3 text-base font-semibold text-ink">Students in this college</h2>
      {error ? <p className="mx-4 mt-3 rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
      {students.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted">No students yet.</p>
      ) : (
        <>
          <div className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email, or roll"
              className={inputClass}
            />
            <select value={department} onChange={(event) => setDepartment(event.target.value)} className={inputClass}>
              <option value="">All departments</option>
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select value={year} onChange={(event) => setYear(event.target.value)} className={inputClass}>
              <option value="">All years</option>
              {years.map((item) => (
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
                    <th className="px-4 py-3 font-medium">Roll number</th>
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 font-medium">Year</th>
                    {canRemove ? <th className="px-4 py-3 font-medium">Access</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((person) => (
                    <tr key={person.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-medium text-ink">{person.fullName}</td>
                      <td className="px-4 py-3 text-ink">{person.email}</td>
                      <td className="px-4 py-3 text-ink">{person.rollNumber}</td>
                      <td className="px-4 py-3 text-ink">{person.department}</td>
                      <td className="px-4 py-3 text-ink">{person.studyYear}</td>
                      {canRemove ? (
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={pending && pendingId === person.id}
                            onClick={() => remove(person.id)}
                            className="text-sm text-muted hover:text-ink disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input className={inputClass} type={type} value={value} onChange={(event) => onChange(event.target.value)} required />
    </label>
  );
}
