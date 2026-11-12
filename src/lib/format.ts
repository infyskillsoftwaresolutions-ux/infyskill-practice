import type { PayFrequency } from "@/lib/payroll-types";

const FREQUENCY_SUFFIX: Record<PayFrequency, string> = {
  monthly: "/ month",
  yearly: "/ year",
  hourly: "/ hour",
};

const MONEY_PREFIX: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "AED ",
};

function groupIndian(whole: string) {
  if (whole.length <= 3) return whole;
  const head = whole.slice(0, -3);
  const tail = whole.slice(-3);
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${tail}`;
}

export function formatMoney(amount: number, currency: string) {
  const negative = amount < 0;
  const [whole, fraction] = Math.abs(amount).toFixed(2).split(".");
  const prefix = MONEY_PREFIX[currency] ?? `${currency} `;
  return `${negative ? "-" : ""}${prefix}${groupIndian(whole)}.${fraction}`;
}

export function formatSalary(amount: number, currency: string, frequency: PayFrequency) {
  return `${formatMoney(amount, currency)} ${FREQUENCY_SUFFIX[frequency]}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return value;
  return `${Number(match[3])} ${month} ${match[1]}`;
}
