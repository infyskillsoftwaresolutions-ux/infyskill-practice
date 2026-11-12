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

const MODULE = "colleges";
const PROGRAM_MODULE = "college_programs";
type FieldModule = typeof MODULE | typeof PROGRAM_MODULE;

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

type CollegeRow = {
  id: string;
  name: string;
  custom_json: string;
  created_at: string;
  updated_at: string;
};

type ProgramRow = {
  id: string;
  college_id: string;
  name: string;
  price: number;
  currency: string;
  sort_order: number;
  custom_json: string;
};

export type CollegeProgram = {
  id: string;
  name: string;
  price: number;
  currency: CurrencyCode;
  customFields: Record<string, CustomValue>;
};

export type College = {
  id: string;
  name: string;
  programs: CollegeProgram[];
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

function toField(row: FieldRow, module: FieldModule): FieldDefinition {
  return {
    id: row.id,
    module,
    label: row.label,
    key: row.field_key,
    type: isFieldType(row.field_type) ? row.field_type : "text",
    required: row.required === 1,
    options: parseOptions(row.options_json),
    sortOrder: row.sort_order,
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

function uniqueFieldKey(module: FieldModule, base: string) {
  const existing = new Set(
    getDb()
      .prepare(`SELECT field_key FROM field_definitions WHERE module = ?`)
      .all(module)
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

function readCustomFields(fields: FieldDefinition[], raw: unknown) {
  const incoming =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const customFields: Record<string, CustomValue> = {};
  for (const field of fields) customFields[field.key] = readCustomValue(field, incoming[field.key]);
  return customFields;
}

function normalizeProgram(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Program details are missing.");
  }
  const record = input as Record<string, unknown>;
  const name = text(record.name ?? "", "Program name", 160, true);
  const price = typeof record.price === "number" ? record.price : Number(record.price);
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000_000_000) {
    throw new ValidationError("Price must be a number that is zero or greater.");
  }
  const currency = text(record.currency ?? "", "Currency", 8, true);
  if (!isCurrency(currency)) throw new ValidationError("Choose a supported currency.");
  return {
    name,
    price,
    currency,
    customFields: readCustomFields(listProgramFields(), record.customFields),
  };
}

function programsByCollege() {
  const rows = getDb()
    .prepare(
      `SELECT id, college_id, name, price, currency, sort_order, custom_json
       FROM college_programs
       ORDER BY sort_order ASC, created_at ASC`,
    )
    .all() as ProgramRow[];
  const grouped = new Map<string, CollegeProgram[]>();
  for (const row of rows) {
    const list = grouped.get(row.college_id) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      price: row.price,
      currency: isCurrency(row.currency) ? row.currency : "INR",
      customFields: parseCustom(row.custom_json ?? "{}"),
    });
    grouped.set(row.college_id, list);
  }
  return grouped;
}

function toCollege(row: CollegeRow, programs: CollegeProgram[]): College {
  return {
    id: row.id,
    name: row.name,
    programs,
    customFields: parseCustom(row.custom_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function listFields(module: FieldModule): FieldDefinition[] {
  const rows = getDb()
    .prepare(
      `SELECT id, module, label, field_key, field_type, required, options_json, sort_order
       FROM field_definitions
       WHERE module = ?
       ORDER BY sort_order ASC, created_at ASC`,
    )
    .all(module) as FieldRow[];
  return rows.map((row) => toField(row, module));
}

export function listCollegeFields(): FieldDefinition[] {
  return listFields(MODULE);
}

export function listProgramFields(): FieldDefinition[] {
  return listFields(PROGRAM_MODULE);
}

export function listColleges(): College[] {
  const rows = getDb()
    .prepare(
      `SELECT id, name, custom_json, created_at, updated_at
       FROM colleges
       ORDER BY created_at DESC`,
    )
    .all() as CollegeRow[];
  const programs = programsByCollege();
  return rows.map((row) => toCollege(row, programs.get(row.id) ?? []));
}

export function getCollege(id: string): College | null {
  const row = getDb()
    .prepare(`SELECT id, name, custom_json, created_at, updated_at FROM colleges WHERE id = ?`)
    .get(id) as CollegeRow | undefined;
  if (!row) return null;
  return toCollege(row, programsByCollege().get(row.id) ?? []);
}

export function createCollege(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("College details are missing.");
  }
  const name = text((input as Record<string, unknown>).name ?? "", "College name", 160, true);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  getDb()
    .prepare(`INSERT INTO colleges (id, name, custom_json, created_at, updated_at) VALUES (?, ?, '{}', ?, ?)`)
    .run(id, name, now, now);
  return id;
}

export function updateCollegeDetails(id: string, input: unknown) {
  if (!id) throw new ValidationError("That college could not be found.");
  const existing = getDb().prepare(`SELECT id FROM colleges WHERE id = ?`).get(id);
  if (!existing) throw new ValidationError("That college is no longer on file.");
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("College details are missing.");
  }
  const record = input as Record<string, unknown>;
  const name = text(record.name ?? "", "College name", 160, true);
  const customFields = readCustomFields(listCollegeFields(), record.customFields);
  getDb()
    .prepare(`UPDATE colleges SET name = ?, custom_json = ?, updated_at = ? WHERE id = ?`)
    .run(name, JSON.stringify(customFields), new Date().toISOString(), id);
}

export function deleteCollege(id: string) {
  const result = getDb().prepare(`DELETE FROM colleges WHERE id = ?`).run(id);
  if (result.changes === 0) throw new ValidationError("That college is no longer on file.");
}

export function createProgram(collegeId: string, input: unknown) {
  const college = getDb().prepare(`SELECT id FROM colleges WHERE id = ?`).get(collegeId);
  if (!college) throw new ValidationError("That college is no longer on file.");
  const count = getDb()
    .prepare(`SELECT COUNT(*) AS count FROM college_programs WHERE college_id = ?`)
    .get(collegeId) as { count: number };
  if (count.count >= 40) throw new ValidationError("A college can have up to 40 programs.");
  const program = normalizeProgram(input);
  const sort = getDb()
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM college_programs WHERE college_id = ?`)
    .get(collegeId) as { max_sort: number };
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO college_programs (id, college_id, name, price, currency, sort_order, custom_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      collegeId,
      program.name,
      program.price,
      program.currency,
      sort.max_sort + 1,
      JSON.stringify(program.customFields),
      new Date().toISOString(),
    );
  return id;
}

export function updateProgram(id: string, input: unknown) {
  const existing = getDb().prepare(`SELECT id FROM college_programs WHERE id = ?`).get(id);
  if (!existing) throw new ValidationError("That program is no longer on file.");
  const program = normalizeProgram(input);
  getDb()
    .prepare(`UPDATE college_programs SET name = ?, price = ?, currency = ?, custom_json = ? WHERE id = ?`)
    .run(program.name, program.price, program.currency, JSON.stringify(program.customFields), id);
}

export function deleteProgram(id: string) {
  const result = getDb().prepare(`DELETE FROM college_programs WHERE id = ?`).run(id);
  if (result.changes === 0) throw new ValidationError("That program is no longer on file.");
}

function createField(module: FieldModule, input: unknown) {
  const field = normalizeFieldInput(input);
  const count = getDb()
    .prepare(`SELECT COUNT(*) AS count FROM field_definitions WHERE module = ?`)
    .get(module) as { count: number };
  if (count.count >= 20) throw new ValidationError("You can add up to 20 custom fields.");
  const sort = getDb()
    .prepare(`SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM field_definitions WHERE module = ?`)
    .get(module) as { max_sort: number };
  getDb()
    .prepare(
      `INSERT INTO field_definitions (
         id, module, label, field_key, field_type, required, options_json, sort_order, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      crypto.randomUUID(),
      module,
      field.label,
      uniqueFieldKey(module, fieldKeyFromLabel(field.label)),
      field.type,
      field.required ? 1 : 0,
      JSON.stringify(field.options),
      sort.max_sort + 1,
      new Date().toISOString(),
    );
}

function updateField(module: FieldModule, id: string, input: unknown) {
  const current = getDb()
    .prepare(
      `SELECT id, module, label, field_key, field_type, required, options_json, sort_order
       FROM field_definitions WHERE id = ? AND module = ?`,
    )
    .get(id, module) as FieldRow | undefined;
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
      `UPDATE field_definitions SET label = ?, required = ?, options_json = ? WHERE id = ? AND module = ?`,
    )
    .run(update.label, update.required ? 1 : 0, JSON.stringify(update.options), id, module);
}

function deleteField(module: FieldModule, id: string) {
  const result = getDb()
    .prepare(`DELETE FROM field_definitions WHERE id = ? AND module = ?`)
    .run(id, module);
  if (result.changes === 0) throw new ValidationError("That field is no longer available.");
}

export function createCollegeField(input: unknown) {
  createField(MODULE, input);
}

export function updateCollegeField(id: string, input: unknown) {
  updateField(MODULE, id, input);
}

export function deleteCollegeField(id: string) {
  deleteField(MODULE, id);
}

export function createProgramField(input: unknown) {
  createField(PROGRAM_MODULE, input);
}

export function updateProgramField(id: string, input: unknown) {
  updateField(PROGRAM_MODULE, id, input);
}

export function deleteProgramField(id: string) {
  deleteField(PROGRAM_MODULE, id);
}
