import { getDb } from "@/lib/db";
import { getPracticeCollege, listPracticeColleges, ValidationError } from "@/lib/practice";
import { ImportError, questionsFromCsv } from "@/lib/practice-import-format";
import { assertStaffSql } from "@/lib/practice-sql";
import type { PracticeViewer } from "@/lib/practice-auth";

export const PRACTICE_MODULES = [
  { key: "coding", label: "Coding", kind: "code" },
  { key: "sql", label: "SQL", kind: "code" },
  { key: "web", label: "Web development", kind: "code" },
  { key: "aptitude", label: "Aptitude", kind: "choice" },
  { key: "reasoning", label: "Reasoning", kind: "choice" },
  { key: "verbal", label: "Verbal", kind: "choice" },
] as const;

export type PracticeModuleKey = (typeof PRACTICE_MODULES)[number]["key"];
export type PracticeModuleKind = (typeof PRACTICE_MODULES)[number]["kind"];

export type ModuleCard = {
  key: PracticeModuleKey;
  label: string;
  kind: PracticeModuleKind;
  enabled: boolean;
  draftCount: number;
  publishedCount: number;
  solvedCount: number;
};

export type QuestionListItem = {
  id: string;
  title: string;
  slug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  points: number;
  acceptance: number | null;
  status: "draft" | "published";
  progress: "todo" | "attempted" | "solved";
};

export type QuestionSample = { input: string; output: string };
export type QuestionChoice = { id?: string; text: string; correct: boolean };
export type SqlPart = { prompt: string; mode: "read" | "change"; checkSql: string };

export type QuestionDetail = {
  id: string;
  title: string;
  slug: string;
  difficultyScore: number;
  difficulty: "Easy" | "Medium" | "Hard";
  points: number;
  body: string;
  inputDescription: string;
  outputDescription: string;
  templateCode: string;
  hints: string;
  status: "draft" | "published";
  samples: QuestionSample[];
  choices: QuestionChoice[];
  hiddenTests: QuestionSample[];
  hiddenTestCount: number;
  sqlParts: SqlPart[];
  setupSql: string;
  webExpect: string;
  timeMinutes: number;
  lockCopy: boolean;
  lockPaste: boolean;
  moduleKey: PracticeModuleKey;
  moduleLabel: string;
  kind: PracticeModuleKind;
};

const MODULE_KEYS = new Set<string>(PRACTICE_MODULES.map((module) => module.key));

function now() {
  return new Date().toISOString();
}

