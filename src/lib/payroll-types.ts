export const PAY_FREQUENCIES = ["monthly", "yearly", "hourly"] as const;
export type PayFrequency = (typeof PAY_FREQUENCIES)[number];

export const EMPLOYEE_STATUSES = ["active", "inactive"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const FIELD_TYPES = ["text", "number", "date", "select", "boolean"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export type CustomValue = string | number | boolean | null;

export type FieldDefinition = {
  id: string;
  module: "payroll" | "expenses" | "credits" | "colleges" | "college_programs" | "invoices" | "quotations" | "trainers";
  label: string;
  key: string;
  type: FieldType;
  required: boolean;
  options: string[];
  sortOrder: number;
};

export type Employee = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  salary: number;
  currency: CurrencyCode;
  payFrequency: PayFrequency;
  status: EmployeeStatus;
  hiredOn: string;
  notes: string;
  customFields: Record<string, CustomValue>;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeInput = {
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  salary: number;
  currency: CurrencyCode;
  payFrequency: PayFrequency;
  status: EmployeeStatus;
  hiredOn: string;
  notes: string;
  customFields: Record<string, CustomValue>;
};

export type FieldInput = {
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
};

export type FieldUpdate = {
  label: string;
  required: boolean;
  options: string[];
};

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export const PAY_FREQUENCY_LABELS: Record<PayFrequency, string> = {
  monthly: "Monthly",
  yearly: "Yearly",
  hourly: "Hourly",
};

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "Choice list",
  boolean: "Checkbox",
};

export const SUGGESTED_FIELDS: FieldInput[] = [
  { label: "Employee code", type: "text", required: false, options: [] },
  { label: "Campus", type: "text", required: false, options: [] },
  { label: "Bank account", type: "text", required: false, options: [] },
  { label: "PAN", type: "text", required: false, options: [] },
];
