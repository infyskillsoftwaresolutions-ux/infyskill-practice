import { getDb } from "@/lib/db";
import { ValidationError } from "@/lib/colleges";
import { getPracticeCollege } from "@/lib/practice";
import { pointsFromScore, PRACTICE_MODULES } from "@/lib/practice-questions";
import type { PracticeViewer } from "@/lib/practice-auth";

export type MockQuestionOption = {
  id: string;
  title: string;
  moduleLabel: string;
  points: number;
};

export type MockSummary = {
  id: string;
  title: string;
  minutes: number;
  status: "draft" | "published";
  questionCount: number;
  questionIds: string[];
  started: boolean;
};

export type StudentMock = {
  id: string;
  title: string;
  minutes: number;
  questionCount: number;
  state: "ready" | "open" | "finished";
  solved: number;
  points: number;
  endsAt: string;
};

export type MockResultRow = {
  fullName: string;
  email: string;
  rollNumber: string;
  mockTitle: string;
  solved: number;
  questionCount: number;
  points: number;
  startedAt: string;
  endsAt: string;
};

export type MockPaper = {
  id: string;
  title: string;
  minutes: number;
  state: "ready" | "open" | "finished";
  endsAt: string;
  solved: number;
  points: number;
  questions: { id: string; slug: string; title: string; moduleLabel: string; points: number; progress: "todo" | "attempted" | "solved" }[];
};

function text(value: unknown, label: string, max: number) {
  if (typeof value !== "string") throw new ValidationError(`${label} needs to be text.`);
  const trimmed = value.trim();
  if (!trimmed) throw new ValidationError(`${label} is required.`);
  if (trimmed.length > max) throw new ValidationError(`${label} must be ${max} characters or fewer.`);
  return trimmed;
}

function publishedQuestions(collegeId: string): MockQuestionOption[] {
  const rows = getDb()
    .prepare(
      `SELECT q.id, q.title, q.difficulty_score, m.module_key
       FROM practice_questions q
       JOIN practice_modules m ON m.id = q.module_id
       WHERE q.college_id = ? AND q.status = 'published'
       ORDER BY m.module_key, q.title COLLATE NOCASE`,
    )
    .all(collegeId) as { id: string; title: string; difficulty_score: number; module_key: string }[];
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    moduleLabel: PRACTICE_MODULES.find((module) => module.key === row.module_key)?.label ?? row.module_key,
    points: pointsFromScore(Number(row.difficulty_score)),
  }));
}

export function listMockQuestionOptions(user: PracticeViewer, collegeId: string) {
  if (user.role !== "main_admin" || !getPracticeCollege(user, collegeId)) return [];
  return publishedQuestions(collegeId);
}

export function listMocks(user: PracticeViewer, collegeId: string): MockSummary[] {
  if (!getPracticeCollege(user, collegeId)) return [];
  if (user.role === "student" || user.role === "employee") return [];
  const rows = getDb()
    .prepare(
      `SELECT id, title, minutes, status
       FROM practice_mocks
       WHERE college_id = ?
       ORDER BY created_at DESC`,
    )
    .all(collegeId) as { id: string; title: string; minutes: number; status: string }[];
  return rows
    .filter((row) => user.role === "main_admin" || row.status === "published")
    .map((row) => {
      const questions = getDb()
        .prepare(`SELECT question_id FROM practice_mock_questions WHERE mock_id = ? ORDER BY sort_order, question_id`)
        .all(row.id) as { question_id: string }[];
      const started = getDb().prepare(`SELECT 1 AS ok FROM practice_mock_sittings WHERE mock_id = ? LIMIT 1`).get(row.id);
      return {
        id: String(row.id),
        title: String(row.title),
        minutes: Number(row.minutes),
        status: row.status === "published" ? "published" : "draft",
        questionCount: questions.length,
        questionIds: questions.map((question) => String(question.question_id)),
        started: Boolean(started),
      };
    });
}