function text(value: unknown, label: string, max: number, required = false) {
  if (typeof value !== "string") throw new ValidationError(`${label} needs to be text.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new ValidationError(`${label} is required.`);
  if (trimmed.length > max) throw new ValidationError(`${label} must be ${max} characters or fewer.`);
  return trimmed;
}

export function moduleInfo(key: string) {
  const found = PRACTICE_MODULES.find((module) => module.key === key);
  if (!found) throw new ValidationError("That module is not part of InfySkill Practice.");
  return found;
}

export function difficultyFromScore(score: number): "Easy" | "Medium" | "Hard" {
  if (score < 0.4) return "Easy";
  if (score < 0.7) return "Medium";
  return "Hard";
}

export function pointsFromScore(score: number) {
  return Math.round(score * 100);
}

function collegeOrThrow(user: PracticeViewer, collegeId: string) {
  const college = getPracticeCollege(user, collegeId);
  if (!college) throw new ValidationError("That college is not available on your account.");
  return college;
}

function canEdit(user: PracticeViewer) {
  return user.role === "main_admin" || user.role === "employee";
}

function seesDrafts(user: PracticeViewer) {
  return canEdit(user);
}

export function listModuleCards(user: PracticeViewer, collegeId: string): ModuleCard[] {
  collegeOrThrow(user, collegeId);
  const rows = getDb()
    .prepare(`SELECT id, module_key FROM practice_modules WHERE college_id = ?`)
    .all(collegeId) as { id: string; module_key: string }[];
  const byKey = new Map(rows.map((row) => [row.module_key, row.id]));
  return PRACTICE_MODULES.map((module) => {
    const moduleId = byKey.get(module.key);
    const counts = moduleId
      ? (getDb()
          .prepare(
            `SELECT
               SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS drafts,
               SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published
             FROM practice_questions WHERE module_id = ?`,
          )
          .get(moduleId) as { drafts: number | null; published: number | null })
      : { drafts: 0, published: 0 };
    const solved = moduleId && user.role === "student"
      ? (getDb()
          .prepare(
            `SELECT COUNT(DISTINCT q.id) AS count
             FROM practice_questions q
             JOIN practice_attempts a ON a.question_id = q.id AND a.user_id = ? AND a.outcome = 'solved'
             WHERE q.module_id = ? AND q.status = 'published'`,
          )
          .get(user.id, moduleId) as { count: number })
      : { count: 0 };
    return {
      key: module.key,
      label: module.label,
      kind: module.kind,
      enabled: Boolean(moduleId),
      draftCount: seesDrafts(user) ? Number(counts.drafts ?? 0) : 0,
      publishedCount: Number(counts.published ?? 0),
      solvedCount: Number(solved.count ?? 0),
    };
  });
}

export function enableModule(collegeId: string, key: string) {
  const info = moduleInfo(key);
  const existing = getDb()
    .prepare(`SELECT id FROM practice_modules WHERE college_id = ? AND module_key = ?`)
    .get(collegeId, info.key);
  if (existing) return;
  getDb()
    .prepare(`INSERT INTO practice_modules (id, college_id, module_key, created_at) VALUES (?, ?, ?, ?)`)
    .run(crypto.randomUUID(), collegeId, info.key, now());
}

export function disableModule(collegeId: string, key: string) {
  const info = moduleInfo(key);
  const row = getDb()
    .prepare(`SELECT id FROM practice_modules WHERE college_id = ? AND module_key = ?`)
    .get(collegeId, info.key) as { id: string } | undefined;
  if (!row) return;
  const count = getDb().prepare(`SELECT COUNT(*) AS count FROM practice_questions WHERE module_id = ?`).get(row.id) as { count: number };
  if (count.count > 0) throw new ValidationError("Remove the questions in this module before turning it off.");
  getDb().prepare(`DELETE FROM practice_modules WHERE id = ?`).run(row.id);
}

function moduleRow(collegeId: string, key: string) {
  const info = moduleInfo(key);
  const row = getDb()
    .prepare(`SELECT id, module_key FROM practice_modules WHERE college_id = ? AND module_key = ?`)
    .get(collegeId, info.key) as { id: string; module_key: string } | undefined;
  if (!row || !MODULE_KEYS.has(row.module_key)) throw new ValidationError("That module is not turned on for this college.");
  return { id: row.id, info };
}

export function listQuestions(user: PracticeViewer, collegeId: string, key: string): QuestionListItem[] {
  collegeOrThrow(user, collegeId);
  const module = moduleRow(collegeId, key);
  const statusSql = seesDrafts(user) ? "" : "AND status = 'published'";
  const rows = getDb()
    .prepare(
      `SELECT id, title, slug, difficulty_score, status
       FROM practice_questions
       WHERE module_id = ? ${statusSql}
       ORDER BY created_at DESC`,
    )
    .all(module.id) as { id: string; title: string; slug: string; difficulty_score: number; status: string }[];
  const ids = rows.map((row) => String(row.id));
  const progress = progressByQuestion(user.id, ids);
  const acceptance = acceptanceByQuestion(ids);
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    difficulty: difficultyFromScore(Number(row.difficulty_score)),
    points: pointsFromScore(Number(row.difficulty_score)),
    acceptance: acceptance.get(String(row.id)) ?? null,
    status: row.status === "published" ? "published" : "draft",
    progress: progress.get(String(row.id)) ?? "todo",
  }));
}

function acceptanceByQuestion(questionIds: string[]) {
  const result = new Map<string, number>();
  if (questionIds.length === 0) return result;
  const marks = questionIds.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(
      `SELECT a.question_id,
              COUNT(*) AS attempts,
              SUM(CASE WHEN a.outcome = 'solved' THEN 1 ELSE 0 END) AS solved
       FROM practice_attempts a
       JOIN practice_users u ON u.id = a.user_id AND u.role = 'student'
       WHERE a.question_id IN (${marks})
       GROUP BY a.question_id`,
    )
    .all(...questionIds) as { question_id: string; attempts: number; solved: number }[];
  for (const row of rows) {
    const attempts = Number(row.attempts);
    if (attempts > 0) result.set(String(row.question_id), Math.round((Number(row.solved) / attempts) * 100));
  }
  return result;
}

function progressByQuestion(userId: string, questionIds: string[]) {
  const result = new Map<string, "todo" | "attempted" | "solved">();
  if (questionIds.length === 0) return result;
  const marks = questionIds.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(
      `SELECT question_id,
              MAX(CASE WHEN outcome = 'solved' THEN 1 ELSE 0 END) AS solved
       FROM practice_attempts
       WHERE user_id = ? AND question_id IN (${marks})
       GROUP BY question_id`,
    )
    .all(userId, ...questionIds) as { question_id: string; solved: number }[];
  for (const row of rows) result.set(String(row.question_id), row.solved === 1 ? "solved" : "attempted");
  return result;
}

function samplesOf(questionId: string): QuestionSample[] {
  const rows = getDb()
    .prepare(`SELECT input_text, output_text FROM practice_samples WHERE question_id = ? ORDER BY sort_order, id`)
    .all(questionId) as { input_text: string; output_text: string }[];
  return rows.map((row) => ({ input: String(row.input_text), output: String(row.output_text) }));
}

function hiddenTestsOf(questionId: string): QuestionSample[] {
  const rows = getDb()
    .prepare(`SELECT input_text, output_text FROM practice_hidden_tests WHERE question_id = ? ORDER BY sort_order, id`)
    .all(questionId) as { input_text: string; output_text: string }[];
  return rows.map((row) => ({ input: String(row.input_text), output: String(row.output_text) }));
}

function hiddenTestCount(questionId: string) {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS count FROM practice_hidden_tests WHERE question_id = ? AND output_text <> ''`)
    .get(questionId) as { count: number };
  return Number(row.count);
}

