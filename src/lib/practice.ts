import { createCollege, ValidationError } from "@/lib/colleges";
import { getDb } from "@/lib/db";
import { assertStudentSeats } from "@/lib/practice-access";
import { hashPassword, localAdminLogin, verifyPassword, type PracticeRole, type PracticeViewer } from "@/lib/practice-auth";
import { RESERVED_SLUGS } from "@/lib/practice-host";
import { StudentImportError, studentsFromCsv } from "@/lib/practice-student-import";

export { ValidationError };

export type PracticeCollegeSummary = {
  id: string;
  name: string;
  studentCount: number;
  collegeAdminCount: number;
  employeeCount: number;
  hasLogo: boolean;
  logoAt: string;
  webSlug: string;
};

export type PracticePerson = {
  id: string;
  fullName: string;
  email: string;
  rollNumber: string;
  department: string;
  studyYear: string;
};

export type PracticeEmployee = PracticePerson & {
  colleges: { id: string; name: string }[];
};

type UserRow = {
  id: string;
  role: string;
  full_name: string;
  email: string;
  password_hash: string;
  roll_number: string;
  department: string;
  study_year: string;
  status: string;
};

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

function emailOf(value: unknown) {
  const email = text(value, "Email", 160, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError("Email must be a valid address.");
  return email;
}

function passwordOf(value: unknown) {
  const password = text(value, "Password", 80, true);
  if (password.length < 8) throw new ValidationError("Password must be at least 8 characters.");
  return password;
}

function userByEmail(email: string) {
  return getDb().prepare(`SELECT * FROM practice_users WHERE email = ?`).get(email) as UserRow | undefined;
}

export function ensureMainAdmin() {
  const login = localAdminLogin();
  const existing = userByEmail(login.email);
  if (existing) return;
  const stamp = now();
  getDb()
    .prepare(
      `INSERT INTO practice_users (
         id, role, full_name, email, password_hash, roll_number, department, study_year, status, created_at, updated_at
       ) VALUES (?, 'main_admin', 'Main admin', ?, ?, '', '', '', 'active', ?, ?)`,
    )
    .run(crypto.randomUUID(), login.email, hashPassword(login.password), stamp, stamp);
}

function assertPracticeCollege(collegeId: string) {
  const row = getDb()
    .prepare(
      `SELECT c.id, c.name
       FROM practice_colleges p
       JOIN colleges c ON c.id = p.college_id
       WHERE p.college_id = ?`,
    )
    .get(collegeId) as { id: string; name: string } | undefined;
  if (!row) throw new ValidationError("That college is not on InfySkill Practice.");
  return row;
}

export function listPracticeColleges(user: PracticeViewer): PracticeCollegeSummary[] {
  const scoped = user.role === "main_admin" ? "" : "JOIN practice_memberships mine ON mine.college_id = c.id AND mine.user_id = ?";
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.name, p.logo_kind, p.logo_at, p.web_slug,
         (SELECT COUNT(*) FROM practice_memberships m JOIN practice_users u ON u.id = m.user_id WHERE m.college_id = c.id AND u.role = 'student') AS student_count,
         (SELECT COUNT(*) FROM practice_memberships m JOIN practice_users u ON u.id = m.user_id WHERE m.college_id = c.id AND u.role = 'college_admin') AS admin_count,
         (SELECT COUNT(*) FROM practice_memberships m JOIN practice_users u ON u.id = m.user_id WHERE m.college_id = c.id AND u.role = 'employee') AS employee_count
       FROM practice_colleges p
       JOIN colleges c ON c.id = p.college_id
       ${scoped}
       ORDER BY c.name COLLATE NOCASE`,
    )
    .all(...(user.role === "main_admin" ? [] : [user.id])) as {
    id: string;
    name: string;
    logo_kind: string;
    logo_at: string;
    web_slug: string;
    student_count: number;
    admin_count: number;
    employee_count: number;
  }[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    studentCount: row.student_count,
    collegeAdminCount: row.admin_count,
    employeeCount: row.employee_count,
    hasLogo: row.logo_kind.length > 0,
    logoAt: row.logo_at,
    webSlug: row.web_slug,
  }));
}

export function setPracticeWebAddress(collegeId: string, input: unknown) {
  assertPracticeCollege(collegeId);
  const raw = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (!raw) {
    getDb().prepare(`UPDATE practice_colleges SET web_slug = '' WHERE college_id = ?`).run(collegeId);
    return "";
  }
  if (!/^[a-z][a-z0-9-]{0,30}[a-z0-9]$/.test(raw)) {
    throw new ValidationError("Use 2 to 32 characters: letters, numbers, and hyphens, starting with a letter.");
  }
  if (RESERVED_SLUGS.has(raw)) throw new ValidationError("That web address is reserved.");
  const taken = getDb()
    .prepare(`SELECT college_id FROM practice_colleges WHERE web_slug = ? AND college_id <> ?`)
    .get(raw, collegeId);
  if (taken) throw new ValidationError("Another college already uses that web address.");
  getDb().prepare(`UPDATE practice_colleges SET web_slug = ? WHERE college_id = ?`).run(raw, collegeId);
  return raw;
}

export function getPracticeCollege(user: PracticeViewer, collegeId: string): PracticeCollegeSummary | null {
  return listPracticeColleges(user).find((college) => college.id === collegeId) ?? null;
}

export function createPracticeCollege(nameInput: unknown) {
  const name = text(nameInput, "College name", 160, true);
  const duplicate = getDb()
    .prepare(
      `SELECT c.id
       FROM practice_colleges p
       JOIN colleges c ON c.id = p.college_id
       WHERE lower(c.name) = lower(?)`,
    )
    .get(name) as { id: string } | undefined;
  if (duplicate) throw new ValidationError("That college is already on InfySkill Practice.");
  const id = createCollege({ name });
  getDb().prepare(`INSERT INTO practice_colleges (college_id, created_at) VALUES (?, ?)`).run(id, now());
  return id;
}

function people(collegeId: string, role: PracticeRole): PracticePerson[] {
  const rows = getDb()
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.roll_number, u.department, u.study_year
       FROM practice_memberships m
       JOIN practice_users u ON u.id = m.user_id
       WHERE m.college_id = ? AND u.role = ?
       ORDER BY u.full_name COLLATE NOCASE`,
    )
    .all(collegeId, role) as {
    id: string;
    full_name: string;
    email: string;
    roll_number: string;
    department: string;
    study_year: string;
  }[];
  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    rollNumber: row.roll_number,
    department: row.department,
    studyYear: row.study_year,
  }));
}

