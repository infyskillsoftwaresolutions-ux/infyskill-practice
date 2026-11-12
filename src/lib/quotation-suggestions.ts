import type { FieldInput } from "@/lib/payroll-types";

export const QUOTATION_SUGGESTED_FIELDS: FieldInput[] = [
  { label: "Reference", type: "text", required: false, options: [] },
  { label: "Contact person", type: "text", required: false, options: [] },
  { label: "Campus", type: "text", required: false, options: [] },
  { label: "Buyer GSTIN", type: "text", required: false, options: [] },
];
