import { getDb } from "@/lib/db";
import { ValidationError } from "@/lib/practice";
import { readPracticeAccess, studentAccessMessage, studentsCanPractice } from "@/lib/practice-access";
import { getQuestion, type PracticeModuleKey, type QuestionDetail } from "@/lib/practice-questions";
import { executeProgram, outputsMatch } from "@/lib/practice-runner";
import { assertActiveMock } from "@/lib/practice-mocks";
import { gradeSql, previewSql } from "@/lib/practice-sql";
import type { PracticeViewer } from "@/lib/practice-auth";

export type AttemptRecord = {
  id: string;
  outcome: "attempted" | "solved";
  language: string;
  createdAt: string;
};

const LANGUAGES: Record<string, string[]> = {
  coding: ["Python", "Java", "C", "C++"],
  sql: ["SQL"],
  web: ["HTML"],
};

export function listAttempts(userId: string, questionId: string): AttemptRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT id, outcome, language, created_at
       FROM practice_attempts
       WHERE user_id = ? AND question_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
    )
    .all(userId, questionId) as { id: string; outcome: string; language: string; created_at: string }[];
  return rows.map((row) => ({
    id: String(row.id),
    outcome: row.outcome === "solved" ? "solved" : "attempted",
    language: String(row.language),
    createdAt: String(row.created_at),
  }));
}

export function questionNeighbors(collegeId: string, moduleKey: string, questionId: string) {
  const rows = getDb()
    .prepare(
      `SELECT q.id
       FROM practice_questions q
       JOIN practice_modules m ON m.id = q.module_id
       WHERE q.college_id = ? AND m.module_key = ? AND q.status = 'published'
       ORDER BY q.created_at DESC`,
    )
    .all(collegeId, moduleKey) as { id: string }[];
  const index = rows.findIndex((row) => row.id === questionId);
  return {
    previousId: index > 0 ? String(rows[index - 1].id) : null,
    nextId: index >= 0 && index < rows.length - 1 ? String(rows[index + 1].id) : null,
  };
}

function requireStudentQuestion(user: PracticeViewer, collegeId: string, questionId: string) {
  if (user.role !== "student") throw new ValidationError("Only a student can submit an answer.");
  const access = readPracticeAccess(collegeId);
  if (!studentsCanPractice(access)) {
    const college = getDb().prepare(`SELECT name FROM colleges WHERE id = ?`).get(collegeId) as { name: string } | undefined;
    throw new ValidationError(studentAccessMessage(college?.name || "this college", access));
  }
  const question = getQuestion(user, collegeId, questionId);
  if (!question || question.status !== "published") throw new ValidationError("That question is not open.");
  return question;
}

