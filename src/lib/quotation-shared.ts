export const QUOTATION_STATUSES = ["draft", "sent", "accepted", "declined"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
};

export const LETTERHEAD = {
  legalName: "InfySkill EduTech Private Limited",
  shortName: "InfySkill Pvt. Ltd.",
  address: ["20-112-42, Kotha Agraharam Veedhi,", "Changal Rao Peta, Visakhapatnam,", "Andhra Pradesh – 530001"],
  phone: "9080087187",
  website: "www.infyskill.in",
  emails: ["info@infyskill.in", "infyskilledutech@gmail.com"],
  cin: "U85499AP2023PTC110737",
};

export type TrainingArea = {
  title: string;
  points: string;
};

export type QuotationBody = {
  addressee: string;
  programTitle: string;
  duration: string;
  batches: string;
  batchSize: string;
  totalStudents: string;
  mode: string;
  audience: string;
  areas: TrainingArea[];
  costPerStudent: string;
  deliverables: string;
  terms: string;
  closing: string;
  signatoryName: string;
  signatoryTitle: string;
};

export function emptyQuotationBody(): QuotationBody {
  return {
    addressee: "The Management",
    programTitle: "",
    duration: "",
    batches: "",
    batchSize: "",
    totalStudents: "",
    mode: "",
    audience: "",
    areas: [],
    costPerStudent: "",
    deliverables: "",
    terms: "",
    closing: "",
    signatoryName: "",
    signatoryTitle: "",
  };
}

export function textLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function asCount(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return number;
}

export type QuotationFigures = {
  costPerStudent: number | null;
  batchSize: number | null;
  batches: number | null;
  costPerBatch: number | null;
  totalStudents: number | null;
  total: number | null;
};

export function quotationFigures(body: QuotationBody): QuotationFigures {
  const costPerStudent = asCount(body.costPerStudent);
  const batchSize = asCount(body.batchSize);
  const batches = asCount(body.batches);
  const typedStudents = asCount(body.totalStudents);
  const costPerBatch = costPerStudent !== null && batchSize !== null ? costPerStudent * batchSize : null;
  const totalStudents =
    typedStudents !== null ? typedStudents : batchSize !== null && batches !== null ? batchSize * batches : null;
  const total =
    costPerStudent !== null && totalStudents !== null
      ? costPerStudent * totalStudents
      : costPerBatch !== null && batches !== null
        ? costPerBatch * batches
        : null;
  return { costPerStudent, batchSize, batches, costPerBatch, totalStudents, total };
}

const BELOW_TWENTY = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(value: number) {
  if (value < 20) return BELOW_TWENTY[value];
  const ten = Math.floor(value / 10);
  const one = value % 10;
  return one ? `${TENS[ten]}-${BELOW_TWENTY[one]}` : TENS[ten];
}

function threeDigits(value: number) {
  const hundred = Math.floor(value / 100);
  const rest = value % 100;
  const parts = [];
  if (hundred) parts.push(`${BELOW_TWENTY[hundred]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ");
}

export function rupeesInWords(amount: number) {
  const rupees = Math.round(amount);
  if (rupees === 0) return "Rupees Zero Only";
  const crore = Math.floor(rupees / 10_000_000);
  const lakh = Math.floor((rupees % 10_000_000) / 100_000);
  const thousand = Math.floor((rupees % 100_000) / 1000);
  const rest = rupees % 1000;
  const parts = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return `Rupees ${parts.join(" ")} Only`;
}