function minutesOf(value: unknown) {
  const minutes = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 180) {
    throw new ValidationError("The timer must be a whole number from 0 to 180 minutes.");
  }
  return minutes;
}

function flagOf(value: unknown) {
  return value === true || value === 1 || value === "1" ? 1 : 0;
}

function sqlPartsOf(questionId: string, reveal: boolean): SqlPart[] {
  const rows = getDb()
    .prepare(`SELECT prompt, mode, check_sql FROM practice_sql_parts WHERE question_id = ? ORDER BY sort_order, id`)
    .all(questionId) as { prompt: string; mode: string; check_sql: string }[];
  return rows.map((row) => ({
    prompt: String(row.prompt),
    mode: row.mode === "change" ? "change" : "read",
    checkSql: reveal ? String(row.check_sql) : "",
  }));
}

function choicesOf(questionId: string, reveal: boolean): QuestionChoice[] {
  const rows = getDb()
    .prepare(`SELECT id, choice_text, is_correct FROM practice_choices WHERE question_id = ? ORDER BY sort_order, id`)
    .all(questionId) as { id: string; choice_text: string; is_correct: number }[];
  return rows.map((row) => ({ id: String(row.id), text: String(row.choice_text), correct: reveal && row.is_correct === 1 }));
}

type QuestionRow = {
  id: string;
  college_id: string;
  title: string;
  slug: string;
  difficulty_score: number;
  body: string;
  input_description: string;
  output_description: string;
  template_code: string;
  hints: string;
  status: string;
  setup_sql: string;
  web_expect: string;
  time_minutes: number;
  lock_copy: number;
  lock_paste: number;
  module_key: string;
};