function mockQuestions(mockId: string) {
  return getDb()
    .prepare(
      `SELECT q.id, q.title, q.slug, q.difficulty_score, m.module_key
       FROM practice_mock_questions mq
       JOIN practice_questions q ON q.id = mq.question_id AND q.status = 'published'
       JOIN practice_modules m ON m.id = q.module_id
       WHERE mq.mock_id = ?
       ORDER BY mq.sort_order, q.title COLLATE NOCASE`,
    )
    .all(mockId) as { id: string; title: string; slug: string; difficulty_score: number; module_key: string }[];
}

function progressFor(userId: string, questionIds: string[], startedAt: string, endsAt: string) {
  const result = new Map<string, "attempted" | "solved">();
  if (questionIds.length === 0) return result;
  const marks = questionIds.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(
      `SELECT question_id, MAX(CASE WHEN outcome = 'solved' THEN 1 ELSE 0 END) AS solved
       FROM practice_attempts
       WHERE user_id = ? AND created_at >= ? AND created_at <= ? AND question_id IN (${marks})
       GROUP BY question_id`,
    )
    .all(userId, startedAt, endsAt, ...questionIds) as { question_id: string; solved: number }[];
  for (const row of rows) result.set(String(row.question_id), row.solved === 1 ? "solved" : "attempted");
  return result;
}

export function listStudentMocks(user: PracticeViewer, collegeId: string): StudentMock[] {
  if (user.role !== "student" || !getPracticeCollege(user, collegeId)) return [];
  const rows = getDb()
    .prepare(`SELECT id, title, minutes FROM practice_mocks WHERE college_id = ? AND status = 'published' ORDER BY created_at DESC`)
    .all(collegeId) as { id: string; title: string; minutes: number }[];
  const now = new Date().toISOString();
  return rows.map((row) => {
    const questions = mockQuestions(row.id);
    const sitting = getDb()
      .prepare(`SELECT started_at, ends_at FROM practice_mock_sittings WHERE mock_id = ? AND user_id = ?`)
      .get(row.id, user.id) as { started_at: string; ends_at: string } | undefined;
    const progress = sitting ? progressFor(user.id, questions.map((question) => String(question.id)), sitting.started_at, sitting.ends_at) : new Map();
    const solved = [...progress.values()].filter((item) => item === "solved").length;
    const points = questions.reduce((sum, question) => (progress.get(String(question.id)) === "solved" ? sum + pointsFromScore(Number(question.difficulty_score)) : sum), 0);
    const state = !sitting ? "ready" : sitting.ends_at <= now ? "finished" : "open";
    return {
      id: String(row.id),
      title: String(row.title),
      minutes: Number(row.minutes),
      questionCount: questions.length,
      state,
      solved,
      points,
      endsAt: sitting?.ends_at ?? "",
    };
  });
}

export function getMockPaper(user: PracticeViewer, collegeId: string, mockId: string): MockPaper | null {
  if (user.role !== "student" || !getPracticeCollege(user, collegeId)) return null;
  const mock = getDb()
    .prepare(`SELECT id, title, minutes, status, college_id FROM practice_mocks WHERE id = ?`)
    .get(mockId) as { id: string; title: string; minutes: number; status: string; college_id: string } | undefined;
  if (!mock || mock.college_id !== collegeId || mock.status !== "published") return null;
  const questions = mockQuestions(mock.id);
  const sitting = getDb()
    .prepare(`SELECT started_at, ends_at FROM practice_mock_sittings WHERE mock_id = ? AND user_id = ?`)
    .get(mock.id, user.id) as { started_at: string; ends_at: string } | undefined;
  const now = new Date().toISOString();
  const progress = sitting ? progressFor(user.id, questions.map((question) => String(question.id)), sitting.started_at, sitting.ends_at) : new Map();
  const state = !sitting ? "ready" : sitting.ends_at <= now ? "finished" : "open";
  return {
    id: String(mock.id),
    title: String(mock.title),
    minutes: Number(mock.minutes),
    state,
    endsAt: sitting?.ends_at ?? "",
    solved: [...progress.values()].filter((item) => item === "solved").length,
    points: questions.reduce((sum, question) => (progress.get(String(question.id)) === "solved" ? sum + pointsFromScore(Number(question.difficulty_score)) : sum), 0),
    questions: questions.map((question) => ({
      id: String(question.id),
      slug: String(question.slug),
      title: String(question.title),
      moduleLabel: PRACTICE_MODULES.find((module) => module.key === question.module_key)?.label ?? question.module_key,
      points: pointsFromScore(Number(question.difficulty_score)),
      progress: progress.get(String(question.id)) ?? "todo",
    })),
  };
}