export function listCollegeStudents(collegeId: string) {
  assertPracticeCollege(collegeId);
  return people(collegeId, "student");
}

export function listCollegeAdmins(collegeId: string) {
  assertPracticeCollege(collegeId);
  return people(collegeId, "college_admin");
}

export function listEmployees(): PracticeEmployee[] {
  const rows = getDb()
    .prepare(
      `SELECT id, full_name, email, roll_number, department, study_year
       FROM practice_users
       WHERE role = 'employee'
       ORDER BY full_name COLLATE NOCASE`,
    )
    .all() as {
    id: string;
    full_name: string;
    email: string;
    roll_number: string;
    department: string;
    study_year: string;
  }[];
  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    rollNumber: row.roll_number,
    department: row.department,
    studyYear: row.study_year,
    colleges: (
      getDb()
        .prepare(
          `SELECT c.id, c.name
           FROM practice_memberships m
           JOIN colleges c ON c.id = m.college_id
           WHERE m.user_id = ?
           ORDER BY c.name COLLATE NOCASE`,
        )
        .all(row.id) as { id: string; name: string }[]
    ).map((college) => ({ id: String(college.id), name: String(college.name) })),
  }));
}

function insertUser(role: PracticeRole, fullName: string, email: string, password: string, extra?: { rollNumber: string; department: string; studyYear: string }) {
  if (userByEmail(email)) throw new ValidationError("That email is already used. Each person signs in with one email.");
  const id = crypto.randomUUID();
  const stamp = now();
  getDb()
    .prepare(
      `INSERT INTO practice_users (
         id, role, full_name, email, password_hash, roll_number, department, study_year, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    )
    .run(
      id,
      role,
      fullName,
      email,
      hashPassword(password),
      extra?.rollNumber ?? "",
      extra?.department ?? "",
      extra?.studyYear ?? "",
      stamp,
      stamp,
    );
  return id;
}

function grant(userId: string, collegeId: string) {
  getDb()
    .prepare(`INSERT OR IGNORE INTO practice_memberships (user_id, college_id, created_at) VALUES (?, ?, ?)`)
    .run(userId, collegeId, now());
}

export function addStudent(collegeId: string, input: unknown) {
  assertPracticeCollege(collegeId);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ValidationError("Student details are missing.");
  const record = input as Record<string, unknown>;
  const fullName = text(record.fullName, "Student name", 120, true);
  const email = emailOf(record.email);
  const rollNumber = text(record.rollNumber, "Roll number", 40, true);
  const department = text(record.department, "Department", 80, true);
  const studyYear = text(record.studyYear, "Year", 20, true);
  const password = passwordOf(record.password);
  if (userByEmail(email)) throw new ValidationError("That email is already used.");
  const duplicateRoll = getDb()
    .prepare(
      `SELECT u.id
       FROM practice_memberships m
       JOIN practice_users u ON u.id = m.user_id
       WHERE m.college_id = ? AND u.role = 'student' AND lower(u.roll_number) = lower(?)`,
    )
    .get(collegeId, rollNumber);
  if (duplicateRoll) throw new ValidationError("That roll number is already used at this college.");
  const studentCount = getDb()
    .prepare(
      `SELECT COUNT(*) AS count
       FROM practice_memberships m
       JOIN practice_users u ON u.id = m.user_id
       WHERE m.college_id = ? AND u.role = 'student'`,
    )
    .get(collegeId) as { count: number };
  assertStudentSeats(collegeId, Number(studentCount.count ?? 0));
  const id = insertUser("student", fullName, email, password, { rollNumber, department, studyYear });
  grant(id, collegeId);
  return id;
}

export function importStudents(collegeId: string, source: string) {
  assertPracticeCollege(collegeId);
  let rows;
  try {
    rows = studentsFromCsv(source);
  } catch (error) {
    if (error instanceof StudentImportError) throw new ValidationError(error.message);
    throw error;
  }
  const db = getDb();
  db.exec("BEGIN");
  try {
    rows.forEach((row) => {
      try {
        addStudent(collegeId, row.input);
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

export function removeStudent(collegeId: string, userId: string) {
  assertPracticeCollege(collegeId);
  const row = getDb()
    .prepare(
      `SELECT u.id
       FROM practice_users u
       JOIN practice_memberships m ON m.user_id = u.id
       WHERE u.id = ? AND u.role = 'student' AND m.college_id = ?`,
    )
    .get(userId, collegeId);
  if (!row) throw new ValidationError("That student is not at this college.");
  getDb().prepare(`DELETE FROM practice_users WHERE id = ?`).run(userId);
}

export function addCollegeAdmin(collegeId: string, input: unknown) {
  assertPracticeCollege(collegeId);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ValidationError("College admin details are missing.");
  const record = input as Record<string, unknown>;
  const fullName = text(record.fullName, "Name", 120, true);
  const email = emailOf(record.email);
  const existing = userByEmail(email);
  if (existing) {
    if (existing.role !== "college_admin") {
      throw new ValidationError("That email belongs to a different kind of account.");
    }
    const already = getDb()
      .prepare(`SELECT 1 AS ok FROM practice_memberships WHERE user_id = ? AND college_id = ?`)
      .get(existing.id, collegeId);
    if (already) throw new ValidationError("This college admin already has access.");
    grant(existing.id, collegeId);
    return existing.id;
  }
  const password = passwordOf(record.password);
  const id = insertUser("college_admin", fullName, email, password);
  grant(id, collegeId);
  return id;
}

export function removeCollegeAdmin(collegeId: string, userId: string) {
  assertPracticeCollege(collegeId);
  const result = getDb()
    .prepare(
      `DELETE FROM practice_memberships
       WHERE college_id = ? AND user_id = ?
         AND user_id IN (SELECT id FROM practice_users WHERE role = 'college_admin')`,
    )
    .run(collegeId, userId);
  if (result.changes === 0) throw new ValidationError("That college admin does not have access.");
}

export function addEmployee(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ValidationError("Employee details are missing.");
  const record = input as Record<string, unknown>;
  const fullName = text(record.fullName, "Name", 120, true);
  const email = emailOf(record.email);
  const password = passwordOf(record.password);
  return insertUser("employee", fullName, email, password);
}

export function setEmployeeAccess(collegeId: string, userId: string, allowed: boolean) {
  assertPracticeCollege(collegeId);
  const employee = getDb().prepare(`SELECT id, role FROM practice_users WHERE id = ?`).get(userId) as { id: string; role: string } | undefined;
  if (!employee || employee.role !== "employee") throw new ValidationError("That employee could not be found.");
  if (allowed) grant(userId, collegeId);
  else getDb().prepare(`DELETE FROM practice_memberships WHERE user_id = ? AND college_id = ?`).run(userId, collegeId);
}

export function authenticate(emailInput: unknown, passwordInput: unknown) {
  const email = emailOf(emailInput);
  const password = typeof passwordInput === "string" ? passwordInput : "";
  const user = userByEmail(email);
  if (!user || user.status !== "active" || !verifyPassword(password, user.password_hash)) {
    throw new ValidationError("Email or password is incorrect.");
  }
  return user.id;
}