export function getQuestion(user: PracticeViewer, collegeId: string, questionId: string): QuestionDetail | null {
  collegeOrThrow(user, collegeId);
  const row = getDb()
    .prepare(
      `SELECT q.id, q.college_id, q.title, q.slug, q.difficulty_score, q.body, q.input_description, q.output_description,
              q.template_code, q.hints, q.status, q.setup_sql, q.web_expect, q.time_minutes, q.lock_copy, q.lock_paste, m.module_key
       FROM practice_questions q
       JOIN practice_modules m ON m.id = q.module_id
       WHERE q.college_id = ? AND (q.id = ? OR q.slug = ?)
       ORDER BY CASE WHEN q.id = ? THEN 0 ELSE 1 END
       LIMIT 1`,
    )
    .get(collegeId, questionId, questionId, questionId) as QuestionRow | undefined;
  if (!row) return null;
  if (!seesDrafts(user) && row.status !== "published") return null;
  const info = moduleInfo(row.module_key);
  const score = Number(row.difficulty_score);
  const reveal = canEdit(user);
  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    difficultyScore: score,
    difficulty: difficultyFromScore(score),
    points: pointsFromScore(score),
    body: String(row.body),
    inputDescription: String(row.input_description),
    outputDescription: String(row.output_description),
    templateCode: String(row.template_code),
    hints: String(row.hints),
    status: row.status === "published" ? "published" : "draft",
    samples: samplesOf(row.id),
    choices: choicesOf(row.id, reveal),
    hiddenTests: reveal ? hiddenTestsOf(row.id) : [],
    hiddenTestCount: hiddenTestCount(String(row.id)),
    sqlParts: sqlPartsOf(row.id, reveal),
    setupSql: reveal ? String(row.setup_sql ?? "") : "",
    webExpect: reveal ? String(row.web_expect ?? "") : "",
    timeMinutes: Number(row.time_minutes ?? 0),
    lockCopy: Number(row.lock_copy ?? 0) === 1,
    lockPaste: Number(row.lock_paste ?? 0) === 1,
    moduleKey: info.key,
    moduleLabel: info.label,
    kind: info.kind,
  };
}

function slugBase(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "question";
}

function uniqueSlug(collegeId: string, title: string) {
  const base = slugBase(title);
  for (let index = 0; index < 1000; index += 1) {
    const candidate = index === 0 ? base : `${base.slice(0, 56)}-${index + 1}`;
    const taken = getDb().prepare(`SELECT id FROM practice_questions WHERE college_id = ? AND slug = ?`).get(collegeId, candidate);
    if (!taken) return candidate;
  }
  throw new ValidationError("Could not create a unique question link.");
}

function scoreOf(value: unknown) {
  const score = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new ValidationError("Difficulty score must be between 0 and 1.");
  }
  return Math.round(score * 100) / 100;
}

function readSamples(value: unknown): QuestionSample[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const input = text(record.input ?? "", "Sample input", 4000);
    const output = text(record.output ?? "", "Sample output", 4000);
    if (!input && !output) return [];
    return [{ input, output }];
  });
}

function readHidden(value: unknown): QuestionSample[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const input = text(record.input ?? "", "Hidden input", 4000);
    const output = text(record.output ?? "", "Hidden output", 4000);
    if (!output) return [];
    return [{ input, output }];
  });
}

function readSqlParts(value: unknown): SqlPart[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const prompt = text(record.prompt ?? "", "Task", 2000);
    const checkSql = text(record.checkSql ?? "", "Check query", 4000);
    if (!prompt && !checkSql) return [];
    const mode = record.mode === "change" ? "change" : "read";
    if (checkSql) assertStaffSql(checkSql, "Check query");
    return [{ prompt, mode, checkSql }];
  });
}

function readChoices(value: unknown): QuestionChoice[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const choice = text(record.text ?? "", "Choice", 300);
    if (!choice) return [];
    return [{ text: choice, correct: record.correct === true }];
  });
}

