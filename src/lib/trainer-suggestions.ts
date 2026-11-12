import type { FieldInput } from "@/lib/payroll-types";

export const TRAINER_SUGGESTED_FIELDS: FieldInput[] = [
  { label: "Qualification", type: "text", required: false, options: [] },
  { label: "Languages", type: "text", required: false, options: [] },
  { label: "Preferred mode", type: "select", required: false, options: ["Classroom", "Online", "Both"] },
  { label: "PAN", type: "text", required: false, options: [] },
  { label: "Bank account", type: "text", required: false, options: [] },
];
