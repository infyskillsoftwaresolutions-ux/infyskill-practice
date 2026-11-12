import type { FieldInput } from "@/lib/payroll-types";

export const CREDIT_SUGGESTED_FIELDS: FieldInput[] = [
  { label: "Mode", type: "select", required: false, options: ["Cash", "UPI", "Bank"] },
  { label: "Reference", type: "text", required: false, options: [] },
  { label: "Received by", type: "text", required: false, options: [] },
];