function replaceChildren(
  questionId: string,
  samples: QuestionSample[],
  choices: QuestionChoice[],
  hiddenTests: QuestionSample[],
  sqlParts: SqlPart[],
) {
  const db = getDb();
  db.prepare(`DELETE FROM practice_samples WHERE question_id = ?`).run(questionId);
  db.prepare(`DELETE FROM practice_choices WHERE question_id = ?`).run(questionId);
  db.prepare(`DELETE FROM practice_hidden_tests WHERE question_id = ?`).run(questionId);
  db.prepare(`DELETE FROM practice_sql_parts WHERE question_id = ?`).run(questionId);
  const insertSample = db.prepare(
    `INSERT INTO practice_samples (id, question_id, input_text, output_text, sort_order) VALUES (?, ?, ?, ?, ?)`,
  );
  samples.forEach((sample, index) => insertSample.run(crypto.randomUUID(), questionId, sample.input, sample.output, index));
  const insertChoice = db.prepare(
    `INSERT INTO practice_choices (id, question_id, choice_text, is_correct, sort_order) VALUES (?, ?, ?, ?, ?)`,
  );
  choices.forEach((choice, index) => insertChoice.run(crypto.randomUUID(), questionId, choice.text, choice.correct ? 1 : 0, index));
  const insertHidden = db.prepare(
    `INSERT INTO practice_hidden_tests (id, question_id, input_text, output_text, sort_order) VALUES (?, ?, ?, ?, ?)`,
  );
  hiddenTests.forEach((test, index) => insertHidden.run(crypto.randomUUID(), questionId, test.input, test.output, index));
  const insertPart = db.prepare(
    `INSERT INTO practice_sql_parts (id, question_id, prompt, mode, check_sql, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  sqlParts.forEach((part, index) => insertPart.run(crypto.randomUUID(), questionId, part.prompt, part.mode, part.checkSql, index));
}

function assertPublishable(
  moduleKey: string,
  kind: PracticeModuleKind,
  body: string,
  samples: QuestionSample[],
  choices: QuestionChoice[],
  hiddenTests: QuestionSample[],
  sqlParts: SqlPart[],
  webExpect: string,
) {
  if (!body) throw new ValidationError("Add the question before publishing.");
  if (kind === "choice") {
    if (choices.length < 2) throw new ValidationError("Add at least two choices before publishing.");
    if (choices.filter((choice) => choice.correct).length !== 1) {
      throw new ValidationError("Mark one correct choice before publishing.");
    }
    return;
  }
  if (moduleKey === "web") {
    if (!webExpect) throw new ValidationError("Add the expected text before publishing.");
    return;
  }
  if (moduleKey === "sql") {
    if (!sqlParts.some((part) => part.prompt && part.checkSql)) {
      throw new ValidationError("Add a task and its check query before publishing.");
    }
    return;
  }
  if (!samples.some((sample) => sample.input && sample.output)) {
    throw new ValidationError("Add a sample input and sample output before publishing.");
  }
  if (!hiddenTests.some((test) => test.output)) {
    throw new ValidationError("Add a hidden test before publishing.");
  }
}

export function importQuestions(user: PracticeViewer, collegeId: string, moduleKey: string, source: string) {
  collegeOrThrow(user, collegeId);
  if (!canEdit(user)) throw new ValidationError("You cannot import questions.");
  moduleInfo(moduleKey);
  let rows;
  try {
    rows = questionsFromCsv(moduleKey, source);
  } catch (error) {
    if (error instanceof ImportError) throw new ValidationError(error.message);
    throw error;
  }
  const db = getDb();
  db.exec("BEGIN");
  try {
    rows.forEach((row) => {
      try {
        saveQuestion(user, collegeId, moduleKey, null, row.input);
      } catch (error) {
        if (!(error instanceof ValidationError)) throw error;
        throw new ValidationError(`Row ${row.line}: ${error.message}`);
      }
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return rows.length;
}

export function saveQuestion(user: PracticeViewer, collegeId: string, moduleKey: string, questionId: string | null, input: unknown) {
  collegeOrThrow(user, collegeId);
  if (!canEdit(user)) throw new ValidationError("You cannot edit questions.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ValidationError("Question details are missing.");
  const record = input as Record<string, unknown>;
  const title = text(record.title, "Question name", 160, true);
  const score = scoreOf(record.difficultyScore ?? 0);
  const body = text(record.body ?? "", "Question", 8000);
  const info = moduleInfo(moduleKey);
  const inputDescription = info.kind === "code" ? text(record.inputDescription ?? "", "Input description", 2000) : "";
  const outputDescription = info.kind === "code" ? text(record.outputDescription ?? "", "Output description", 2000) : "";
  const templateCode = info.kind === "code" ? text(record.templateCode ?? "", "Starter code", 8000) : "";
  const hints = text(record.hints ?? "", "Hints", 4000);
  const samples = info.key === "coding" ? readSamples(record.samples) : [];
  const choices = info.kind === "choice" ? readChoices(record.choices) : [];
  const hiddenTests = info.key === "coding" ? readHidden(record.hiddenTests) : [];
  const sqlParts = info.key === "sql" ? readSqlParts(record.sqlParts) : [];
  const setupSql = info.key === "sql" ? text(record.setupSql ?? "", "Setup SQL", 8000) : "";
  const webExpect = info.key === "web" ? text(record.webExpect ?? "", "Expected text", 500) : "";
  const timeMinutes = minutesOf(record.timeMinutes ?? 0);
  const lockCopy = flagOf(record.lockCopy);
  const lockPaste = flagOf(record.lockPaste);
  if (setupSql) assertStaffSql(setupSql, "Setup SQL");
  const wantPublish = user.role === "main_admin" && record.publish === true;
  if (wantPublish) assertPublishable(info.key, info.kind, body, samples, choices, hiddenTests, sqlParts, webExpect);

  const stamp = now();
  if (!questionId) {
    const module = moduleRow(collegeId, info.key);
    const id = crypto.randomUUID();
    getDb()
      .prepare(
        `INSERT INTO practice_questions (
           id, college_id, module_id, title, slug, difficulty_score, body, input_description, output_description,
           template_code, hints, status, created_by, published_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        collegeId,
        module.id,
        title,
        uniqueSlug(collegeId, title),
        score,
        body,
        inputDescription,
        outputDescription,
        templateCode,
        hints,
        wantPublish ? "published" : "draft",
        user.id,
        wantPublish ? stamp : "",
        stamp,
        stamp,
      );
    getDb().prepare(`UPDATE practice_questions SET setup_sql = ?, web_expect = ?, time_minutes = ?, lock_copy = ?, lock_paste = ? WHERE id = ?`).run(
      setupSql,
      webExpect,
      timeMinutes,
      lockCopy,
      lockPaste,
      id,
    );
    replaceChildren(id, samples, choices, hiddenTests, sqlParts);
    return id;
  }

  const existing = getDb()
    .prepare(
      `SELECT q.id, q.status, m.module_key
       FROM practice_questions q
       JOIN practice_modules m ON m.id = q.module_id
       WHERE q.id = ? AND q.college_id = ?`,
    )
    .get(questionId, collegeId) as { id: string; status: string; module_key: string } | undefined;
  if (!existing) throw new ValidationError("That question is no longer on file.");
  if (existing.module_key !== info.key) throw new ValidationError("That question belongs to a different module.");
  if (user.role === "employee" && existing.status === "published") {
    throw new ValidationError("Published questions can be changed by the main admin.");
  }
  const status = wantPublish ? "published" : existing.status === "published" && user.role === "main_admin" ? "published" : "draft";
  getDb()
    .prepare(
      `UPDATE practice_questions
       SET title = ?, difficulty_score = ?, body = ?, input_description = ?, output_description = ?,
           template_code = ?, hints = ?, status = ?, published_at = CASE WHEN ? = 'published' AND published_at = '' THEN ? ELSE published_at END,
           updated_at = ?
       WHERE id = ?`,
    )
    .run(title, score, body, inputDescription, outputDescription, templateCode, hints, status, status, stamp, stamp, existing.id);
  getDb().prepare(`UPDATE practice_questions SET setup_sql = ?, web_expect = ?, time_minutes = ?, lock_copy = ?, lock_paste = ? WHERE id = ?`).run(
    setupSql,
    webExpect,
    timeMinutes,
    lockCopy,
    lockPaste,
    existing.id,
  );
  replaceChildren(existing.id, samples, choices, hiddenTests, sqlParts);
  return existing.id;
}

