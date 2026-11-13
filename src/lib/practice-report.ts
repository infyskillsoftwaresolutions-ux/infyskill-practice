import { getDb } from "@/lib/db";
import { getPracticeCollege, listCollegeStudents } from "@/lib/practice";
import { collegeReportOpen, readPracticeAccess } from "@/lib/practice-access";
import { PRACTICE_MODULES } from "@/lib/practice-questions";
import type { PracticeViewer } from "@/lib/practice-auth";

export type ReportModule = {
  key: string;
  label: string;
  publishedCount: number;
  studentsAttempted: number;
  solvedCount: number;
};

export type ReportRow = {
  fullName: string;
  email: string;
  rollNumber: string;
  department: string;
  studyYear: string;
  moduleLabel: string;
  attempted: number;
  solved: number;
};

export type CollegeReport = {
  collegeName: string;
  modules: ReportModule[];
  rows: ReportRow[];
};

type CountRow = {
  user_id: string;
  module_key: string;
  attempted: number;
  solved: number;
};

function canReadReport(user: PracticeViewer) {
  return user.role === "main_admin" || user.role === "college_admin";
}

export function collegeReport(user: PracticeViewer, collegeId: string): CollegeReport | null {
  if (!canReadReport(user)) return null;
  const college = getPracticeCollege(user, collegeId);
  if (!college) return null;
  if (user.role === "college_admin" && !collegeReportOpen(readPracticeAccess(collegeId))) return null;

  const modules = getDb()
    .prepare(`SELECT id, module_key FROM practice_modules WHERE college_id = ?`)
    .all(collegeId) as { id: string; module_key: string }[];
  const byKey = new Map(modules.map((module) => [module.module_key, module.id]));

  const counts = getDb()
    .prepare(
      `SELECT a.user_id, m.module_key,
              COUNT(DISTINCT q.id) AS attempted,
              COUNT(DISTINCT CASE WHEN a.outcome = 'solved' THEN q.id END) AS solved
       FROM practice_attempts a
       JOIN practice_questions q ON q.id = a.question_id AND q.status = 'published'
       JOIN practice_modules m ON m.id = q.module_id
       WHERE q.college_id = ?
       GROUP BY a.user_id, m.module_key`,
    )
    .all(collegeId) as CountRow[];
  const countKey = (userId: string, moduleKey: string) => `${userId}:${moduleKey}`;
  const byStudent = new Map(counts.map((row) => [countKey(row.user_id, row.module_key), row]));

  const enabled = PRACTICE_MODULES.filter((module) => byKey.has(module.key));
  const students = listCollegeStudents(collegeId);
  const rows: ReportRow[] = [];
  for (const student of students) {
    for (const module of enabled) {
      const count = byStudent.get(countKey(student.id, module.key));
      rows.push({
        fullName: student.fullName,
        email: student.email,
        rollNumber: student.rollNumber,
        department: student.department,
        studyYear: student.studyYear,
        moduleLabel: module.label,
        attempted: Number(count?.attempted ?? 0),
        solved: Number(count?.solved ?? 0),
      });
    }
  }

  return {
    collegeName: college.name,
    modules: enabled.map((module) => {
      const moduleRows = rows.filter((row) => row.moduleLabel === module.label);
      const published = getDb()
        .prepare(`SELECT COUNT(*) AS count FROM practice_questions WHERE module_id = ? AND status = 'published'`)
        .get(byKey.get(module.key)) as { count: number };
      return {
        key: module.key,
        label: module.label,
        publishedCount: Number(published.count ?? 0),
        studentsAttempted: moduleRows.filter((row) => row.attempted > 0).length,
        solvedCount: moduleRows.reduce((sum, row) => sum + row.solved, 0),
      };
    }),
    rows,
  };
}

function cell(value: string | number) {
  const text = String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function collegeReportCsv(report: CollegeReport) {
  const header = ["Name", "Email", "Roll number", "Department", "Year", "Module", "Attempted", "Solved"];
  const lines = [
    header.map(cell).join(","),
    ...report.rows.map((row) =>
      [row.fullName, row.email, row.rollNumber, row.department, row.studyYear, row.moduleLabel, row.attempted, row.solved]
        .map(cell)
        .join(","),
    ),
  ];
  return `${lines.join("\r\n")}\r\n`;
}

export function reportFileName(collegeName: string) {
  const slug = collegeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "college"}-practice-report.csv`;
}
