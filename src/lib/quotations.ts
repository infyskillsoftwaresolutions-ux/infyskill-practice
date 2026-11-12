import { getDb } from "@/lib/db";
import {
  emptyQuotationBody,
  QUOTATION_STATUSES,
  type QuotationBody,
  type QuotationStatus,
  type TrainingArea,
} from "@/lib/quotation-shared";
import { ValidationError } from "@/lib/payroll";
import type {
  CurrencyCode,
  CustomValue,
  FieldDefinition,
  FieldInput,
  FieldType,
  FieldUpdate,
} from "@/lib/payroll-types";
import { FIELD_TYPES } from "@/lib/payroll-types";

export { ValidationError };
export type { QuotationStatus } from "@/lib/quotation-shared";
export { QUOTATION_STATUSES, QUOTATION_STATUS_LABELS } from "@/lib/quotation-shared";

const MODULE = "quotations";

type FieldRow = {
  id: string;
  label: string;
  field_key: string;
  field_type: string;
  required: number;
  options_json: string;
  sort_order: number;
};

type QuotationRow = {
  id: string;
  quotation_number: string;
  college_id: string;
  prepared_for: string;
  issued_on: string;
  valid_until: string;
  currency: string;
  status: string;
  notes: string;
  custom_json: string;
  body_json: string;
  created_at: string;
  updated_at: string;
};

export type Quotation = {
  id: string;
  number: string;
  collegeId: string;
  preparedFor: string;
  issuedOn: string;
  status: QuotationStatus;
  body: QuotationBody;
  customFields: Record<string, CustomValue>;
  createdAt: string;
  updatedAt: string;
};

export type QuotationCollegeOption = {
  id: string;
  name: string;
  programs: { name: string; price: number; currency: CurrencyCode }[];
};

function isFieldType(value: string): value is FieldType {
  return (FIELD_TYPES as readonly string[]).includes(value);
}

function isStatus(value: string): value is QuotationStatus {
  return (QUOTATION_STATUSES as readonly string[]).includes(value);
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
  if (!field.options.includes(choice)) throw new ValidationError(`${field.label} must be one of the listed choices.`);
  return choice;
}