export function setPublished(user: PracticeViewer, collegeId: string, questionId: string, published: boolean) {
  if (user.role !== "main_admin") throw new ValidationError("Only the main admin can publish a question.");
  collegeOrThrow(user, collegeId);
  const question = getQuestion(user, collegeId, questionId);
  if (!question) throw new ValidationError("That question is no longer on file.");
  if (published) {
    assertPublishable(
      question.moduleKey,
      question.kind,
      question.body,
      question.samples,
      question.choices,
      question.hiddenTests,
      question.sqlParts,
      question.webExpect,
    );
  }
  const stamp = now();
  getDb()
    .prepare(
      `UPDATE practice_questions
       SET status = ?, published_at = CASE WHEN ? = 'published' THEN ? ELSE '' END, updated_at = ?
       WHERE id = ? AND college_id = ?`,
    )
    .run(published ? "published" : "draft", published ? "published" : "draft", stamp, stamp, questionId, collegeId);
}

export function copyQuestion(sourceCollegeId: string, questionId: string, targetCollegeId: string) {
  if (sourceCollegeId === targetCollegeId) throw new ValidationError("Choose a different college for the copy.");
  const source = getDb()
    .prepare(
      `SELECT q.title, q.difficulty_score, q.body, q.input_description, q.output_description, q.template_code, q.hints,
              q.setup_sql, q.web_expect, q.time_minutes, q.lock_copy, q.lock_paste, m.module_key
       FROM practice_questions q
       JOIN practice_modules m ON m.id = q.module_id
       WHERE q.id = ? AND q.college_id = ?`,
    )
    .get(questionId, sourceCollegeId) as
    | {
        title: string;
        difficulty_score: number;
        body: string;
        input_description: string;
        output_description: string;
        template_code: string;
        hints: string;
        setup_sql: string;
        web_expect: string;
        time_minutes: number;
        lock_copy: number;
        lock_paste: number;
        module_key: string;
      }
    | undefined;
  if (!source) throw new ValidationError("That question is no longer on file.");
  const target = getDb().prepare(`SELECT college_id FROM practice_colleges WHERE college_id = ?`).get(targetCollegeId);
  if (!target) throw new ValidationError("Choose a college that is on InfySkill Practice.");
  enableModule(targetCollegeId, source.module_key);
  const module = moduleRow(targetCollegeId, source.module_key);
  const id = crypto.randomUUID();
  const stamp = now();
  getDb()
    .prepare(
      `INSERT INTO practice_questions (
         id, college_id, module_id, title, slug, difficulty_score, body, input_description, output_description,
         template_code, hints, status, created_by, published_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', '', '', ?, ?)`,
    )
    .run(
      id,
      targetCollegeId,
      module.id,
      source.title,
      uniqueSlug(targetCollegeId, source.title),
      source.difficulty_score,
      source.body,
      source.input_description,
      source.output_description,
      source.template_code,
      source.hints,
      stamp,
      stamp,
    );
  getDb()
    .prepare(`UPDATE practice_questions SET setup_sql = ?, web_expect = ?, time_minutes = ?, lock_copy = ?, lock_paste = ? WHERE id = ?`)
    .run(source.setup_sql, source.web_expect, Number(source.time_minutes ?? 0), Number(source.lock_copy ?? 0), Number(source.lock_paste ?? 0), id);
  replaceChildren(id, samplesOf(questionId), choicesOf(questionId, true), hiddenTestsOf(questionId), sqlPartsOf(questionId, true));
  return id;
}

export function copyTargets(user: PracticeViewer, collegeId: string) {
  if (user.role !== "main_admin") return [];
  return listPracticeColleges(user)
    .filter((college) => college.id !== collegeId)
    .map((college) => ({ id: college.id, name: college.name }));
}
