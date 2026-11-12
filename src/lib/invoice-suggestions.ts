import type { FieldInput } from "@/lib/payroll-types";

export const INVOICE_SUGGESTED_FIELDS: FieldInput[] = [
  { label: "Quotation", type: "text", required: false, options: [] },
  { label: "Purchase order", type: "text", required: false, options: [] },
  { label: "Campus", type: "text", required: false, options: [] },
  { label: "Buyer GSTIN", type: "text", required: false, options: [] },
];