function dateStamp(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function today() {
  return dateStamp(new Date());
}

function nextQuotationNumber() {
  const rows = getDb().prepare(`SELECT quotation_number FROM quotations`).all() as { quotation_number: string }[];
  let max = 0;
  for (const row of rows) {
    const match = /^QT-(\d+)$/.exec(row.quotation_number.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `QT-${String(max + 1).padStart(4, "0")}`;
}

function bulletText(value: unknown, label: string, maxLines: number) {
  const raw = text(typeof value === "string" ? value : "", label, 4000);
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > maxLines) throw new ValidationError(`${label} can have up to ${maxLines} lines.`);
  for (const line of lines) {
    if (line.length > 200) throw new ValidationError(`Each ${label.toLowerCase()} line must be 200 characters or fewer.`);
  }
  return lines.join("\n");
}

function optionalCount(value: unknown, label: string) {
  const raw = text(typeof value === "string" ? value : value === null || value === undefined ? "" : String(value), label, 20);
  if (!raw) return "";
  const number = Number(raw);
  if (!Number.isFinite(number) || number < 0 || number > 1_000_000_000) {
    throw new ValidationError(`${label} must be a number that is zero or greater.`);
  }
  return String(number);
}

function readBody(json: string): QuotationBody {
  const base = emptyQuotationBody();
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return base;
    const record = parsed as Record<string, unknown>;
    const areas = Array.isArray(record.areas)
      ? record.areas
          .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
          .map((item) => ({
            title: typeof item.title === "string" ? item.title : "",
            points: typeof item.points === "string" ? item.points : "",
          }))
      : base.areas;
    return {
      ...base,
      addressee: typeof record.addressee === "string" ? record.addressee : base.addressee,
      programTitle: typeof record.programTitle === "string" ? record.programTitle : "",
      duration: typeof record.duration === "string" ? record.duration : "",
      batches: typeof record.batches === "string" ? record.batches : "",
      batchSize: typeof record.batchSize === "string" ? record.batchSize : "",
      totalStudents: typeof record.totalStudents === "string" ? record.totalStudents : "",
      mode: typeof record.mode === "string" ? record.mode : "",
      audience: typeof record.audience === "string" ? record.audience : "",
      areas,
      costPerStudent: typeof record.costPerStudent === "string" ? record.costPerStudent : "",
      deliverables: typeof record.deliverables === "string" ? record.deliverables : "",
      terms: typeof record.terms === "string" ? record.terms : "",
      closing: typeof record.closing === "string" ? record.closing : "",
      signatoryName: typeof record.signatoryName === "string" ? record.signatoryName : "",
      signatoryTitle: typeof record.signatoryTitle === "string" ? record.signatoryTitle : "",
    };
  } catch {
    return base;
  }
}

function normalizeBody(raw: unknown): QuotationBody {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ValidationError("Quotation details are missing.");
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.areas)) throw new ValidationError("Training areas need to be a list.");
  if (record.areas.length > 12) throw new ValidationError("A quotation can have up to 12 training areas.");
  const areas: TrainingArea[] = record.areas.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new ValidationError("A training area is missing its details.");
    }
    const area = item as Record<string, unknown>;
    return {
      title: text(typeof area.title === "string" ? area.title : "", "Training area", 80),
      points: bulletText(area.points, "Training point", 20),
    };
  });
  return {
    addressee: text(typeof record.addressee === "string" ? record.addressee : "", "Addressed to", 80) || "The Management",
    programTitle: text(typeof record.programTitle === "string" ? record.programTitle : "", "Program title", 160, true),
    duration: text(typeof record.duration === "string" ? record.duration : "", "Duration", 80),
    batches: optionalCount(record.batches, "Number of batches"),
    batchSize: optionalCount(record.batchSize, "Batch size"),
    totalStudents: optionalCount(record.totalStudents, "Total students"),
    mode: text(typeof record.mode === "string" ? record.mode : "", "Training mode", 80),
    audience: text(typeof record.audience === "string" ? record.audience : "", "Target audience", 120),
    areas: areas.filter((area) => area.title || area.points),
    costPerStudent: optionalCount(record.costPerStudent, "Cost per student"),
    deliverables: bulletText(record.deliverables, "Deliverable", 20),
    terms: bulletText(record.terms, "Term", 20),
    closing: text(typeof record.closing === "string" ? record.closing : "", "Closing", 2000),
    signatoryName: text(typeof record.signatoryName === "string" ? record.signatoryName : "", "Signatory name", 80),
    signatoryTitle: text(typeof record.signatoryTitle === "string" ? record.signatoryTitle : "", "Designation", 80),
  };
}

function toQuotation(row: QuotationRow): Quotation {
  return {
    id: row.id,
    number: row.quotation_number,
    collegeId: row.college_id,
    preparedFor: row.prepared_for,
    issuedOn: row.issued_on,
    status: isStatus(row.status) ? row.status : "draft",
    body: readBody(row.body_json ?? "{}"),
    customFields: parseCustom(row.custom_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeQuotation(input: unknown, fields: FieldDefinition[], currentId: string) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Quotation details are missing.");
  }
  const record = input as Record<string, unknown>;
  const number = text(record.number ?? "", "Quotation number", 40, true);
  const taken = getDb()
    .prepare(`SELECT id FROM quotations WHERE quotation_number = ? AND id != ?`)
    .get(number, currentId);
  if (taken) throw new ValidationError("That quotation number is already used.");
  const issuedOn = text(record.issuedOn ?? "", "Date", 10, true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issuedOn)) throw new ValidationError("Date must be a valid date.");
  const status = text(record.status ?? "", "Status", 20, true);
  if (!isStatus(status)) throw new ValidationError("Choose a status.");
  const incoming =
    record.customFields && typeof record.customFields === "object" && !Array.isArray(record.customFields)
      ? (record.customFields as Record<string, unknown>)
      : {};
  const customFields: Record<string, CustomValue> = {};
  for (const field of fields) customFields[field.key] = readCustomValue(field, incoming[field.key]);
  return {
    number,
    collegeId: text(record.collegeId ?? "", "College", 80),
    preparedFor: text(record.preparedFor ?? "", "Prepared for", 160, true),
    issuedOn,
    status,
    body: normalizeBody(record.body),
    customFields,
  };
}

