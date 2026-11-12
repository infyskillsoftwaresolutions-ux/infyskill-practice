"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createInvoiceAction,
  createInvoiceFieldAction,
  deleteInvoiceAction,
  deleteInvoiceFieldAction,
  updateInvoiceFieldAction,
} from "@/app/actions/invoices";
import { CompanyDialog } from "@/components/invoices/company-dialog";
import { FieldsDialog } from "@/components/payroll/fields-dialog";
import { formatDate, formatMoney } from "@/lib/format";
import { INVOICE_SUGGESTED_FIELDS } from "@/lib/invoice-suggestions";
import { INVOICE_STATUSES, INVOICE_STATUS_LABELS, invoiceTotal, type InvoiceSettings, type InvoiceStatus } from "@/lib/invoice-shared";
import type { Invoice } from "@/lib/invoices";
import type { FieldDefinition } from "@/lib/payroll-types";

type SortKey = "newest" | "number" | "total";

export function InvoicesWorkspace({
  invoices,
  fields,
  settings,
}: {
  invoices: Invoice[];
  fields: FieldDefinition[];
  settings: InvoiceSettings;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | InvoiceStatus>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = invoices.filter((invoice) => {
      if (status !== "all" && invoice.status !== status) return false;
      if (!needle) return true;
      const custom = Object.values(invoice.customFields)
        .map((value) => (value === null || value === undefined ? "" : String(value)))
        .join(" ");
      return [invoice.number, invoice.billToName, invoice.notes, custom].join(" ").toLowerCase().includes(needle);
    });
    return filtered.sort((a, b) => {
      if (sort === "number") return b.number.localeCompare(a.number, undefined, { numeric: true });
      if (sort === "total") return invoiceTotal(b.lines) - invoiceTotal(a.lines);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [invoices, query, sort, status]);

  function createInvoice() {
    setError("");
    startTransition(async () => {
      const result = await createInvoiceAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.id) router.push(`/invoices/${result.id}`);
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Invoices</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Generate an invoice</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            Start a draft, add lines from a college or type them yourself, then print or save a PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCompanyOpen(true)}
            className="rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-medium text-ink hover:bg-background"
          >
            Company details
          </button>
          <button
            type="button"
            onClick={() => setFieldsOpen(true)}
            className="rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-medium text-ink hover:bg-background"
          >
            Custom fields
          </button>
          <button
            type="button"
            onClick={createInvoice}
            disabled={pending}
            className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
          >
            New invoice
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-line bg-card px-4 py-4">
        <p className="text-sm text-muted">Invoices</p>
        <p className="mt-1 text-2xl font-semibold text-ink">{invoices.length}</p>
      </section>

      <section className="rounded-2xl border border-line bg-card">
        <div className="flex flex-col flex-wrap gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search number, name, or a custom field"
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent sm:max-w-md"
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "all" | InvoiceStatus)}
              className="rounded-lg border border-line bg-background px-2 py-2 text-sm text-ink"
            >
              <option value="all">All</option>
              {INVOICE_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {INVOICE_STATUS_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            Sort
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="rounded-lg border border-line bg-background px-2 py-2 text-sm text-ink"
            >
              <option value="newest">Newest</option>
              <option value="number">Number</option>
              <option value="total">Total</option>
            </select>
          </label>
        </div>
        {error ? <p className="mx-4 mt-3 rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
        {invoices.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="text-base font-medium text-ink">No invoices yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">
              Create the first draft. The number continues from the last invoice, and you can change it before saving.
            </p>
            <button
              type="button"
              onClick={createInvoice}
              disabled={pending}
              className="mt-4 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
            >
              New invoice
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Bill to</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="row-actions px-4 py-3 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted">
                      Nothing matches that search.
                    </td>
                  </tr>
                ) : (
                  visible.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 align-top">
                        <Link href={`/invoices/${invoice.id}`} className="font-medium text-ink hover:text-accent">
                          {invoice.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-top">{invoice.billToName || "—"}</td>
                      <td className="px-4 py-3 align-top">{invoice.issuedOn ? formatDate(invoice.issuedOn) : "—"}</td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        {formatMoney(invoiceTotal(invoice.lines), invoice.currency)}
                      </td>
                      <td className="px-4 py-3 align-top">{INVOICE_STATUS_LABELS[invoice.status]}</td>
                      <td className="row-actions px-4 py-3 align-top text-right">
                        {confirmId === invoice.id ? (
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              disabled={pending}
                              className="font-medium text-danger"
                              onClick={() => {
                                setError("");
                                startTransition(async () => {
                                  const result = await deleteInvoiceAction(invoice.id);
                                  if (!result.ok) setError(result.error);
                                  setConfirmId(null);
                                });
                              }}
                            >
                              Delete
                            </button>
                            <button type="button" className="text-muted" onClick={() => setConfirmId(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="font-medium text-danger"
                            onClick={() => setConfirmId(invoice.id)}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CompanyDialog open={companyOpen} settings={settings} onClose={() => setCompanyOpen(false)} />
      <FieldsDialog
        open={fieldsOpen}
        fields={fields}
        onClose={() => setFieldsOpen(false)}
        suggestions={INVOICE_SUGGESTED_FIELDS}
        description="These fields are added to every invoice. Use them for a quotation, purchase order, or anything else that should print on the page."
        recordNoun="invoice"
        labelPlaceholder="Quotation"
        choicePlaceholder="College, Corporate, Other"
        actions={{
          create: createInvoiceFieldAction,
          update: updateInvoiceFieldAction,
          remove: deleteInvoiceFieldAction,
        }}
      />
    </main>
  );
}