export function mockEndsAt(userId: string, mockId: string) {
  const sitting = getDb()
    .prepare(`SELECT ends_at FROM practice_mock_sittings WHERE mock_id = ? AND user_id = ?`)
    .get(mockId, userId) as { ends_at: string } | undefined;
  return sitting?.ends_at ?? "";
}

export function mockNeighbors(mockId: string, questionId: string) {
  const rows = mockQuestions(mockId);
  const index = rows.findIndex((row) => row.id === questionId);
  return {
    previousId: index > 0 ? String(rows[index - 1].id) : null,
    nextId: index >= 0 && index < rows.length - 1 ? String(rows[index + 1].id) : null,
  };
}

export function startMock(user: PracticeViewer, collegeId: string, mockId: string) {
  if (user.role !== "student") throw new ValidationError("Only a student can start a mock.");
  if (!getPracticeCollege(user, collegeId)) throw new ValidationError("That mock is not open.");
  const mock = getDb()
    .prepare(`SELECT id, minutes, status, college_id FROM practice_mocks WHERE id = ?`)
    .get(mockId) as { id: string; minutes: number; status: string; college_id: string } | undefined;
  if (!mock || mock.college_id !== collegeId || mock.status !== "published") throw new ValidationError("That mock is not open.");
  if (mockQuestions(mock.id).length === 0) throw new ValidationError("This mock has no questions yet.");
  const existing = getDb().prepare(`SELECT id FROM practice_mock_sittings WHERE mock_id = ? AND user_id = ?`).get(mock.id, user.id);
  if (existing) return;
  const started = new Date();
  const ends = new Date(started.getTime() + Number(mock.minutes) * 60 * 1000);
  getDb()
    .prepare(`INSERT INTO practice_mock_sittings (id, mock_id, user_id, started_at, ends_at) VALUES (?, ?, ?, ?, ?)`)
    .run(crypto.randomUUID(), mock.id, user.id, started.toISOString(), ends.toISOString());
}

export function assertActiveMock(userId: string, collegeId: string, questionId: string, mockId: string) {
  const mock = getDb()
    .prepare(`SELECT id, status, college_id FROM practice_mocks WHERE id = ?`)
    .get(mockId) as { id: string; status: string; college_id: string } | undefined;
  if (!mock || mock.college_id !== collegeId || mock.status !== "published") throw new ValidationError("That mock is not open.");
  const included = getDb()
    .prepare(`SELECT 1 AS ok FROM practice_mock_questions WHERE mock_id = ? AND question_id = ?`)
    .get(mock.id, questionId);
  if (!included) throw new ValidationError("That question is not in this mock.");
  const sitting = getDb()
    .prepare(`SELECT ends_at FROM practice_mock_sittings WHERE mock_id = ? AND user_id = ?`)
    .get(mock.id, userId) as { ends_at: string } | undefined;
  if (!sitting) throw new ValidationError("Start the mock before answering.");
  if (sitting.ends_at <= new Date().toISOString()) throw new ValidationError("Time is up.");
}

