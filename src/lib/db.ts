import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

const globalForDb = globalThis as unknown as { crmDb?: DatabaseSync; crmDbPath?: string };

function databaseFile() {
  const root = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "infyskill-edutech-crm")
    : path.join(process.cwd(), "data");
  fs.mkdirSync(root, { recursive: true });
  return path.join(root, "crm.sqlite");
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
  `);

  const programColumns = database.prepare(`PRAGMA table_info(college_programs)`).all() as { name: string }[];
  if (programColumns.length > 0 && !programColumns.some((column) => column.name === "custom_json")) {
    database.exec(`ALTER TABLE college_programs ADD COLUMN custom_json TEXT NOT NULL DEFAULT '{}'`);
  }

  const quotationColumns = database.prepare(`PRAGMA table_info(quotations)`).all() as { name: string }[];
  if (quotationColumns.length > 0 && !quotationColumns.some((column) => column.name === "body_json")) {
    database.exec(`ALTER TABLE quotations ADD COLUMN body_json TEXT NOT NULL DEFAULT '{}'`);
  }
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
