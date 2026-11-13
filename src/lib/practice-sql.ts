import { DatabaseSync } from "node:sqlite";
import { ValidationError } from "@/lib/colleges";

export type SqlPart = { prompt: string; mode: "read" | "change"; checkSql: string };

const ROW_LIMIT = 50;

function blocked(sql: string) {
  return /\b(attach|detach|pragma|vacuum|reindex|load_extension)\b/i.test(sql);
}

export function assertStaffSql(sql: string, label: string) {
  if (blocked(sql)) throw new ValidationError(`${label} cannot use that statement.`);
}

function oneStatement(sql: string) {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  if (!trimmed) return "";
  let quote = "";
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === ";") return "";
  }
  return trimmed;
}

function pack(rows: Record<string, unknown>[]) {
  return JSON.stringify(
    rows.map((row) =>
      Object.entries(row)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, typeof value === "bigint" ? value.toString() : value]),
    ),
  );
}

function query(db: DatabaseSync, sql: string) {
  const rows = db.prepare(sql).all() as Record<string, unknown>[];
  if (rows.length > ROW_LIMIT) throw new Error("That query returned too many rows.");
  return rows;
}

function fresh(setupSql: string) {
  const db = new DatabaseSync(":memory:");
  if (setupSql.trim()) db.exec(setupSql);
  return db;
}

export function previewSql(setupSql: string, answers: string[]) {
  const lines: string[] = [];
  answers.forEach((answer, index) => {
    const statement = oneStatement(answer);
    const label = `Task ${index + 1}`;
    if (!statement) {
      lines.push(`${label}: write one SQL statement.`);
      return;
    }
    if (blocked(statement)) {
      lines.push(`${label}: that statement is not allowed.`);
      return;
    }
    const db = fresh(setupSql);
    try {
      if (/^(select|with)\b/i.test(statement)) {
        const rows = query(db, statement);
        lines.push(`${label}: ${rows.length} row${rows.length === 1 ? "" : "s"}.`);
        lines.push(rows.length ? JSON.stringify(rows.slice(0, 5), null, 2) : "No rows.");
      } else {
        db.exec(statement);
        lines.push(`${label}: statement ran.`);
      }
    } catch (error) {
      lines.push(`${label}: ${error instanceof Error ? error.message : "The statement failed."}`);
    } finally {
      db.close();
    }
  });
  return lines.join("\n");
}

export function gradeSql(setupSql: string, parts: SqlPart[], answers: string[]) {
  const notes: string[] = [];
  let passed = 0;
  parts.forEach((part, index) => {
    const statement = oneStatement(answers[index] ?? "");
    const label = `Task ${index + 1}`;
    if (!statement || blocked(statement) || blocked(part.checkSql)) {
      notes.push(`${label} was not accepted.`);
      return;
    }
    try {
      if (part.mode === "read") {
        if (!/^(select|with)\b/i.test(statement)) {
          notes.push(`${label} needs a SELECT.`);
          return;
        }
        const expectedDb = fresh(setupSql);
        const actualDb = fresh(setupSql);
        try {
          const expected = pack(query(expectedDb, part.checkSql));
          const actual = pack(query(actualDb, statement));
          if (actual !== expected) {
            notes.push(`${label} did not match.`);
            return;
          }
        } finally {
          expectedDb.close();
          actualDb.close();
        }
      } else {
        const db = fresh(setupSql);
        try {
          db.exec(statement);
          const rows = query(db, part.checkSql);
          const value = rows[0] ? Object.values(rows[0])[0] : null;
          if (String(value) !== "1") {
            notes.push(`${label} did not match.`);
            return;
          }
        } finally {
          db.close();
        }
      }
      passed += 1;
    } catch {
      notes.push(`${label} did not match.`);
    }
  });
  const solved = parts.length > 0 && passed === parts.length;
  return {
    solved,
    message: solved ? "Correct." : notes[0] || "Not correct.",
  };
}
