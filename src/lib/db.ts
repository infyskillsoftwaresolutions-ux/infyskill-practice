import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

const globalForDb = globalThis as unknown as { crmDb?: DatabaseSync; crmDbPath?: string };

export function dataDirectory() {
  const root = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "infyskill-edutech-crm")
    : path.join(process.cwd(), "data");
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function databaseFile() {
  return path.join(dataDirectory(), "crm.sqlite");
}

function applySchema(database: DatabaseSync) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS field_definitions (
      id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      label TEXT NOT NULL,
      field_key TEXT NOT NULL,
      field_type TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 0,
      options_json TEXT NOT NULL DEFAULT '[]',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(module, field_key)
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      job_title TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      salary REAL NOT NULL,
      currency TEXT NOT NULL,
      pay_frequency TEXT NOT NULL,
      status TEXT NOT NULL,
      hired_on TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      custom_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      cost REAL NOT NULL,
      currency TEXT NOT NULL,
      spent_on TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      custom_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credits (
      id TEXT PRIMARY KEY,
      from_name TEXT NOT NULL,
      college_id TEXT NOT NULL DEFAULT '',
      invoice_id TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      received_on TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      custom_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS colleges (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      custom_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS college_programs (
      id TEXT PRIMARY KEY,
      college_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      custom_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invoice_settings (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      payment_details TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      college_id TEXT NOT NULL DEFAULT '',
      bill_to_name TEXT NOT NULL DEFAULT '',
      issued_on TEXT NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      custom_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoice_lines (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity REAL NOT NULL,
      rate REAL NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quotations (
      id TEXT PRIMARY KEY,
      quotation_number TEXT NOT NULL UNIQUE,
      college_id TEXT NOT NULL DEFAULT '',
      prepared_for TEXT NOT NULL DEFAULT '',
      issued_on TEXT NOT NULL,
      valid_until TEXT NOT NULL DEFAULT '',
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      custom_json TEXT NOT NULL DEFAULT '{}',
      body_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trainers (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      experience_years REAL,
      skills_json TEXT NOT NULL DEFAULT '[]',
      address TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      daily_budget REAL,
      weekly_budget REAL,
      monthly_budget REAL,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT NOT NULL DEFAULT '',
      custom_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quotation_lines (
      id TEXT PRIMARY KEY,
      quotation_id TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity REAL NOT NULL,
      rate REAL NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_colleges (
      college_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_users (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      roll_number TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      study_year TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS practice_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES practice_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_memberships (
      user_id TEXT NOT NULL,
      college_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, college_id),
      FOREIGN KEY (user_id) REFERENCES practice_users(id) ON DELETE CASCADE,
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_modules (
      id TEXT PRIMARY KEY,
      college_id TEXT NOT NULL,
      module_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (college_id, module_key),
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_questions (
      id TEXT PRIMARY KEY,
      college_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      difficulty_score REAL NOT NULL DEFAULT 0,
      body TEXT NOT NULL DEFAULT '',
      input_description TEXT NOT NULL DEFAULT '',
      output_description TEXT NOT NULL DEFAULT '',
      template_code TEXT NOT NULL DEFAULT '',
      hints TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT NOT NULL DEFAULT '',
      published_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (college_id, slug),
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (module_id) REFERENCES practice_modules(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_samples (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      input_text TEXT NOT NULL DEFAULT '',
      output_text TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (question_id) REFERENCES practice_questions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_choices (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      choice_text TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (question_id) REFERENCES practice_questions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_hidden_tests (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      input_text TEXT NOT NULL DEFAULT '',
      output_text TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (question_id) REFERENCES practice_questions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_sql_parts (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      prompt TEXT NOT NULL DEFAULT '',
      mode TEXT NOT NULL DEFAULT 'read',
      check_sql TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (question_id) REFERENCES practice_questions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_mocks (
      id TEXT PRIMARY KEY,
      college_id TEXT NOT NULL,
      title TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_mock_questions (
      mock_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (mock_id, question_id),
      FOREIGN KEY (mock_id) REFERENCES practice_mocks(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES practice_questions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_mock_sittings (
      id TEXT PRIMARY KEY,
      mock_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      UNIQUE (mock_id, user_id),
      FOREIGN KEY (mock_id) REFERENCES practice_mocks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES practice_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS practice_attempts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      answer_text TEXT NOT NULL DEFAULT '',
      language TEXT NOT NULL DEFAULT '',
      choice_id TEXT NOT NULL DEFAULT '',
      outcome TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES practice_users(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES practice_questions(id) ON DELETE CASCADE
    );
  `);

  const programColumns = database.prepare(`PRAGMA table_info(college_programs)`).all() as { name: string }[];
  if (programColumns.length > 0 && !programColumns.some((column) => column.name === "custom_json")) {
    database.exec(`ALTER TABLE college_programs ADD COLUMN custom_json TEXT NOT NULL DEFAULT '{}'`);
  }

  const quotationColumns = database.prepare(`PRAGMA table_info(quotations)`).all() as { name: string }[];
  if (quotationColumns.length > 0 && !quotationColumns.some((column) => column.name === "body_json")) {
    database.exec(`ALTER TABLE quotations ADD COLUMN body_json TEXT NOT NULL DEFAULT '{}'`);
  }

  const practiceCollegeColumns = database.prepare(`PRAGMA table_info(practice_colleges)`).all() as { name: string }[];
  if (practiceCollegeColumns.length > 0 && !practiceCollegeColumns.some((column) => column.name === "invoice_id")) {
    database.exec(`ALTER TABLE practice_colleges ADD COLUMN invoice_id TEXT NOT NULL DEFAULT ''`);
  }
  if (practiceCollegeColumns.length > 0 && !practiceCollegeColumns.some((column) => column.name === "logo_kind")) {
    database.exec(`ALTER TABLE practice_colleges ADD COLUMN logo_kind TEXT NOT NULL DEFAULT ''`);
  }
  if (practiceCollegeColumns.length > 0 && !practiceCollegeColumns.some((column) => column.name === "logo_at")) {
    database.exec(`ALTER TABLE practice_colleges ADD COLUMN logo_at TEXT NOT NULL DEFAULT ''`);
  }
  if (practiceCollegeColumns.length > 0 && !practiceCollegeColumns.some((column) => column.name === "access_ends_on")) {
    database.exec(`ALTER TABLE practice_colleges ADD COLUMN access_ends_on TEXT NOT NULL DEFAULT ''`);
  }
  if (practiceCollegeColumns.length > 0 && !practiceCollegeColumns.some((column) => column.name === "web_slug")) {
    database.exec(`ALTER TABLE practice_colleges ADD COLUMN web_slug TEXT NOT NULL DEFAULT ''`);
  }
  database.exec(`CREATE UNIQUE INDEX IF NOT EXISTS practice_college_web_slug ON practice_colleges(web_slug) WHERE web_slug <> ''`);

  const questionColumns = database.prepare(`PRAGMA table_info(practice_questions)`).all() as { name: string }[];
  if (questionColumns.length > 0 && !questionColumns.some((column) => column.name === "setup_sql")) {
    database.exec(`ALTER TABLE practice_questions ADD COLUMN setup_sql TEXT NOT NULL DEFAULT ''`);
  }
  if (questionColumns.length > 0 && !questionColumns.some((column) => column.name === "web_expect")) {
    database.exec(`ALTER TABLE practice_questions ADD COLUMN web_expect TEXT NOT NULL DEFAULT ''`);
  }
  if (questionColumns.length > 0 && !questionColumns.some((column) => column.name === "time_minutes")) {
    database.exec(`ALTER TABLE practice_questions ADD COLUMN time_minutes INTEGER NOT NULL DEFAULT 0`);
  }
  if (questionColumns.length > 0 && !questionColumns.some((column) => column.name === "lock_copy")) {
    database.exec(`ALTER TABLE practice_questions ADD COLUMN lock_copy INTEGER NOT NULL DEFAULT 0`);
  }
  if (questionColumns.length > 0 && !questionColumns.some((column) => column.name === "lock_paste")) {
    database.exec(`ALTER TABLE practice_questions ADD COLUMN lock_paste INTEGER NOT NULL DEFAULT 0`);
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS practice_question_clocks (
      user_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      PRIMARY KEY (user_id, question_id),
      FOREIGN KEY (user_id) REFERENCES practice_users(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES practice_questions(id) ON DELETE CASCADE
    );
  `);
}

export function getDb() {
  const file = databaseFile();
  if (!globalForDb.crmDb || globalForDb.crmDbPath !== file) {
    globalForDb.crmDb?.close();
    globalForDb.crmDb = new DatabaseSync(file);
    globalForDb.crmDbPath = file;
  }
  applySchema(globalForDb.crmDb);
  return globalForDb.crmDb;
}