export function saveMock(user: PracticeViewer, collegeId: string, mockId: string | null, input: unknown) {
  if (user.role !== "main_admin" || !getPracticeCollege(user, collegeId)) throw new ValidationError("Only the main admin can set a mock.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ValidationError("Mock details are missing.");
  const record = input as Record<string, unknown>;
  const title = text(record.title, "Mock name", 120);
  const minutes = typeof record.minutes === "number" ? record.minutes : Number(record.minutes);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 180) throw new ValidationError("Minutes must be a whole number from 5 to 180.");
  const ids = Array.isArray(record.questionIds) ? record.questionIds.filter((id): id is string => typeof id === "string") : [];
  const unique = [...new Set(ids)].slice(0, 100);
  if (unique.length === 0) throw new ValidationError("Choose at least one published question.");
  const allowed = new Set(publishedQuestions(collegeId).map((question) => question.id));
  if (unique.some((id) => !allowed.has(id))) throw new ValidationError("Choose published questions from this college.");
  const publish = record.publish === true;
  const stamp = new Date().toISOString();
  const db = getDb();
  if (!mockId) {
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO practice_mocks (id, college_id, title, minutes, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      id,
      collegeId,
      title,
      minutes,
      publish ? "published" : "draft",
      stamp,
    );
    const insert = db.prepare(`INSERT INTO practice_mock_questions (mock_id, question_id, sort_order) VALUES (?, ?, ?)`);
    unique.forEach((questionId, index) => insert.run(id, questionId, index));
    return id;
  }
  const existing = db.prepare(`SELECT id, college_id FROM practice_mocks WHERE id = ?`).get(mockId) as { id: string; college_id: string } | undefined;
  if (!existing || existing.college_id !== collegeId) throw new ValidationError("That mock is no longer on file.");
  const started = db.prepare(`SELECT 1 AS ok FROM practice_mock_sittings WHERE mock_id = ? LIMIT 1`).get(existing.id);
  if (started) throw new ValidationError("Students have already started this mock.");
  db.prepare(`UPDATE practice_mocks SET title = ?, minutes = ?, status = ? WHERE id = ?`).run(title, minutes, publish ? "published" : "draft", existing.id);
  db.prepare(`DELETE FROM practice_mock_questions WHERE mock_id = ?`).run(existing.id);
  const insert = db.prepare(`INSERT INTO practice_mock_questions (mock_id, question_id, sort_order) VALUES (?, ?, ?)`);
  unique.forEach((questionId, index) => insert.run(existing.id, questionId, index));
  return existing.id;
}

export function listMockResults(user: PracticeViewer, collegeId: string): MockResultRow[] | null {
  if ((user.role !== "main_admin" && user.role !== "college_admin") || !getPracticeCollege(user, collegeId)) return null;
  const rows = getDb()
    .prepare(
      `SELECT u.full_name, u.email, u.roll_number, u.id AS user_id, k.title, k.id AS mock_id, s.started_at, s.ends_at
       FROM practice_mock_sittings s
       JOIN practice_mocks k ON k.id = s.mock_id
       JOIN practice_users u ON u.id = s.user_id
       WHERE k.college_id = ?
       ORDER BY s.started_at DESC`,
    )
    .all(collegeId) as {
    full_name: string;
    email: string;
    roll_number: string;
    user_id: string;
    title: string;
    mock_id: string;
    started_at: string;
    ends_at: string;
  }[];
  return rows.map((row) => {
    const questions = mockQuestions(row.mock_id);
    const progress = progressFor(
      row.user_id,
      questions.map((question) => String(question.id)),
      row.started_at,
      row.ends_at,
    );
    const solved = [...progress.values()].filter((item) => item === "solved").length;
    return {
      fullName: String(row.full_name),
      email: String(row.email),
      rollNumber: String(row.roll_number),
      mockTitle: String(row.title),
      solved,
      questionCount: questions.length,
      points: questions.reduce((sum, question) => (progress.get(String(question.id)) === "solved" ? sum + pointsFromScore(Number(question.difficulty_score)) : sum), 0),
      startedAt: String(row.started_at),
      endsAt: String(row.ends_at),
    };
  });
}

function cell(value: string | number) {
  const textValue = String(value);
  const safe = /^[=+\-@]/.test(textValue) ? `'${textValue}` : textValue;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function mockResultsCsv(rows: MockResultRow[]) {
  const header = ["Name", "Email", "Roll number", "Mock", "Solved", "Questions", "Points", "Started", "Ends"];
  const lines = [
    header.map(cell).join(","),
    ...rows.map((row) =>
      [row.fullName, row.email, row.rollNumber, row.mockTitle, row.solved, row.questionCount, row.points, row.startedAt, row.endsAt]
        .map(cell)
        .join(","),
    ),
  ];
  return `${lines.join("\r\n")}\r\n`;
}