function recordAttempt(userId: string, questionId: string, answer: string, language: string, choiceId: string, outcome: "attempted" | "solved") {
  getDb()
    .prepare(
      `INSERT INTO practice_attempts (id, user_id, question_id, answer_text, language, choice_id, outcome, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(crypto.randomUUID(), userId, questionId, answer, language, choiceId, outcome, new Date().toISOString());
}

function guardMock(user: PracticeViewer, collegeId: string, questionId: string, mockId?: string) {
  if (mockId) assertActiveMock(user.id, collegeId, questionId, mockId);
}

export function ensureQuestionClock(userId: string, questionId: string, minutes: number) {
  if (!Number.isInteger(minutes) || minutes <= 0) return "";
  const existing = getDb()
    .prepare(`SELECT ends_at FROM practice_question_clocks WHERE user_id = ? AND question_id = ?`)
    .get(userId, questionId) as { ends_at: string } | undefined;
  if (existing) return String(existing.ends_at);
  const started = new Date();
  const ends = new Date(started.getTime() + minutes * 60 * 1000).toISOString();
  getDb()
    .prepare(`INSERT INTO practice_question_clocks (user_id, question_id, started_at, ends_at) VALUES (?, ?, ?, ?)`)
    .run(userId, questionId, started.toISOString(), ends);
  return ends;
}

function assertQuestionClock(userId: string, question: QuestionDetail, mockId?: string) {
  if (mockId || question.timeMinutes <= 0) return;
  const endsAt = ensureQuestionClock(userId, question.id, question.timeMinutes);
  if (endsAt && endsAt <= new Date().toISOString()) throw new ValidationError("Time is up.");
}

export function submitChoice(user: PracticeViewer, collegeId: string, questionId: string, choiceId: unknown, mockId?: string) {
  const question = requireStudentQuestion(user, collegeId, questionId);
  guardMock(user, collegeId, questionId, mockId);
  assertQuestionClock(user.id, question, mockId);
  if (question.kind !== "choice") throw new ValidationError("This question needs a written answer, not a choice.");
  if (typeof choiceId !== "string" || !choiceId) throw new ValidationError("Choose an answer.");
  const choice = getDb()
    .prepare(`SELECT id, is_correct FROM practice_choices WHERE id = ? AND question_id = ?`)
    .get(choiceId, questionId) as { id: string; is_correct: number } | undefined;
  if (!choice) throw new ValidationError("That choice is not part of this question.");
  const solved = choice.is_correct === 1;
  recordAttempt(user.id, questionId, "", "", choice.id, solved ? "solved" : "attempted");
  return {
    outcome: solved ? ("solved" as const) : ("attempted" as const),
    message: solved ? "Correct." : "Not correct. Try again.",
  };
}

function answerOf(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ValidationError("The answer is missing.");
  const record = input as Record<string, unknown>;
  const parts = Array.isArray(record.parts) ? record.parts.map((part) => (typeof part === "string" ? part : "")).slice(0, 6) : [];
  const answer = typeof record.answer === "string" ? record.answer : parts.join("\n\n");
  if (![answer, ...parts].some((item) => item.trim())) throw new ValidationError("Write an answer before submitting.");
  if (answer.length > 20000 || parts.some((part) => part.length > 20000)) {
    throw new ValidationError("The answer must be 20,000 characters or fewer.");
  }
  return { record, answer, parts };
}

async function gradeCode(question: QuestionDetail, language: string, source: string, hidden: boolean) {
  const tests = hidden && question.hiddenTests.length > 0 ? question.hiddenTests : question.samples;
  if (tests.length === 0) throw new ValidationError("This question has no tests yet.");
  let passed = 0;
  const lines: string[] = [];
  for (let index = 0; index < tests.length; index += 1) {
    const test = tests[index];
    const result = await executeProgram(language, source, test.input);
    const label = hidden && question.hiddenTests.length > 0 ? `Hidden test ${index + 1}` : `Sample ${index + 1}`;
    if (result.ok && outputsMatch(result.output, test.output)) {
      passed += 1;
      lines.push(`${label}: passed`);
    } else if (hidden && question.hiddenTests.length > 0) {
      lines.push(`${label}: did not match`);
    } else {
      lines.push(`${label}: did not match\n${result.output || "No output."}`);
    }
  }
  const solved = passed === tests.length;
  return {
    solved,
    console: lines.join("\n"),
    message: solved ? "Correct." : `Not correct. ${passed} of ${tests.length} tests passed.`,
  };
}

export async function runWork(user: PracticeViewer, collegeId: string, questionId: string, input: unknown, mockId?: string) {
  const question = requireStudentQuestion(user, collegeId, questionId);
  guardMock(user, collegeId, questionId, mockId);
  assertQuestionClock(user.id, question, mockId);
  if (question.kind !== "code") throw new ValidationError("Choose an answer for this question.");
  const { record, answer, parts } = answerOf(input);
  if (question.moduleKey === "web") return { console: "Preview shows the page. Submit checks the expected text." };
  if (question.moduleKey === "sql") {
    const detail = staffQuestion(questionId);
    if (!detail || detail.sqlParts.length === 0) throw new ValidationError("This question has no tasks yet.");
    const answers = parts.length ? parts : [answer];
    return { console: previewSql(detail.setupSql, answers) };
  }
  const allowed = LANGUAGES[question.moduleKey as PracticeModuleKey] ?? ["Python"];
  const language = typeof record.language === "string" && allowed.includes(record.language) ? record.language : allowed[0];
  const graded = await gradeCode(question, language, answer, false);
  return { console: graded.console };
}

export async function submitWork(user: PracticeViewer, collegeId: string, questionId: string, input: unknown, mockId?: string) {
  const question = requireStudentQuestion(user, collegeId, questionId);
  guardMock(user, collegeId, questionId, mockId);
  assertQuestionClock(user.id, question, mockId);
  if (question.kind !== "code") throw new ValidationError("Choose an answer for this question.");
  const { record, answer, parts } = answerOf(input);
  const allowed = LANGUAGES[question.moduleKey as PracticeModuleKey] ?? ["Python"];
  const language = typeof record.language === "string" && allowed.includes(record.language) ? record.language : allowed[0];
  let solved = false;
  let message = "Not correct.";
  if (question.moduleKey === "web") {
    const detail = staffQuestion(questionId);
    if (!detail) throw new ValidationError("This question has no check yet.");
    solved = detail.webExpect.length > 0 && answer.includes(detail.webExpect);
    message = solved ? "Correct." : "Not correct. The page does not contain the expected text.";
  } else if (question.moduleKey === "sql") {
    const detail = staffQuestion(questionId);
    if (!detail || detail.sqlParts.length === 0) throw new ValidationError("This question has no tasks yet.");
    const answers = parts.length ? parts : [answer];
    if (answers.length < detail.sqlParts.length) throw new ValidationError("Answer every task.");
    const graded = gradeSql(detail.setupSql, detail.sqlParts, answers);
    solved = graded.solved;
    message = graded.message;
  } else {
    const detail = staffQuestion(questionId) ?? question;
    const graded = await gradeCode({ ...question, hiddenTests: detail.hiddenTests, samples: detail.samples }, language, answer, true);
    solved = graded.solved;
    message = graded.message;
  }
  recordAttempt(user.id, questionId, answer, language, "", solved ? "solved" : "attempted");
  return { outcome: solved ? ("solved" as const) : ("attempted" as const), message };
}

function staffQuestion(questionId: string) {
  const row = getDb()
    .prepare(`SELECT college_id FROM practice_questions WHERE id = ?`)
    .get(questionId) as { college_id: string } | undefined;
  if (!row) return null;
  return getQuestion({ id: "grader", role: "main_admin", fullName: "Grader", email: "grader@local" }, row.college_id, questionId);
}

export function languagesFor(moduleKey: string) {
  return LANGUAGES[moduleKey] ?? ["Python"];
}
