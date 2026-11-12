import { formatDate, formatMoney } from "@/lib/format";
import {
  INVOICE_STATUS_LABELS,
  invoiceTotal,
  lineAmount,
  type InvoiceSettings,
  type InvoiceStatus,
} from "@/lib/invoice-shared";
import type { CustomValue, FieldDefinition } from "@/lib/payroll-types";

export type SheetLine = { description: string; quantity: number; rate: number };

function customText(field: FieldDefinition, value: CustomValue | undefined) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field.type === "date" && typeof value === "string") return formatDate(value) || value;
  if (field.type === "number" && typeof value === "number") {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
  }
  return String(value);
}

function formatQty(quantity: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(quantity);
}

export function InvoiceSheet({
  number,
  issuedOn,
  status,
  billToName,
  currency,
  lines,
  notes,
  customFields,
  fields,
  settings,
}: {
  number: string;
  issuedOn: string;
  status: InvoiceStatus;
  billToName: string;
  currency: string;
  lines: SheetLine[];
  notes: string;
  customFields: Record<string, CustomValue>;
  fields: FieldDefinition[];
  settings: InvoiceSettings;
}) {
  const filled = lines.filter((line) => line.description.trim());
  const total = invoiceTotal(filled);
  const contact = [settings.email, settings.phone].filter(Boolean).join(" · ");
  const extras = fields
    .map((field) => ({ label: field.label, value: customText(field, customFields[field.key]) }))
    .filter((field) => field.value);

  return (
    <article className="invoice-sheet mx-auto w-full max-w-[210mm] bg-white px-8 py-8 text-ink shadow-lg print:max-w-none print:shadow-none sm:px-10 sm:py-10">
      <header className="flex items-start justify-between gap-6 border-b border-[#d9d3c7] pb-6">
        <div>
          <img src="/infyskill-logo.png" alt="Infyskill EduTech Pvt. Ltd." className="h-14 w-auto max-w-[240px] object-contain object-left" />
          {settings.companyName && !/infyskill/i.test(settings.companyName) ? (
            <p className="mt-2 text-sm font-semibold">{settings.companyName}</p>
          ) : null}
          {settings.address ? <p className="mt-2 max-w-xs whitespace-pre-wrap text-sm leading-6 text-[#4d5966]">{settings.address}</p> : null}
          {contact ? <p className="mt-1 text-sm text-[#4d5966]">{contact}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold tracking-[0.18em] text-accent">INVOICE</p>
          <p className="mt-2 text-lg font-semibold">{number || "Invoice"}</p>
          <p className="mt-1 text-sm text-[#4d5966]">{issuedOn ? formatDate(issuedOn) : "Date not set"}</p>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[#5e6a78]">{INVOICE_STATUS_LABELS[status]}</p>
        </div>
      </header>

      <section className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5e6a78]">Bill to</p>
        <p className="mt-1 text-base font-medium">{billToName.trim() || "Name not added yet"}</p>
      </section>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#d9d3c7] text-left text-xs uppercase tracking-wide text-[#5e6a78]">
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Rate</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {filled.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-6 text-[#5e6a78]">
                No lines yet.
              </td>
            </tr>
          ) : (
            filled.map((line, index) => (
              <tr key={`${line.description}-${index}`} className="border-b border-[#eee8de]">
                <td className="py-2.5 pr-3">{line.description}</td>
                <td className="py-2.5 text-right tabular-nums">{formatQty(line.quantity)}</td>
                <td className="py-2.5 text-right tabular-nums">{formatMoney(line.rate, currency)}</td>
                <td className="py-2.5 text-right font-medium tabular-nums">
                  {formatMoney(lineAmount(line.quantity, line.rate), currency)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <div className="w-full max-w-xs">
          <div className="flex justify-between border-t border-[#14202b] pt-3 text-base font-semibold">
            <span>Total</span>
            <span>{formatMoney(total, currency)}</span>
          </div>
        </div>
      </div>

      {extras.length > 0 ? (
        <dl className="mt-8 grid gap-2 text-sm sm:grid-cols-2">
          {extras.map((field) => (
            <div key={field.label}>
              <dt className="text-xs uppercase tracking-wide text-[#5e6a78]">{field.label}</dt>
              <dd className="mt-0.5">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {notes.trim() ? (
        <section className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5e6a78]">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{notes}</p>
        </section>
      ) : null}

      <section className="mt-8 border-t border-[#d9d3c7] pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5e6a78]">Payment</p>
        {settings.paymentDetails.trim() ? (
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{settings.paymentDetails}</p>
        ) : (
          <p className="mt-1 text-sm text-[#5e6a78] print:hidden">Add bank or UPI details in Company details.</p>
        )}
      </section>
    </article>
  );
}
