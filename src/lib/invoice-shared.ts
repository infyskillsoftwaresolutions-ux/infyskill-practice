export const INVOICE_STATUSES = ["draft", "sent", "paid"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
};

export type InvoiceSettings = {
  companyName: string;
  address: string;
  email: string;
  phone: string;
  paymentDetails: string;
};

export function lineAmount(quantity: number, rate: number) {
  return Math.round(quantity * rate * 100) / 100;
}

export function invoiceTotal(lines: { quantity: number; rate: number }[]) {
  return lines.reduce((sum, line) => sum + lineAmount(line.quantity, line.rate), 0);
}
