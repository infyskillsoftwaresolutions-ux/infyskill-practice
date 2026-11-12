import { getDb } from "@/lib/db";
import { INVOICE_STATUSES, type InvoiceSettings, type InvoiceStatus } from "@/lib/invoice-shared";
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

const MODULE = "invoices";

export type { InvoiceStatus } from "@/lib/invoice-shared";
export { INVOICE_STATUSES, INVOICE_STATUS_LABELS, invoiceTotal, lineAmount } from "@/lib/invoice-shared";

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

type InvoiceRow = {
  id: string;
  invoice_number: string;
  college_id: string;
  bill_to_name: string;
  issued_on: string;
  currency: string;
  status: string;
  notes: string;
  custom_json: string;
  created_at: string;
  updated_at: string;
};

type LineRow = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  rate: number;
  sort_order: number;
};

type SettingsRow = {
  id: string;
  company_name: string;
  address: string;
  email: string;
  phone: string;
  payment_details: string;
};

export type InvoiceLine = {
  id: string;
  description: string;
  quantity: number;
  rate: number;
};

export type Invoice = {
  id: string;
  number: string;
  collegeId: string;
  billToName: string;
  issuedOn: string;
  currency: CurrencyCode;
  status: InvoiceStatus;
  notes: string;
  lines: InvoiceLine[];
  customFields: Record<string, CustomValue>;
  createdAt: string;
  updatedAt: string;
};

export type { InvoiceSettings } from "@/lib/invoice-shared";

export type InvoiceCollegeOption = {
  id: string;
  name: string;
  programs: { name: string; price: number; currency: CurrencyCode }[];
};

function isFieldType(value: string): value is FieldType {
  return (FIELD_TYPES as readonly string[]).includes(value);
}

function isCurrency(value: string): value is CurrencyCode {
  return (CURRENCIES as readonly string[]).includes(value);
}

function isStatus(value: string): value is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(value);
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

