"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createCreditFieldAction,
  deleteCreditAction,
  deleteCreditFieldAction,
  updateCreditFieldAction,
} from "@/app/actions/credits";
import { CreditDialog, type CreditCollegeOption, type CreditInvoiceOption } from "@/components/credits/credit-dialog";
import { FieldsDialog } from "@/components/payroll/fields-dialog";
import { CREDIT_SUGGESTED_FIELDS } from "@/lib/credit-suggestions";
import type { Credit } from "@/lib/credits";
import { formatDate, formatMoney } from "@/lib/format";
import type { CustomValue, FieldDefinition } from "@/lib/payroll-types";

type SortKey = "newest" | "amount" | "from";

function displayCustom(field: FieldDefinition, value: CustomValue | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field.type === "number" && typeof value === "number") {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
  }
  if (field.type === "date" && typeof value === "string") return formatDate(value) || value;
  return String(value);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(month: string) {
  const index = Number(month.slice(5, 7)) - 1;
  return `${MONTHS[index] ?? month} ${month.slice(0, 4)}`;
}

function amountTotals(credits: Credit[]) {
  const totals = new Map<string, number>();
  for (const credit of credits) {
    totals.set(credit.currency, (totals.get(credit.currency) ?? 0) + credit.amount);
  }
  return [...totals.entries()];
}

