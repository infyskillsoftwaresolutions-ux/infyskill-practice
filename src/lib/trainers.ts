import { getDb } from "@/lib/db";
import { ValidationError } from "@/lib/payroll";
import type { CustomValue, FieldDefinition, FieldInput, FieldType, FieldUpdate } from "@/lib/payroll-types";
import { FIELD_TYPES } from "@/lib/payroll-types";
import { TRAINER_STATUSES, type TrainerStatus } from "@/lib/trainer-shared";

export { ValidationError };
export { TRAINER_STATUSES, TRAINER_STATUS_LABELS } from "@/lib/trainer-shared";
export type { TrainerStatus } from "@/lib/trainer-shared";

const MODULE = "trainers";

type FieldRow = {
  id: string;
  label: string;
  field_key: string;
  field_type: string;
  required: number;
  options_json: string;
  sort_order: number;
};

type TrainerRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  experience_years: number | null;
  skills_json: string;
  address: string;
  city: string;
  daily_budget: number | null;
  weekly_budget: number | null;
  monthly_budget: number | null;
  status: string;
  notes: string;
  custom_json: string;
  created_at: string;
  updated_at: string;
};

export type Trainer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  experienceYears: number | null;
  skills: string[];
  address: string;
  city: string;
  dailyBudget: number | null;
  weeklyBudget: number | null;
  monthlyBudget: number | null;
  status: TrainerStatus;
  notes: string;
  customFields: Record<string, CustomValue>;
  createdAt: string;
  updatedAt: string;
};

function isFieldType(value: string): value is FieldType {
  return (FIELD_TYPES as readonly string[]).includes(value);
}

function isStatus(value: string): value is TrainerStatus {
  return (TRAINER_STATUSES as readonly string[]).includes(value);
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
      if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function parseSkills(json: string) {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

function toField(row: FieldRow): FieldDefinition {
  return {
    id: row.id,
    module: MODULE,
    label: row.label,
    key: row.field_key,
    type: isFieldType(row.field_type) ? row.field_type : "text",
    required: row.required === 1,
    options: parseOptions(row.options_json),
    sortOrder: row.sort_order,
  };
}

function toTrainer(row: TrainerRow): Trainer {
  return {
    id: row.id,
    name: row.full_name,
    phone: row.phone,
    email: row.email,
    experienceYears: row.experience_years,
    skills: parseSkills(row.skills_json),
    address: row.address,
    city: row.city,
    dailyBudget: row.daily_budget,
    weeklyBudget: row.weekly_budget,
    monthlyBudget: row.monthly_budget,
    status: isStatus(row.status) ? row.status : "active",
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

function optionalAmount(raw: unknown, label: string, max: number) {
  if (raw === null || raw === undefined || raw === "") return null;
  const number = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(number) || number < 0 || number > max) {
    throw new ValidationError(`${label} must be a number that is zero or greater.`);
  }
  return number;
}

function readSkills(raw: unknown) {
  if (!Array.isArray(raw)) throw new ValidationError("Skills need to be a list.");
  const seen = new Set<string>();
  const skills: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") throw new ValidationError("Each skill needs to be text.");
    const skill = item.trim();
    if (!skill) continue;
    if (skill.length > 40) throw new ValidationError("Each skill must be 40 characters or fewer.");
    const marker = skill.toLowerCase();
    if (seen.has(marker)) continue;
    seen.add(marker);
    skills.push(skill);
  }
  if (skills.length > 30) throw new ValidationError("A trainer can have up to 30 skills.");
  return skills;
}

function optionalEmail(raw: unknown) {
  const email = text(raw ?? "", "Email", 160);
  if (!email) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("Email needs to look like name@example.com.");
  }
  return email;
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
  if (!field.options.includes(choice)) throw new ValidationError(`${field.label} must be one of the listed choices.`);
  return choice;
}

function readCustomFields(fields: FieldDefinition[], raw: unknown) {
  const incoming = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const customFields: Record<string, CustomValue> = {};
  for (const field of fields) customFields[field.key] = readCustomValue(field, incoming[field.key]);
  return customFields;
}

function recordOf(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Trainer details are missing.");
  }
  return input as Record<string, unknown>;
}