function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function nextInvoiceNumber() {
  const rows = getDb().prepare(`SELECT invoice_number FROM invoices`).all() as { invoice_number: string }[];
  let max = 0;
  for (const row of rows) {
    const match = /^INV-(\d+)$/.exec(row.invoice_number.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `INV-${String(max + 1).padStart(4, "0")}`;
}

function linesByInvoice() {
  const rows = getDb()
    .prepare(
      `SELECT id, invoice_id, description, quantity, rate, sort_order
       FROM invoice_lines ORDER BY sort_order ASC`,
    )
    .all() as LineRow[];
  const grouped = new Map<string, InvoiceLine[]>();
  for (const row of rows) {
    const list = grouped.get(row.invoice_id) ?? [];
    list.push({ id: row.id, description: row.description, quantity: row.quantity, rate: row.rate });
    grouped.set(row.invoice_id, list);
  }
  return grouped;
}

function toInvoice(row: InvoiceRow, lines: InvoiceLine[]): Invoice {
  return {
    id: row.id,
    number: row.invoice_number,
    collegeId: row.college_id,
    billToName: row.bill_to_name,
    issuedOn: row.issued_on,
    currency: isCurrency(row.currency) ? row.currency : "INR",
    status: isStatus(row.status) ? row.status : "draft",
    notes: row.notes,
    lines,
    customFields: parseCustom(row.custom_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeLines(raw: unknown) {
  if (!Array.isArray(raw)) throw new ValidationError("Invoice lines need to be a list.");
  const lines: { description: string; quantity: number; rate: number }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new ValidationError("A line is missing its details.");
    }
    const record = item as Record<string, unknown>;
    const description = text(record.description ?? "", "Description", 200);
    const quantityRaw = record.quantity;
    const rateRaw = record.rate;
    const quantityEmpty =
      quantityRaw === null || quantityRaw === undefined || (typeof quantityRaw === "string" && quantityRaw.trim() === "");
    const rateEmpty = rateRaw === null || rateRaw === undefined || (typeof rateRaw === "string" && rateRaw.trim() === "");
    if (!description && quantityEmpty && rateEmpty) continue;
    if (!description) throw new ValidationError("Each line needs a description.");
    const quantity = typeof quantityRaw === "number" ? quantityRaw : Number(quantityRaw);
    const rate = typeof rateRaw === "number" ? rateRaw : Number(rateRaw);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) {
      throw new ValidationError(`Quantity for ${description} must be greater than zero.`);
    }
    if (!Number.isFinite(rate) || rate < 0 || rate > 1_000_000_000_000) {
      throw new ValidationError(`Rate for ${description} must be zero or greater.`);
    }
    lines.push({ description, quantity, rate });
  }
  if (lines.length === 0) throw new ValidationError("Add at least one line.");
  if (lines.length > 40) throw new ValidationError("An invoice can have up to 40 lines.");
  return lines;
}

function normalizeInvoice(input: unknown, fields: FieldDefinition[], currentId: string) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Invoice details are missing.");
  }
  const record = input as Record<string, unknown>;
  const number = text(record.number ?? "", "Invoice number", 40, true);
  const taken = getDb()
    .prepare(`SELECT id FROM invoices WHERE invoice_number = ? AND id != ?`)
    .get(number, currentId);
  if (taken) throw new ValidationError("That invoice number is already used.");
  const issuedOn = text(record.issuedOn ?? "", "Date", 10, true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issuedOn)) throw new ValidationError("Date must be a valid date.");
  const currency = text(record.currency ?? "", "Currency", 8, true);
  if (!isCurrency(currency)) throw new ValidationError("Choose a supported currency.");
  const status = text(record.status ?? "", "Status", 20, true);
  if (!isStatus(status)) throw new ValidationError("Choose a status.");
  const collegeId = text(record.collegeId ?? "", "College", 80);
  const incoming =
    record.customFields && typeof record.customFields === "object" && !Array.isArray(record.customFields)
      ? (record.customFields as Record<string, unknown>)
      : {};
  const customFields: Record<string, CustomValue> = {};
  for (const field of fields) customFields[field.key] = readCustomValue(field, incoming[field.key]);
  return {
    number,
    collegeId,
    billToName: text(record.billToName ?? "", "Bill to", 160, true),
    issuedOn,
    currency,
    status,
    notes: text(record.notes ?? "", "Notes", 2000),
    lines: normalizeLines(record.lines),
    customFields,
  };
}

export function listInvoiceFields(): FieldDefinition[] {
  const rows = getDb()
    .prepare(
      `SELECT id, module, label, field_key, field_type, required, options_json, sort_order
       FROM field_definitions WHERE module = ? ORDER BY sort_order ASC, created_at ASC`,
    )
    .all(MODULE) as FieldRow[];
  return rows.map((row) => ({
    id: row.id,
    module: "invoices" as const,
    label: row.label,
    key: row.field_key,
    type: isFieldType(row.field_type) ? row.field_type : "text",
    required: row.required === 1,
    options: parseOptions(row.options_json),
    sortOrder: row.sort_order,
  }));
}

export function getInvoiceSettings(): InvoiceSettings {
  const row = getDb()
    .prepare(`SELECT id, company_name, address, email, phone, payment_details FROM invoice_settings WHERE id = 'default'`)
    .get() as SettingsRow | undefined;
  if (!row) {
    getDb()
      .prepare(
        `INSERT INTO invoice_settings (id, company_name, address, email, phone, payment_details)
         VALUES ('default', 'Infyskill', '', '', '', '')`,
      )
      .run();
    return { companyName: "Infyskill", address: "", email: "", phone: "", paymentDetails: "" };
  }
  return {
    companyName: row.company_name,
    address: row.address,
    email: row.email,
    phone: row.phone,
    paymentDetails: row.payment_details,
  };
}