export function CreditsWorkspace({
  credits,
  fields,
  colleges,
  invoices,
  editId = "",
}: {
  credits: Credit[];
  fields: FieldDefinition[];
  colleges: CreditCollegeOption[];
  invoices: CreditInvoiceOption[];
  editId?: string;
}) {
  const router = useRouter();
  const opening = credits.find((credit) => credit.id === editId) ?? null;
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [formOpen, setFormOpen] = useState(Boolean(opening));
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [editing, setEditing] = useState<Credit | null>(opening);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const collegeName = useMemo(() => new Map(colleges.map((college) => [college.id, college.name])), [colleges]);
  const invoiceById = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices]);
  const scoped = useMemo(
    () => (month ? credits.filter((credit) => credit.receivedOn.startsWith(month)) : credits),
    [credits, month],
  );
  const totals = amountTotals(scoped);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = scoped.filter((credit) => {
      if (!needle) return true;
      const custom = Object.values(credit.customFields)
        .map((value) => (value === null || value === undefined ? "" : String(value)))
        .join(" ");
      const invoice = invoiceById.get(credit.invoiceId);
      return [credit.fromName, collegeName.get(credit.collegeId) ?? "", credit.notes, invoice?.number ?? "", custom]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    return filtered.sort((a, b) => {
      if (sort === "amount") return b.amount - a.amount;
      if (sort === "from") return a.fromName.localeCompare(b.fromName, undefined, { sensitivity: "base" });
      const aDate = a.receivedOn || a.createdAt;
      const bDate = b.receivedOn || b.createdAt;
      return bDate.localeCompare(aDate);
    });
  }, [scoped, query, sort, collegeName, invoiceById]);

  function sourceLabel(credit: Credit) {
    return collegeName.get(credit.collegeId) || credit.fromName;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Credits</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Money received</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            Record advances, cash, and other income. Link a college or an invoice when the money belongs to one.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFieldsOpen(true)}
            className="rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-medium text-ink hover:bg-background"
          >
            Custom fields
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0]"
          >
            Add credit
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">Credits</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{credits.length}</p>
        </article>
        <article className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">{month ? `Total in ${monthLabel(month)}` : "Total received"}</p>
          {totals.length === 0 ? (
            <p className="mt-1 text-lg font-semibold text-ink">—</p>
          ) : (
            <div className="mt-1 space-y-1">
              {totals.map(([currency, amount]) => (
                <p key={currency} className="text-lg font-semibold text-ink">
                  {formatMoney(amount, currency)}
                </p>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-line bg-card">
        <div className="flex flex-col flex-wrap gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, notes, invoice, or a custom field"
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent sm:max-w-md"
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            Month
            <input
              type="month"
              value={month}
              aria-label="Filter by month"
              onChange={(event) => setMonth(event.target.value)}
              className="rounded-lg border border-line bg-background px-2 py-2 text-sm text-ink"
            />
          </label>
          {month ? (
            <button type="button" className="text-sm font-medium text-accent" onClick={() => setMonth("")}>
              All dates
            </button>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-muted">
            Sort
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="rounded-lg border border-line bg-background px-2 py-2 text-sm text-ink"
            >
              <option value="newest">Newest</option>
              <option value="amount">Amount</option>
              <option value="from">Name</option>
            </select>
          </label>
        </div>
        {error ? <p className="mx-4 mt-3 rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
        {credits.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="text-base font-medium text-ink">No credits yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">
              Add the first amount received. Custom fields are included on the form and in this table.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="mt-4 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0]"
            >
              Add credit
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-medium">From</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  {fields.map((field) => (
                    <th key={field.id} className="px-4 py-3 font-medium">
                      {field.label}
                    </th>
                  ))}
                  <th className="row-actions px-4 py-3 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={5 + fields.length} className="px-4 py-10 text-center text-muted">
                      Nothing matches that search.
                    </td>
                  </tr>
                ) : (
                  visible.map((credit) => {
                    const invoice = invoiceById.get(credit.invoiceId);
                    const college = collegeName.get(credit.collegeId);
                    return (
                      <tr key={credit.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 align-top">
                          <p className="font-medium text-ink">{sourceLabel(credit)}</p>
                          {college && college !== credit.fromName ? (
                            <p className="text-xs text-muted">{credit.fromName}</p>
                          ) : null}
                          {credit.notes ? <p className="text-xs text-muted">{credit.notes}</p> : null}
                        </td>
                        <td className="px-4 py-3 align-top font-medium whitespace-nowrap text-ink">
                          {formatMoney(credit.amount, credit.currency)}
                        </td>
                        <td className="px-4 py-3 align-top">{credit.receivedOn ? formatDate(credit.receivedOn) : "—"}</td>
                        <td className="px-4 py-3 align-top">
                          {invoice ? (
                            <Link href={`/invoices/${invoice.id}`} className="font-medium text-accent">
                              {invoice.number}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        {fields.map((field) => (
                          <td key={field.id} className="max-w-48 px-4 py-3 align-top">
                            {displayCustom(field, credit.customFields[field.key])}
                          </td>
                        ))}
                        <td className="row-actions px-4 py-3 align-top text-right">
                          {confirmId === credit.id ? (
                            <div className="flex justify-end gap-3">
                              <button
                                type="button"
                                disabled={pending}
                                className="font-medium text-danger"
                                onClick={() => {
                                  setError("");
                                  startTransition(async () => {
                                    const result = await deleteCreditAction(credit.id);
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
                            <div className="flex justify-end gap-3">
                              <button
                                type="button"
                                className="font-medium text-accent"
                                onClick={() => {
                                  setEditing(credit);
                                  setConfirmId(null);
                                  setFormOpen(true);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="font-medium text-danger"
                                onClick={() => setConfirmId(credit.id)}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CreditDialog
        open={formOpen}
        credit={editing}
        fields={fields}
        colleges={colleges}
        invoices={invoices}
        onClose={() => {
          setFormOpen(false);
          if (editId) router.replace("/credits");
        }}
      />
      <FieldsDialog
        open={fieldsOpen}
        fields={fields}
        onClose={() => setFieldsOpen(false)}
        suggestions={CREDIT_SUGGESTED_FIELDS}
        description="These fields are added to every credit. The stored key stays the same if you rename a label, so existing answers keep working."
        recordNoun="credit"
        labelPlaceholder="Reference"
        choicePlaceholder="Cash, UPI, Bank"
        actions={{
          create: createCreditFieldAction,
          update: updateCreditFieldAction,
          remove: deleteCreditFieldAction,
        }}
      />
    </main>
  );
}
