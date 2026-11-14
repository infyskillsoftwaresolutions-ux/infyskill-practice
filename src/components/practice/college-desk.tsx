"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  addCollegeAdminAction,
  addStudentAction,
  linkPracticeInvoiceAction,
  removeCollegeAdminAction,
  removeCollegeLogoAction,
  removeStudentAction,
  saveCollegeLogoAction,
  setEmployeeAccessAction,
  setPracticeWebAddressAction,
} from "@/app/actions/practice";
import { CollegeMark } from "@/components/practice/college-mark";
import { CollegeReportView } from "@/components/practice/college-report";
import { MockBoard } from "@/components/practice/mock-board";
import { ModuleRail } from "@/components/practice/module-rail";
import { usePracticeSite } from "@/components/practice/practice-site";
import { collegeHref } from "@/lib/practice-host";
import type { PracticeCollegeSummary, PracticeEmployee, PracticePerson } from "@/lib/practice";
import type { PracticeAccess, PracticeInvoiceOption } from "@/lib/practice-access";
import type { MockQuestionOption, MockResultRow, MockSummary } from "@/lib/practice-mocks";
import type { CollegeReport } from "@/lib/practice-report";
import type { ModuleCard } from "@/lib/practice-questions";
import type { PracticeRole } from "@/lib/practice-auth";

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";

