import { getDb } from "@/lib/db";
import { ValidationError } from "@/lib/payroll";
import type {
  CurrencyCode,
  CustomValue,
  FieldDefinition,
  FieldInput,
  FieldType,
  FieldUpdate,
} from "@/lib/payroll-types";
import { CURRENCIES, FIELD_TYPES } from "@/lib/payroll-types";

export { ValidationError };

const MODULE = "credits";

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

type CreditRow = {
  id: string;
  from_name: string;
  college_id: string;
  invoice_id: string;
  amount: number;
  currency: string;
  received_on: string;
  notes: string;
  custom_json: string;
  created_at: string;
  updated_at: string;
};

export type Credit = {
  id: string;
  fromName: string;
  collegeId: string;
  invoiceId: string;
  amount: number;
  currency: CurrencyCode;
  receivedOn: string;
  notes: string;
  customFields: Record<string, CustomValue>;
  createdAt: string;
  updatedAt: string;
};

function isFieldType(value: string): value is FieldType {
  return (FIELD_TYPES as readonly string[]).includes(value);
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

function toField(row: FieldRow): FieldDefinition {
  return {
    id: row.id,
    module: "credits",
    label: row.label,
    key: row.field_key,
    type: isFieldType(row.field_type) ? row.field_type : "text",
    required: row.required === 1,
    options: parseOptions(row.options_json),
    sortOrder: row.sort_order,
  };
}

function toCredit(row: CreditRow): Credit {
  return {
    id: row.id,
    fromName: row.from_name,
    collegeId: row.college_id,
    invoiceId: row.invoice_id,
    amount: row.amount,
    currency: isCurrency(row.currency) ? row.currency : "INR",
    receivedOn: row.received_on,
    notes: row.notes,
    customFields: parseCustom(row.custom_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function text(value: unknown, label: string, max: number, required = false) {
  if (typeof value !== "string") throw new ValidationError(`${label} needs to be text.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new ValidationError(`${label} is required.`);
  if (trimmed.length > max) throw new ValidationError(`${label} must be ${max} characters or fewer.`);
  return trimmed;
}

function cleanOptions(options: unknown) {
  if (!Array.isArray(options)) throw new ValidationError("Choice list options are missing.");
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const option of options) {
    if (typeof option !== "string") throw new ValidationError("Each choice must be text.");
    const value = option.trim();
    if (!value) continue;
    if (value.length > 80) throw new ValidationError("Each choice must be 80 characters or fewer.");
    const marker = value.toLowerCase();
    if (seen.has(marker)) continue;
    seen.add(marker);
    cleaned.push(value);
  }
  if (cleaned.length > 30) throw new ValidationError("A choice list can have up to 30 options.");
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
  const existing = new Set(
    getDb()
      .prepare(`SELECT field_key FROM field_definitions WHERE module = ?`)
      .all(MODULE)
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
    if (field.required && !checked) throw new ValidationError(`${field.label} must be checked.`);
    return checked;
  }
  const empty = raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "");
  if (empty) {
    if (field.required) throw new ValidationError(`${field.label} is required.`);
    return null;
  }
  if (field.type === "text") return text(raw, field.label, 500, field.required);
  if (field.type === "number") {
    const number = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(number)) throw new ValidationError(`${field.label} must be a number.`);
    return number;
  }
  if (field.type === "date") {
    const value = text(raw, field.label, 10, field.required);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ValidationError(`${field.label} must be a valid date.`);
    return value;
  }
  const choice = text(raw, field.label, 80, field.required);
  if (!field.options.includes(choice)) {
    throw new ValidationError(`${field.label} must be one of the listed choices.`);
  }
  return choice;
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

function linkedId(value: unknown, label: string, table: "colleges" | "invoices") {
  const id = text(value ?? "", label, 80);
  if (!id) return "";
  const row = getDb().prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
  if (!row) throw new ValidationError(`That ${label.toLowerCase()} is no longer on file.`);
  return id;
}

function normalizeCredit(input: unknown, fields: FieldDefinition[]) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Credit details are missing.");
  }
  const record = input as Record<string, unknown>;
  const amount = typeof record.amount === "number" ? record.amount : Number(record.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000_000) {
    throw new ValidationError("Amount must be a number that is zero or greater.");
  }
  const currency = text(record.currency ?? "", "Currency", 8, true);
  if (!isCurrency(currency)) throw new ValidationError("Choose a supported currency.");
  const receivedOn = text(record.receivedOn ?? "", "Date", 10);
  if (receivedOn && !/^\d{4}-\d{2}-\d{2}$/.test(receivedOn)) {
    throw new ValidationError("Date must be a valid date.");
  }
  const incoming =
    record.customFields && typeof record.customFields === "object" && !Array.isArray(record.customFields)
      ? (record.customFields as Record<string, unknown>)
      : {};
  const customFields: Record<string, CustomValue> = {};
  for (const field of fields) customFields[field.key] = readCustomValue(field, incoming[field.key]);
  return {
    fromName: text(record.fromName ?? "", "Received from", 160, true),
    collegeId: linkedId(record.collegeId, "College", "colleges"),
    invoiceId: linkedId(record.invoiceId, "Invoice", "invoices"),
    amount,
    currency,
    receivedOn,
    notes: text(record.notes ?? "", "Notes", 2000),
    customFields,
  };
}

export function listCreditFields(): FieldDefinition[] {
  const rows = getDb()
    .prepare(
      `SELECT id, module, label, field_key, field_type, required, options_json, sort_order
       FROM field_definitions
       WHERE module = ?
       ORDER BY sort_order ASC, created_at ASC`,
    )
    .all(MODULE) as FieldRow[];
  return rows.map(toField);
}

export function listCredits(): Credit[] {
  const rows = getDb()
    .prepare(
      `SELECT id, from_name, college_id, invoice_id, amount, currency, received_on, notes, custom_json, created_at, updated_at
       FROM credits
       ORDER BY CASE WHEN received_on = '' THEN 1 ELSE 0 END, received_on DESC, created_at DESC`,
    )
    .all() as CreditRow[];
  return rows.map(toCredit);
}

export function createCredit(input: unknown) {
  const credit = normalizeCredit(input, listCreditFields());
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO credits (
         id, from_name, college_id, invoice_id, amount, currency, received_on, notes, custom_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      crypto.randomUUID(),
      credit.fromName,
      credit.collegeId,
      credit.invoiceId,
      credit.amount,
      credit.currency,
      credit.receivedOn,
      credit.notes,
      JSON.stringify(credit.customFields),
      now,
      now,
    );
}

export function updateCredit(id: string, input: unknown) {
  if (!id) throw new ValidationError("That credit could not be found.");
  const existing = getDb().prepare(`SELECT id FROM credits WHERE id = ?`).get(id);
  if (!existing) throw new ValidationError("That credit is no longer on file.");
  const credit = normalizeCredit(input, listCreditFields());
  getDb()
    .prepare(
      `UPDATE credits
       SET from_name = ?, college_id = ?, invoice_id = ?, amount = ?, currency = ?, received_on = ?, notes = ?, custom_json = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      credit.fromName,
      credit.collegeId,
      credit.invoiceId,
      credit.amount,
      credit.currency,
      credit.receivedOn,
      credit.notes,
      JSON.stringify(credit.customFields),
      new Date().toISOString(),
      id,
    );
}

export function deleteCredit(id: string) {
  const result = getDb().prepare(`DELETE FROM credits WHERE id = ?`).run(id);
  if (result.changes === 0) throw new ValidationError("That credit is no longer on file.");
}

export function createCreditField(input: unknown) {
  const field = normalizeFieldInput(input);
  const count = getDb()
    .prepare(`SELECT COUNT(*) AS count FROM field_definitions WHERE module = ?`)
    .get(MODULE) as { count: number };
  if (count.count >= 20) throw new ValidationError("You can add up to 20 custom fields.");
  const sort = getDb()
    .prepare(`SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM field_definitions WHERE module = ?`)
    .get(MODULE) as { max_sort: number };
  getDb()
    .prepare(
      `INSERT INTO field_definitions (
         id, module, label, field_key, field_type, required, options_json, sort_order, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      crypto.randomUUID(),
      MODULE,
      field.label,
      uniqueFieldKey(fieldKeyFromLabel(field.label)),
      field.type,
      field.required ? 1 : 0,
      JSON.stringify(field.options),
      sort.max_sort + 1,
      new Date().toISOString(),
    );
}

export function updateCreditField(id: string, input: unknown) {
  const current = getDb()
    .prepare(
      `SELECT id, module, label, field_key, field_type, required, options_json, sort_order
       FROM field_definitions WHERE id = ? AND module = ?`,
    )
    .get(id, MODULE) as FieldRow | undefined;
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
    .prepare(`UPDATE field_definitions SET label = ?, required = ?, options_json = ? WHERE id = ? AND module = ?`)
    .run(update.label, update.required ? 1 : 0, JSON.stringify(update.options), id, MODULE);
}

export function deleteCreditField(id: string) {
  const result = getDb().prepare(`DELETE FROM field_definitions WHERE id = ? AND module = ?`).run(id, MODULE);
  if (result.changes === 0) throw new ValidationError("That field is no longer available.");
}