export function updateInvoiceSettings(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Company details are missing.");
  }
  const record = input as Record<string, unknown>;
  getInvoiceSettings();
  getDb()
    .prepare(
      `UPDATE invoice_settings
       SET company_name = ?, address = ?, email = ?, phone = ?, payment_details = ?
       WHERE id = 'default'`,
    )
    .run(
      text(record.companyName ?? "", "Company name", 80, true),
      text(record.address ?? "", "Address", 400),
      text(record.email ?? "", "Email", 120),
      text(record.phone ?? "", "Phone", 40),
      text(record.paymentDetails ?? "", "Payment details", 500),
    );
}

export function listInvoices(): Invoice[] {
  const rows = getDb()
    .prepare(
      `SELECT id, invoice_number, college_id, bill_to_name, issued_on, currency, status, notes, custom_json, created_at, updated_at
       FROM invoices ORDER BY created_at DESC`,
    )
    .all() as InvoiceRow[];
  const lines = linesByInvoice();
  return rows.map((row) => toInvoice(row, lines.get(row.id) ?? []));
}

export function getInvoice(id: string): Invoice | null {
  const row = getDb()
    .prepare(
      `SELECT id, invoice_number, college_id, bill_to_name, issued_on, currency, status, notes, custom_json, created_at, updated_at
       FROM invoices WHERE id = ?`,
    )
    .get(id) as InvoiceRow | undefined;
  if (!row) return null;
  return toInvoice(row, linesByInvoice().get(row.id) ?? []);
}

export function createInvoice() {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO invoices (
         id, invoice_number, college_id, bill_to_name, issued_on, currency, status, notes, custom_json, created_at, updated_at
       ) VALUES (?, ?, '', '', ?, 'INR', 'draft', '', '{}', ?, ?)`,
    )
    .run(id, nextInvoiceNumber(), today(), now, now);
  return id;
}

export function updateInvoice(id: string, input: unknown) {
  if (!id) throw new ValidationError("That invoice could not be found.");
  const existing = getDb().prepare(`SELECT id FROM invoices WHERE id = ?`).get(id);
  if (!existing) throw new ValidationError("That invoice is no longer on file.");
  const invoice = normalizeInvoice(input, listInvoiceFields(), id);
  const db = getDb();
  db.exec("BEGIN");
  try {
    db.prepare(
      `UPDATE invoices
       SET invoice_number = ?, college_id = ?, bill_to_name = ?, issued_on = ?, currency = ?, status = ?, notes = ?, custom_json = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      invoice.number,
      invoice.collegeId,
      invoice.billToName,
      invoice.issuedOn,
      invoice.currency,
      invoice.status,
      invoice.notes,
      JSON.stringify(invoice.customFields),
      new Date().toISOString(),
      id,
    );
    db.prepare(`DELETE FROM invoice_lines WHERE invoice_id = ?`).run(id);
    const insert = db.prepare(
      `INSERT INTO invoice_lines (id, invoice_id, description, quantity, rate, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    invoice.lines.forEach((line, index) => {
      insert.run(crypto.randomUUID(), id, line.description, line.quantity, line.rate, index);
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function deleteInvoice(id: string) {
  const result = getDb().prepare(`DELETE FROM invoices WHERE id = ?`).run(id);
  if (result.changes === 0) throw new ValidationError("That invoice is no longer on file.");
}

function createField(input: unknown) {
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

function updateField(id: string, input: unknown) {
  const current = getDb()
    .prepare(
      `SELECT id, module, label, field_key, field_type, required, options_json, sort_order
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

export function createInvoiceField(input: unknown) {
  createField(input);
}

export function updateInvoiceField(id: string, input: unknown) {
  updateField(id, input);
}

export function deleteInvoiceField(id: string) {
  const result = getDb().prepare(`DELETE FROM field_definitions WHERE id = ? AND module = ?`).run(id, MODULE);
  if (result.changes === 0) throw new ValidationError("That field is no longer available.");
}
