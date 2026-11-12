import { getDb } from "@/lib/db";
import type {
  CurrencyCode,
  CustomValue,
  Employee,
  EmployeeInput,
  EmployeeStatus,
  FieldDefinition,
  FieldInput,
  FieldType,
  FieldUpdate,
  PayFrequency,
} from "@/lib/payroll-types";
import {
  CURRENCIES,
  EMPLOYEE_STATUSES,
  FIELD_TYPES,
  PAY_FREQUENCIES,
} from "@/lib/payroll-types";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

type FieldRow = {
  id: string;
  module: string;
  label: string;
  field_key: string;
  field_type: string;
  required: number;
  options_json: string;
  sort_order: number;
};

type EmployeeRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  job_title: string;
  department: string;
  salary: number;
  currency: string;
  pay_frequency: string;
  status: string;
  hired_on: string;
  notes: string;
  custom_json: string;
  created_at: string;
  updated_at: string;
};

function isFieldType(value: string): value is FieldType {
  return (FIELD_TYPES as readonly string[]).includes(value);
}

function isPayFrequency(value: string): value is PayFrequency {
  return (PAY_FREQUENCIES as readonly string[]).includes(value);
}

function isStatus(value: string): value is EmployeeStatus {
  return (EMPLOYEE_STATUSES as readonly string[]).includes(value);
}

function isCurrency(value: string): value is CurrencyCode {
  return (CURRENCIES as readonly string[]).includes(value);
}