export function listQuotationFields(): FieldDefinition[] {
  const rows = getDb()
    .prepare(
      `SELECT id, label, field_key, field_type, required, options_json, sort_order
       FROM field_definitions WHERE module = ? ORDER BY sort_order ASC, created_at ASC`,
    )
    .all(MODULE) as FieldRow[];
  return rows.map((row) => ({
    id: row.id,
    module: "quotations" as const,
    label: row.label,
    key: row.field_key,
    type: isFieldType(row.field_type) ? row.field_type : "text",
    required: row.required === 1,
    options: parseOptions(row.options_json),
    sortOrder: row.sort_order,
  }));
}

export function listQuotations(): Quotation[] {
  const rows = getDb()
    .prepare(
      `SELECT id, quotation_number, college_id, prepared_for, issued_on, valid_until, currency, status, notes, custom_json, body_json, created_at, updated_at
       FROM quotations ORDER BY created_at DESC`,
    )
    .all() as QuotationRow[];
  return rows.map((row) => toQuotation(row));
}

export function getQuotation(id: string): Quotation | null {
  const row = getDb()
    .prepare(
      `SELECT id, quotation_number, college_id, prepared_for, issued_on, valid_until, currency, status, notes, custom_json, body_json, created_at, updated_at
       FROM quotations WHERE id = ?`,
    )
    .get(id) as QuotationRow | undefined;
  if (!row) return null;
  return toQuotation(row);
}

export function createQuotation() {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO quotations (
         id, quotation_number, college_id, prepared_for, issued_on, valid_until, currency, status, notes, custom_json, body_json, created_at, updated_at
       ) VALUES (?, ?, '', '', ?, '', 'INR', 'draft', '', '{}', ?, ?, ?)`,
    )
    .run(id, nextQuotationNumber(), today(), JSON.stringify(emptyQuotationBody()), now, now);
  return id;
}

export function updateQuotation(id: string, input: unknown) {
  if (!id) throw new ValidationError("That quotation could not be found.");
  const existing = getDb().prepare(`SELECT id FROM quotations WHERE id = ?`).get(id);
  if (!existing) throw new ValidationError("That quotation is no longer on file.");
  const quotation = normalizeQuotation(input, listQuotationFields(), id);
  const db = getDb();
  db.exec("BEGIN");
  try {
    db.prepare(
      `UPDATE quotations
       SET quotation_number = ?, college_id = ?, prepared_for = ?, issued_on = ?, status = ?, custom_json = ?, body_json = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      quotation.number,
      quotation.collegeId,
      quotation.preparedFor,
      quotation.issuedOn,
      quotation.status,
      JSON.stringify(quotation.customFields),
      JSON.stringify(quotation.body),
      new Date().toISOString(),
      id,
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function deleteQuotation(id: string) {
  const result = getDb().prepare(`DELETE FROM quotations WHERE id = ?`).run(id);
  if (result.changes === 0) throw new ValidationError("That quotation is no longer on file.");
}

function normalizeFieldInput(input: unknown): FieldInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Field details are missing.");
  }
  const record = input as Record<string, unknown>;
  const type = text(record.type ?? "", "Field type", 20, true);
  if (!isFieldType(type)) throw new ValidationError("Choose a field type.");
  const options = type === "select" ? cleanOptions(record.options ?? []) : [];
  if (type === "select" && options.length === 0) throw new ValidationError("A choice list needs at least one option.");
  return { label: text(record.label ?? "", "Field label", 60, true), type, required: record.required === true, options };
}

export function createQuotationField(input: unknown) {
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

export function updateQuotationField(id: string, input: unknown) {
  const current = getDb()
    .prepare(
      `SELECT id, label, field_key, field_type, required, options_json, sort_order
       FROM field_definitions WHERE id = ? AND module = ?`,
    )
    .get(id, MODULE) as FieldRow | undefined;
  if (!current) throw new ValidationError("That field is no longer available.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ValidationError("Field details are missing.");
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

export function deleteQuotationField(id: string) {
  const result = getDb().prepare(`DELETE FROM field_definitions WHERE id = ? AND module = ?`).run(id, MODULE);
  if (result.changes === 0) throw new ValidationError("That field is no longer available.");
}
