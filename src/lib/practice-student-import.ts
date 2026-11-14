export class StudentImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudentImportError";
  }
}

export type StudentImportRow = {
  line: number;
  input: {
    fullName: string;
    email: string;
    rollNumber: string;
    department: string;
    studyYear: string;
    password: string;
  };
};

const MAX_ROWS = 500;
const MAX_CHARS = 500_000;

const ALIASES: Record<string, string> = {
  name: "name",
  student: "name",
  studentname: "name",
  fullname: "name",
  email: "email",
  mail: "email",
  roll: "roll",
  rollnumber: "roll",
  rollno: "roll",
  regno: "roll",
  department: "department",
  dept: "department",
  branch: "department",
  year: "year",
  studyyear: "year",
  class: "year",
  password: "password",
  pass: "password",
};

const REQUIRED = ["name", "email", "roll", "department", "year", "password"];

export function studentTemplateCsv() {
  return [
    "name,email,roll,department,year,password",
    "Asha Kumar,asha@college.edu,21CSE001,CSE,2,StudentPass1",
  ].join("\n");
}

export function studentsFromCsv(source: string): StudentImportRow[] {
  if (typeof source !== "string" || !source.trim()) throw new StudentImportError("The file has no students.");
  if (source.length > MAX_CHARS) throw new StudentImportError("This file is too large. Split it into files of 500 students.");
  const table = parseCsv(source);
  if (table.length === 0) throw new StudentImportError("The file has no students.");
  const columns = headers(table[0].cells);
  const rows = table.slice(1).filter((row) => row.cells.some((cell) => cell.trim()));
  if (rows.length === 0) throw new StudentImportError("The file has no students.");
  if (rows.length > MAX_ROWS) throw new StudentImportError("Upload up to 500 students at a time.");
  const emails = new Set<string>();
  const rolls = new Set<string>();
  return rows.map((row) => {
    const record = recordFrom(columns, row.cells);
    const input = studentFrom(record, row.line);
    const email = input.email.toLowerCase();
    const roll = input.rollNumber.toLowerCase();
    if (emails.has(email)) throw new StudentImportError(`Row ${row.line}: That email is repeated in this file.`);
    if (rolls.has(roll)) throw new StudentImportError(`Row ${row.line}: That roll number is repeated in this file.`);
    emails.add(email);
    rolls.add(roll);
    return { line: row.line, input };
  });
}

function studentFrom(record: Record<string, string>, line: number): StudentImportRow["input"] {
  const fullName = (record.name ?? "").trim();
  const email = (record.email ?? "").trim().toLowerCase();
  const rollNumber = (record.roll ?? "").trim();
  const department = (record.department ?? "").trim();
  const studyYear = (record.year ?? "").trim();
  const password = (record.password ?? "").trim();
  if (!fullName) throw new StudentImportError(`Row ${line}: Student name is required.`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new StudentImportError(`Row ${line}: Email must be a valid address.`);
  if (!rollNumber) throw new StudentImportError(`Row ${line}: Roll number is required.`);
  if (!department) throw new StudentImportError(`Row ${line}: Department is required.`);
  if (!studyYear) throw new StudentImportError(`Row ${line}: Year is required.`);
  if (password.length < 8) throw new StudentImportError(`Row ${line}: Password must be at least 8 characters.`);
  return { fullName, email, rollNumber, department, studyYear, password };
}

function headers(cells: string[]) {
  const columns: { key: string; index: number }[] = [];
  const seen = new Set<string>();
  cells.forEach((cell, index) => {
    const name = cell.trim().toLowerCase().replace(/[\s_]+/g, "");
    if (!name) return;
    const key = ALIASES[name];
    if (!key) return;
    if (seen.has(key)) throw new StudentImportError(`The column ${cell.trim()} is repeated.`);
    seen.add(key);
    columns.push({ key, index });
  });
  const missing = REQUIRED.filter((key) => !seen.has(key));
  if (missing.length > 0) throw new StudentImportError("This file needs these columns: name, email, roll, department, year, password.");
  return columns;
}

function recordFrom(columns: { key: string; index: number }[], cells: string[]) {
  const record: Record<string, string> = {};
  columns.forEach((column) => {
    record[column.key] = cells[column.index] ?? "";
  });
  return record;
}

function parseCsv(source: string) {
  const text = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else {
        if (char === "\n") line += 1;
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(cell);
      cell = "";
    } else if (char === "\n") {
      cells.push(cell);
      rows.push({ line: rowLine, cells });
      cells = [];
      cell = "";
      line += 1;
      rowLine = line;
    } else cell += char;
  }
  if (cell.length > 0 || cells.length > 0) {
    cells.push(cell);
    rows.push({ line, cells });
  }
  if (quoted) throw new StudentImportError("A quoted cell was left open.");
  return rows.filter((row) => row.cells.some((value) => value.trim()));
}