function parseOptions(json: string) {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function toField(row: FieldRow): FieldDefinition {
  const type = isFieldType(row.field_type) ? row.field_type : "text";
  return {
    id: row.id,
    module: "payroll",
    label: row.label,
    key: row.field_key,
    type,
    required: row.required === 1,
    options: parseOptions(row.options_json),
    sortOrder: row.sort_order,
  };
}

function parseCustom(json: string): Record<string, CustomValue> {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: Record<string, CustomValue> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    jobTitle: row.job_title,
    department: row.department,
    salary: row.salary,
    currency: isCurrency(row.currency) ? row.currency : "INR",
    payFrequency: isPayFrequency(row.pay_frequency) ? row.pay_frequency : "monthly",
    status: isStatus(row.status) ? row.status : "active",
    hiredOn: row.hired_on,
    notes: row.notes,
    customFields: parseCustom(row.custom_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function text(value: unknown, label: string, max: number, required = false) {
  if (typeof value !== "string") {
    throw new ValidationError(`${label} needs to be text.`);
  }
  const trimmed = value.trim();
  if (required && !trimmed) throw new ValidationError(`${label} is required.`);
  if (trimmed.length > max) {
    throw new ValidationError(`${label} must be ${max} characters or fewer.`);
  }
  return trimmed;
}

function cleanOptions(options: unknown) {
  if (!Array.isArray(options)) {
    throw new ValidationError("Choice list options are missing.");
  }
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const option of options) {
    if (typeof option !== "string") {
      throw new ValidationError("Each choice must be text.");
    }
    const value = option.trim();
    if (!value) continue;
    if (value.length > 80) {
      throw new ValidationError("Each choice must be 80 characters or fewer.");
    }
    const marker = value.toLowerCase();
    if (seen.has(marker)) continue;
    seen.add(marker);
    cleaned.push(value);
  }
  if (cleaned.length > 30) {
    throw new ValidationError("A choice list can have up to 30 options.");
  }
  return cleaned;
}

function fieldKeyFromLabel(label: string) {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return slug || "field";
}

function uniqueFieldKey(base: string) {
  const database = getDb();
  const existing = new Set(
    database
      .prepare(`SELECT field_key FROM field_definitions WHERE module = 'payroll'`)
      .all()
      .map((row) => (row as { field_key: string }).field_key),
  );
  if (!existing.has(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base.slice(0, 36)}_${index}`;
    if (!existing.has(candidate)) return candidate;
  }
  throw new ValidationError("Could not create a unique field key.");
}

function readCustomValue(field: FieldDefinition, raw: unknown): CustomValue {
  if (field.type === "boolean") {
    const checked = raw === true || raw === "true" || raw === 1 || raw === "1";
    if (field.required && !checked) {
      throw new ValidationError(`${field.label} must be checked.`);
    }
    return checked;
  }

  const empty =
    raw === null ||
    raw === undefined ||
    (typeof raw === "string" && raw.trim() === "");

  if (empty) {
    if (field.required) throw new ValidationError(`${field.label} is required.`);
    return null;
  }

  if (field.type === "text") {
    return text(raw, field.label, 500, field.required);
  }

  if (field.type === "number") {
    const number = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(number)) {
      throw new ValidationError(`${field.label} must be a number.`);
    }
    return number;
  }

  if (field.type === "date") {
    const value = text(raw, field.label, 10, field.required);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new ValidationError(`${field.label} must be a valid date.`);
    }
    return value;
  }

  const choice = text(raw, field.label, 80, field.required);
  if (!field.options.includes(choice)) {
    throw new ValidationError(`${field.label} must be one of the listed choices.`);
  }
  return choice;
}

function normalizeEmployee(input: unknown, fields: FieldDefinition[]): EmployeeInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Employee details are missing.");
  }
  const record = input as Record<string, unknown>;
  const email = text(record.email ?? "", "Email", 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("Email needs a valid address.");
  }
  const phone = text(record.phone ?? "", "Phone", 40);
  if (phone && !/^[0-9+\-().\s]{6,40}$/.test(phone)) {
    throw new ValidationError("Phone can use digits, spaces, and + - ( ).");
  }
  const salary = typeof record.salary === "number" ? record.salary : Number(record.salary);
  if (!Number.isFinite(salary) || salary < 0 || salary > 1_000_000_000_000) {
    throw new ValidationError("Salary must be a number that is zero or greater.");
  }
  const currency = text(record.currency ?? "", "Currency", 8, true);
  if (!isCurrency(currency)) throw new ValidationError("Choose a supported currency.");
  const payFrequency = text(record.payFrequency ?? "", "Pay frequency", 20, true);
  if (!isPayFrequency(payFrequency)) throw new ValidationError("Choose how this salary is paid.");
  const status = text(record.status ?? "", "Status", 20, true);
  if (!isStatus(status)) throw new ValidationError("Choose active or inactive.");
  const hiredOn = text(record.hiredOn ?? "", "Start date", 10);
  if (hiredOn && !/^\d{4}-\d{2}-\d{2}$/.test(hiredOn)) {
    throw new ValidationError("Start date must be a valid date.");
  }

  const incoming =
    record.customFields &&
    typeof record.customFields === "object" &&
    !Array.isArray(record.customFields)
      ? (record.customFields as Record<string, unknown>)
      : {};
  const customFields: Record<string, CustomValue> = {};
  for (const field of fields) {
    customFields[field.key] = readCustomValue(field, incoming[field.key]);
  }

  return {
    fullName: text(record.fullName ?? "", "Full name", 120, true),
    email,
    phone,
    jobTitle: text(record.jobTitle ?? "", "Job title", 120),
    department: text(record.department ?? "", "Department", 120),
    salary,
    currency,
    payFrequency,
    status,
    hiredOn,
    notes: text(record.notes ?? "", "Notes", 2000),
    customFields,
  };
}

function normalizeFieldInput(input: unknown): FieldInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Field details are missing.");
  }
  const record = input as Record<string, unknown>;
  const type = text(record.type ?? "", "Field type", 20, true);
  if (!isFieldType(type)) throw new ValidationError("Choose a field type.");
  const options = type === "select" ? cleanOptions(record.options ?? []) : [];
  if (type === "select" && options.length === 0) {
    throw new ValidationError("A choice list needs at least one option.");
  }
  return {
    label: text(record.label ?? "", "Field label", 60, true),
    type,
    required: record.required === true,
    options,
  };
}

export function listFields(): FieldDefinition[] {
  const rows = getDb()
    .prepare(
      `SELECT id, module, label, field_key, field_type, required, options_json, sort_order
       FROM field_definitions
       WHERE module = 'payroll'
       ORDER BY sort_order ASC, created_at ASC`,
    )
    .all() as FieldRow[];
  return rows.map(toField);
}

export function listEmployees(): Employee[] {
  const rows = getDb()
    .prepare(
      `SELECT id, full_name, email, phone, job_title, department, salary, currency,
              pay_frequency, status, hired_on, notes, custom_json, created_at, updated_at
       FROM employees
       ORDER BY full_name COLLATE NOCASE ASC, created_at ASC`,
    )
    .all() as EmployeeRow[];
  return rows.map(toEmployee);
}

export function createEmployee(input: unknown) {
  const fields = listFields();
  const employee = normalizeEmployee(input, fields);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO employees (
         id, full_name, email, phone, job_title, department, salary, currency,
         pay_frequency, status, hired_on, notes, custom_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      employee.fullName,
      employee.email,
      employee.phone,
      employee.jobTitle,
      employee.department,
      employee.salary,
      employee.currency,
      employee.payFrequency,
      employee.status,
      employee.hiredOn,
      employee.notes,
      JSON.stringify(employee.customFields),
      now,
      now,
    );
}

export function updateEmployee(id: string, input: unknown) {
  if (!id) throw new ValidationError("That employee could not be found.");
  const existing = getDb().prepare(`SELECT id FROM employees WHERE id = ?`).get(id);
  if (!existing) throw new ValidationError("That employee is no longer on file.");
  const employee = normalizeEmployee(input, listFields());
  getDb()
    .prepare(
      `UPDATE employees
       SET full_name = ?, email = ?, phone = ?, job_title = ?, department = ?,
           salary = ?, currency = ?, pay_frequency = ?, status = ?, hired_on = ?,
           notes = ?, custom_json = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      employee.fullName,
      employee.email,
      employee.phone,
      employee.jobTitle,
      employee.department,
      employee.salary,
      employee.currency,
      employee.payFrequency,
      employee.status,
      employee.hiredOn,
      employee.notes,
      JSON.stringify(employee.customFields),
      new Date().toISOString(),
      id,
    );
}

export function deleteEmployee(id: string) {
  const result = getDb().prepare(`DELETE FROM employees WHERE id = ?`).run(id);
  if (result.changes === 0) {
    throw new ValidationError("That employee is no longer on file.");
  }
}

export function createField(input: unknown) {
  const field = normalizeFieldInput(input);
  const count = getDb()
    .prepare(`SELECT COUNT(*) AS count FROM field_definitions WHERE module = 'payroll'`)
    .get() as { count: number };
  if (count.count >= 20) {
    throw new ValidationError("You can add up to 20 custom fields.");
  }
  const sort = getDb()
    .prepare(
      `SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM field_definitions WHERE module = 'payroll'`,
    )
    .get() as { max_sort: number };
  getDb()
    .prepare(
      `INSERT INTO field_definitions (
         id, module, label, field_key, field_type, required, options_json, sort_order, created_at
       ) VALUES (?, 'payroll', ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      crypto.randomUUID(),
      field.label,
      uniqueFieldKey(fieldKeyFromLabel(field.label)),
      field.type,
      field.required ? 1 : 0,
      JSON.stringify(field.options),
      sort.max_sort + 1,
      new Date().toISOString(),
    );
}

export function updateField(id: string, input: unknown) {
  const current = getDb()
    .prepare(
      `SELECT id, module, label, field_key, field_type, required, options_json, sort_order
       FROM field_definitions WHERE id = ? AND module = 'payroll'`,
    )
    .get(id) as FieldRow | undefined;
  if (!current) throw new ValidationError("That field is no longer available.");
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Field details are missing.");
  }
  const record = input as Record<string, unknown>;
  const update: FieldUpdate = {
    label: text(record.label ?? "", "Field label", 60, true),
    required: record.required === true,
    options: current.field_type === "select" ? cleanOptions(record.options ?? []) : [],
  };
  if (current.field_type === "select" && update.options.length === 0) {
    throw new ValidationError("A choice list needs at least one option.");
  }
  getDb()
    .prepare(
      `UPDATE field_definitions
       SET label = ?, required = ?, options_json = ?
       WHERE id = ? AND module = 'payroll'`,
    )
    .run(update.label, update.required ? 1 : 0, JSON.stringify(update.options), id);
}

export function deleteField(id: string) {
  const result = getDb()
    .prepare(`DELETE FROM field_definitions WHERE id = ? AND module = 'payroll'`)
    .run(id);
  if (result.changes === 0) {
    throw new ValidationError("That field is no longer available.");
  }
}