function normalizeTrainer(input: unknown) {
  const record = recordOf(input);
  const status = text(record.status ?? "", "Status", 20, true);
  if (!isStatus(status)) throw new ValidationError("Choose Active or Inactive.");
  return {
    name: text(record.name ?? "", "Name", 120, true),
    phone: text(record.phone ?? "", "Contact", 40),
    email: optionalEmail(record.email),
    experienceYears: optionalAmount(record.experienceYears, "Experience", 80),
    skills: readSkills(record.skills ?? []),
    address: text(record.address ?? "", "Address", 500),
    city: text(record.city ?? "", "City", 80),
    dailyBudget: optionalAmount(record.dailyBudget, "Daily budget", 1_000_000_000_000),
    weeklyBudget: optionalAmount(record.weeklyBudget, "Weekly budget", 1_000_000_000_000),
    monthlyBudget: optionalAmount(record.monthlyBudget, "Monthly budget", 1_000_000_000_000),
    status,
    notes: text(record.notes ?? "", "Notes", 2000),
    customFields: readCustomFields(listTrainerFields(), record.customFields),
  };
}

const TRAINER_COLUMNS = `id, full_name, phone, email, experience_years, skills_json, address, city,
  daily_budget, weekly_budget, monthly_budget, status, notes, custom_json, created_at, updated_at`;

export function listTrainers() {
  const rows = getDb()
    .prepare(`SELECT ${TRAINER_COLUMNS} FROM trainers ORDER BY created_at DESC`)
    .all() as TrainerRow[];
  return rows.map(toTrainer);
}

export function getTrainer(id: string) {
  const row = getDb().prepare(`SELECT ${TRAINER_COLUMNS} FROM trainers WHERE id = ?`).get(id) as TrainerRow | undefined;
  return row ? toTrainer(row) : null;
}

export function listTrainerSkillNames() {
  const rows = getDb().prepare(`SELECT skills_json FROM trainers`).all() as { skills_json: string }[];
  const seen = new Map<string, string>();
  for (const row of rows) {
    for (const skill of parseSkills(row.skills_json)) {
      const marker = skill.toLowerCase();
      if (!seen.has(marker)) seen.set(marker, skill);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function createTrainer(input: unknown) {
  const count = getDb().prepare(`SELECT COUNT(*) AS count FROM trainers`).get() as { count: number };
  if (count.count >= 500) throw new ValidationError("You can keep up to 500 trainers.");
  const name = text(recordOf(input).name ?? "", "Name", 120, true);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO trainers (
         id, full_name, phone, email, experience_years, skills_json, address, city,
         daily_budget, weekly_budget, monthly_budget, status, notes, custom_json, created_at, updated_at
       ) VALUES (?, ?, '', '', NULL, '[]', '', '', NULL, NULL, NULL, 'active', '', '{}', ?, ?)`,
    )
    .run(id, name, now, now);
  return id;
}

export function updateTrainer(id: string, input: unknown) {
  const existing = getDb().prepare(`SELECT id FROM trainers WHERE id = ?`).get(id);
  if (!existing) throw new ValidationError("That trainer is no longer on file.");
  const trainer = normalizeTrainer(input);
  getDb()
    .prepare(
      `UPDATE trainers SET
         full_name = ?, phone = ?, email = ?, experience_years = ?, skills_json = ?, address = ?, city = ?,
         daily_budget = ?, weekly_budget = ?, monthly_budget = ?, status = ?, notes = ?, custom_json = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      trainer.name,
      trainer.phone,
      trainer.email,
      trainer.experienceYears,
      JSON.stringify(trainer.skills),
      trainer.address,
      trainer.city,
      trainer.dailyBudget,
      trainer.weeklyBudget,
      trainer.monthlyBudget,
      trainer.status,
      trainer.notes,
      JSON.stringify(trainer.customFields),
      new Date().toISOString(),
      id,
    );
}

export function deleteTrainer(id: string) {
  const result = getDb().prepare(`DELETE FROM trainers WHERE id = ?`).run(id);
  if (result.changes === 0) throw new ValidationError("That trainer is no longer on file.");
}

export function listTrainerFields() {
  const rows = getDb()
    .prepare(
      `SELECT id, label, field_key, field_type, required, options_json, sort_order
       FROM field_definitions WHERE module = ? ORDER BY sort_order ASC, created_at ASC`,
    )
    .all(MODULE) as FieldRow[];
  return rows.map(toField);
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

export function createTrainerField(input: unknown) {
  const field = normalizeFieldInput(input);
  const count = getDb().prepare(`SELECT COUNT(*) AS count FROM field_definitions WHERE module = ?`).get(MODULE) as {
    count: number;
  };
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

export function updateTrainerField(id: string, input: unknown) {
  const current = getDb()
    .prepare(
      `SELECT id, label, field_key, field_type, required, options_json, sort_order
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

export function deleteTrainerField(id: string) {
  const result = getDb().prepare(`DELETE FROM field_definitions WHERE id = ? AND module = ?`).run(id, MODULE);
  if (result.changes === 0) throw new ValidationError("That field is no longer available.");
}