export function CollegeDesk({
  role,
  college,
  students,
  collegeAdmins,
  employees,
  modules,
  report,
  access,
  accessMessage,
  invoices,
  mocks,
  mockQuestions,
  mockResults,
  addressRoot,
}: {
  role: PracticeRole;
  college: PracticeCollegeSummary;
  students: PracticePerson[];
  collegeAdmins: PracticePerson[];
  employees: PracticeEmployee[];
  modules: ModuleCard[];
  report: CollegeReport | null;
  access: PracticeAccess;
  accessMessage: string;
  invoices: PracticeInvoiceOption[];
  mocks: MockSummary[];
  mockQuestions: MockQuestionOption[];
  mockResults: MockResultRow[];
  addressRoot: string;
}) {
  const canManage = role === "main_admin";
  const { onHost } = usePracticeSite();

  return (
    <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
      <ModuleRail
        role={role}
        collegeId={college.id}
        modules={modules}
        homeHref={collegeHref(college.id, onHost)}
        homeLabel="College"
      />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        {onHost ? null : (
          <Link href="/practice" className="text-sm text-accent">
            Colleges
          </Link>
        )}
        <div className="mt-2 flex items-center gap-3">
          <CollegeMark collegeId={college.id} name={college.name} hasLogo={college.hasLogo} logoAt={college.logoAt} />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{college.name}</h1>
        </div>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
          {canManage
            ? "Add modules and questions for this college. Employees can draft questions. You publish them."
            : role === "college_admin"
              ? "Published questions, attempt counts, and the student download for this college."
              : "Draft questions here. The main admin publishes them for students."}
        </p>
      </header>

      {canManage ? <LogoPanel collegeId={college.id} hasLogo={college.hasLogo} /> : null}
      {canManage ? <AddressPanel collegeId={college.id} webSlug={college.webSlug} addressRoot={addressRoot} /> : null}

      <AccessPanel
        role={role}
        collegeId={college.id}
        access={access}
        accessMessage={accessMessage}
        invoices={invoices}
        studentCount={college.studentCount}
      />

      {report ? <CollegeReportView collegeId={college.id} report={report} /> : null}

      {role === "main_admin" || mocks.length > 0 || mockResults.length > 0 ? (
        <MockBoard role={role} collegeId={college.id} mocks={mocks} questions={mockQuestions} results={mockResults} />
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">Students</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{college.studentCount}</p>
        </article>
        <article className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">College admins</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{college.collegeAdminCount}</p>
        </article>
        <article className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">Employees</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{college.employeeCount}</p>
        </article>
      </section>

      {role !== "employee" ? (
        <PeopleSection
          title="Students"
          empty="No students yet."
          people={students}
          columns={["roll", "department", "year"]}
          canRemove={canManage}
          onRemove={(userId) => removeStudentAction(college.id, userId)}
        >
          {canManage ? <StudentForm collegeId={college.id} /> : null}
        </PeopleSection>
      ) : null}

      {canManage ? (
        <PeopleSection
          title="College admins"
          empty="No college admin yet. Add one or more."
          people={collegeAdmins}
          columns={[]}
          canRemove
          onRemove={(userId) => removeCollegeAdminAction(college.id, userId)}
        >
          <AdminForm collegeId={college.id} />
        </PeopleSection>
      ) : null}

      {canManage ? <EmployeeAccess collegeId={college.id} employees={employees} /> : null}
      </main>
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDay(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

function shiftDay(iso: string, years: number, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return "";
  if (years) date.setUTCFullYear(date.getUTCFullYear() + years);
  if (days) date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function AddressPanel({ collegeId, webSlug, addressRoot }: { collegeId: string; webSlug: string; addressRoot: string }) {
  const router = useRouter();
  const [slug, setSlug] = useState(webSlug);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const preview = slug.trim().toLowerCase();

  useEffect(() => setSlug(webSlug), [webSlug]);

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await setPracticeWebAddressAction(collegeId, slug);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-line bg-card px-4 py-4">
      <p className="text-sm font-medium text-ink">Web address</p>
      <p className="mt-1 text-sm text-muted">Leave this empty until the college asks for its own address.</p>
      {error ? <p className="mt-3 rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Address name</span>
        <input className={inputClass} value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="aec" />
      </label>
      {preview ? <p className="mt-2 text-sm text-ink">Students open {preview}.{addressRoot}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save address"}
      </button>
    </form>
  );
}

function LogoPanel({ collegeId, hasLogo }: { collegeId: string; hasLogo: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    startTransition(async () => {
      const result = await saveCollegeLogoAction(collegeId, data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      form.reset();
      router.refresh();
    });
  }

  function remove() {
    setError("");
    startTransition(async () => {
      const result = await removeCollegeLogoAction(collegeId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-card px-4 py-4">
      <p className="text-sm font-medium text-ink">College logo</p>
      <p className="mt-1 text-sm text-muted">PNG, JPEG, or WebP under 1 MB. Students see it on this college’s practice pages.</p>
      <form onSubmit={save} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
          className="text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save logo"}
        </button>
        {hasLogo ? (
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            className="rounded-lg border border-line px-3.5 py-2 text-sm text-ink hover:bg-background disabled:opacity-60"
          >
            Remove
          </button>
        ) : null}
      </form>
      {error ? <p className="mt-3 rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
    </section>
  );
}

function AccessPanel({
  role,
  collegeId,
  access,
  accessMessage,
  invoices,
  studentCount,
}: {
  role: PracticeRole;
  collegeId: string;
  access: PracticeAccess;
  accessMessage: string;
  invoices: PracticeInvoiceOption[];
  studentCount: number;
}) {
  const router = useRouter();
  const [invoiceId, setInvoiceId] = useState(access.invoiceId);
  const [endsOn, setEndsOn] = useState(access.endsOn);
  const [error, setError] = useState("");
  useEffect(() => {
    setInvoiceId(access.invoiceId);
    setEndsOn(access.endsOn);
  }, [access.endsOn, access.invoiceId]);
  const [pending, startTransition] = useTransition();
  const selected = invoices.find((invoice) => invoice.id === invoiceId);
  const fullYear = selected ? shiftDay(selected.issuedOn, 1, 0) : "";

  function chooseInvoice(nextId: string) {
    setInvoiceId(nextId);
    const invoice = invoices.find((item) => item.id === nextId);
    if (!invoice) {
      setEndsOn("");
      return;
    }
    setEndsOn(nextId === access.invoiceId && access.endsOn ? access.endsOn : shiftDay(invoice.issuedOn, 1, 0));
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await linkPracticeInvoiceAction(collegeId, invoiceId, endsOn);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-card px-4 py-4">
      <h2 className="text-base font-semibold text-ink">Access</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{accessMessage}</p>
      {access.phase === "open" || access.phase === "grace" ? (
        <p className="mt-1 text-sm text-ink">
          {studentCount} of {access.seats} seats filled
          {access.endsOn ? ` · through ${formatDay(access.endsOn)}` : ""}
        </p>
      ) : null}
      {role === "main_admin" ? (
        <form onSubmit={save} className="mt-4 grid gap-3">
          {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-sm font-medium text-ink">Invoice</span>
              <select className={inputClass} value={invoiceId} onChange={(event) => chooseInvoice(event.target.value)}>
                <option value="">No invoice</option>
                {invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.number} · {invoice.status} · {invoice.seats} {invoice.seats === 1 ? "seat" : "seats"} · {formatDay(invoice.issuedOn)}
                  </option>
                ))}
              </select>
            </label>
            {selected ? (
              <label>
                <span className="mb-1.5 block text-sm font-medium text-ink">Practice ends</span>
                <input
                  type="date"
                  className={inputClass}
                  min={selected.issuedOn}
                  max={fullYear}
                  value={endsOn}
                  onChange={(event) => setEndsOn(event.target.value)}
                  required
                />
              </label>
            ) : null}
          </div>
          {selected ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEndsOn(shiftDay(selected.issuedOn, 0, 30))}
                className="rounded-lg border border-line px-3.5 py-2 text-sm text-ink hover:bg-background"
              >
                30-day pilot
              </button>
              <button
                type="button"
                onClick={() => setEndsOn(fullYear)}
                className="rounded-lg border border-line px-3.5 py-2 text-sm text-ink hover:bg-background"
              >
                Full year
              </button>
            </div>
          ) : null}
          <div>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save access"}
            </button>
          </div>
          {invoices.length === 0 ? <p className="text-sm text-muted">Create an invoice for this college, then choose it here.</p> : null}
        </form>
      ) : null}
    </section>
  );
}

function StudentForm({ collegeId }: { collegeId: string }) {
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
    <form onSubmit={submit} className="grid gap-3 border-b border-line px-4 py-4 sm:grid-cols-2">
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

function AdminForm({ collegeId }: { collegeId: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await addCollegeAdminAction(collegeId, { fullName, email, password });
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
    <form onSubmit={submit} className="grid gap-3 border-b border-line px-4 py-4 sm:grid-cols-2">
      {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger sm:col-span-2">{error}</p> : null}
      <Field label="Name" value={fullName} onChange={setFullName} />
      <Field label="Email" type="email" value={email} onChange={setEmail} />
      <label className="sm:col-span-2">
        <span className="mb-1.5 block text-sm font-medium text-ink">Password</span>
          <input className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} />
        <span className="mt-1 block text-xs text-muted">
          At least 8 characters for a new admin. If this email is already a college admin, access is added to this college.
        </span>
      </label>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add college admin"}
        </button>
      </div>
    </form>
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

function PeopleSection({
  title,
  empty,
  people,
  columns,
  canRemove,
  onRemove,
  children,
}: {
  title: string;
  empty: string;
  people: PracticePerson[];
  columns: Array<"roll" | "department" | "year">;
  canRemove: boolean;
  onRemove: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const departments = useMemo(
    () => [...new Set(people.map((person) => person.department).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [people],
  );
  const years = useMemo(
    () => [...new Set(people.map((person) => person.studyYear).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [people],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return people.filter((person) => {
      if (needle && !`${person.fullName} ${person.email} ${person.rollNumber}`.toLowerCase().includes(needle)) return false;
      if (department && person.department !== department) return false;
      if (year && person.studyYear !== year) return false;
      return true;
    });
  }, [department, people, query, year]);
  const filterClass = "rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";

  function remove(userId: string) {
    setError("");
    setPendingId(userId);
    startTransition(async () => {
      const result = await onRemove(userId);
      setPendingId("");
      if (!result.ok) {
        setError(result.error ?? "Could not remove access.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card">
      <h2 className="border-b border-line px-4 py-3 text-base font-semibold text-ink">{title}</h2>
      {children}
      {error ? <p className="mx-4 mt-3 rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
      {people.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted">{empty}</p>
      ) : (
        <>
          <div className={`grid gap-2 px-4 py-3 ${columns.includes("department") ? "sm:grid-cols-[minmax(0,1fr)_auto_auto]" : ""}`}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={columns.includes("roll") ? "Search name, email, or roll" : "Search name or email"}
              className={filterClass}
            />
            {columns.includes("department") ? (
              <select value={department} onChange={(event) => setDepartment(event.target.value)} className={filterClass}>
                <option value="">All departments</option>
                {departments.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            ) : null}
            {columns.includes("year") ? (
              <select value={year} onChange={(event) => setYear(event.target.value)} className={filterClass}>
                <option value="">All years</option>
                {years.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            ) : null}
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
                {columns.includes("roll") ? <th className="px-4 py-3 font-medium">Roll number</th> : null}
                {columns.includes("department") ? <th className="px-4 py-3 font-medium">Department</th> : null}
                {columns.includes("year") ? <th className="px-4 py-3 font-medium">Year</th> : null}
                {canRemove ? <th className="px-4 py-3 font-medium">Access</th> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((person) => (
                <tr key={person.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{person.fullName}</td>
                  <td className="px-4 py-3 text-ink">{person.email}</td>
                  {columns.includes("roll") ? <td className="px-4 py-3 text-ink">{person.rollNumber}</td> : null}
                  {columns.includes("department") ? <td className="px-4 py-3 text-ink">{person.department}</td> : null}
                  {columns.includes("year") ? <td className="px-4 py-3 text-ink">{person.studyYear}</td> : null}
                  {canRemove ? (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={pending && pendingId === person.id}
                        onClick={() => remove(person.id)}
                        className="text-sm text-danger hover:underline disabled:opacity-60"
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

function EmployeeAccess({ collegeId, employees }: { collegeId: string; employees: PracticeEmployee[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [access, setAccess] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return employees.filter((employee) => {
      const allowed = employee.colleges.some((college) => college.id === collegeId);
      if (needle && !`${employee.fullName} ${employee.email}`.toLowerCase().includes(needle)) return false;
      if (access === "on" && !allowed) return false;
      if (access === "off" && allowed) return false;
      return true;
    });
  }, [access, collegeId, employees, query]);

  function toggle(employee: PracticeEmployee, allowed: boolean) {
    setError("");
    startTransition(async () => {
      const result = await setEmployeeAccessAction(collegeId, employee.id, allowed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-base font-semibold text-ink">Employee access</h2>
        <p className="mt-1 text-sm text-muted">
          An employee sees this college only when access is on.{" "}
          <Link href="/practice/team" className="text-accent">
            Add an employee
          </Link>{" "}
          first if the list is empty.
        </p>
      </div>
      {error ? <p className="mx-4 mt-3 rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
      {employees.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted">No employees yet.</p>
      ) : (
        <>
          <div className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or email"
              className="rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <select
              value={access}
              onChange={(event) => setAccess(event.target.value)}
              className="rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            >
              <option value="">All access</option>
              <option value="on">Access on</option>
              <option value="off">Access off</option>
            </select>
          </div>
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted">No matches</p>
          ) : (
        <ul>
          {filtered.map((employee) => {
            const allowed = employee.colleges.some((college) => college.id === collegeId);
            return (
              <li key={employee.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
                <div>
                  <p className="text-sm font-medium text-ink">{employee.fullName}</p>
                  <p className="text-sm text-muted">{employee.email}</p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggle(employee, !allowed)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    allowed ? "bg-accent-soft text-accent" : "border border-line text-ink"
                  }`}
                >
                  {allowed ? "Access on" : "Access off"}
                </button>
              </li>
            );
          })}
        </ul>
          )}
        </>
      )}
    </section>
  );
}
