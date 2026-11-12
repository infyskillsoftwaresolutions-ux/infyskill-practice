import type { FieldInput } from "@/lib/payroll-types";

export const COLLEGE_SUGGESTED_FIELDS: FieldInput[] = [
  { label: "Quotation", type: "text", required: false, options: [] },
  { label: "Contact person", type: "text", required: false, options: [] },
  { label: "City", type: "text", required: false, options: [] },
  { label: "Agreement date", type: "date", required: false, options: [] },
];

export const PROGRAM_SUGGESTED_FIELDS: FieldInput[] = [
  { label: "Duration", type: "text", required: false, options: [] },
  { label: "Intake", type: "text", required: false, options: [] },
  { label: "Mode", type: "text", required: false, options: [] },
  { label: "Seats", type: "number", required: false, options: [] },
];
