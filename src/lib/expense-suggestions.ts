import type { FieldInput } from "@/lib/payroll-types";

export const EXPENSE_SUGGESTED_FIELDS: FieldInput[] = [
  { label: "Vendor", type: "text", required: false, options: [] },
  { label: "Campus", type: "text", required: false, options: [] },
  { label: "Receipt number", type: "text", required: false, options: [] },
  { label: "Paid by", type: "text", required: false, options: [] },
];
