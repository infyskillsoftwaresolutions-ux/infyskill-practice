"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/lib/invoice-shared";
import { QUOTATION_STATUS_LABELS, type QuotationStatus } from "@/lib/quotation-shared";
import type { DashboardData, DashboardRow } from "@/lib/dashboard";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function inSpan(date: string, mode: "month" | "year", month: string, year: number) {
  if (date.length < 7) return false;
  if (mode === "year") return date.startsWith(`${year}-`);
  return date.startsWith(month);
}

function moneyTotals(rows: DashboardRow[]) {
  let inr = 0;
  let missing = 0;
  const other = new Map<string, number>();
  for (const row of rows) {
    if (row.amount === null) {
      missing += 1;
      continue;
    }
    if (row.currency === "INR") inr += row.amount;
    else other.set(row.currency, (other.get(row.currency) ?? 0) + row.amount);
  }
  return { inr, missing, count: rows.length, other: [...other.entries()] };
}

function periodTitle(mode: "month" | "year", month: string, year: number) {
  if (mode === "year") return String(year);
  const monthIndex = Number(month.slice(5, 7)) - 1;
  return `${MONTHS[monthIndex] ?? month} ${month.slice(0, 4)}`;
}

export function DashboardView({ data, today }: { data: DashboardData; today: string }) {
  const [mode, setMode] = useState<"month" | "year">("month");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, setYear] = useState(Number(today.slice(0, 4)));

  const years = useMemo(() => {
    const found = [data.expenses, data.credits, data.invoices, data.quotations]
      .flat()
      .map((row) => Number(row.date.slice(0, 4)))
      .filter((value) => value > 1900);
    const start = Math.min(year, Number(today.slice(0, 4)), ...(found.length ? found : [year]));
    const end = Math.max(year, Number(today.slice(0, 4)), ...(found.length ? found : [year]));
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [data, today, year]);

  const periodExpenses = data.expenses.filter((row) => inSpan(row.date, mode, month, year));
  const periodCredits = data.credits.filter((row) => inSpan(row.date, mode, month, year));
  const periodInvoices = data.invoices.filter((row) => inSpan(row.date, mode, month, year));
  const periodQuotes = data.quotations.filter((row) => inSpan(row.date, mode, month, year));
  const issued = periodInvoices.filter((row) => row.status === "sent" || row.status === "paid");
  const collected = periodInvoices.filter((row) => row.status === "paid");
  const outstanding = periodInvoices.filter((row) => row.status === "sent");
  const sentQuotes = periodQuotes.filter((row) => row.status === "sent");
  const acceptedQuotes = periodQuotes.filter((row) => row.status === "accepted");

  const expenseMoney = moneyTotals(periodExpenses);
  const creditMoney = moneyTotals(periodCredits);
  const netInr = creditMoney.inr - expenseMoney.inr;
  const netOther = new Map<string, number>();
  for (const [currency, amount] of creditMoney.other) netOther.set(currency, amount);
  for (const [currency, amount] of expenseMoney.other) netOther.set(currency, (netOther.get(currency) ?? 0) - amount);
  const invoicedMoney = moneyTotals(issued);
  const collectedMoney = moneyTotals(collected);
  const outstandingMoney = moneyTotals(outstanding);
  const sentMoney = moneyTotals(sentQuotes);
  const acceptedMoney = moneyTotals(acceptedQuotes);

  const months = MONTHS.map((label, index) => {
    const key = `${year}-${String(index + 1).padStart(2, "0")}`;
    const expenses = data.expenses.filter((row) => row.date.startsWith(key) && row.currency === "INR");
    const credits = data.credits.filter((row) => row.date.startsWith(key) && row.currency === "INR");
    const invoices = data.invoices.filter((row) => row.date.startsWith(key) && row.currency === "INR");
    return {
      key,
      label,
      expenses: expenses.reduce((sum, row) => sum + (row.amount ?? 0), 0),
      credits: credits.reduce((sum, row) => sum + (row.amount ?? 0), 0),
      invoiced: invoices
        .filter((row) => row.status === "sent" || row.status === "paid")
        .reduce((sum, row) => sum + (row.amount ?? 0), 0),
      collected: invoices.filter((row) => row.status === "paid").reduce((sum, row) => sum + (row.amount ?? 0), 0),
    };
  });
  const peak = Math.max(1, ...months.flatMap((item) => [item.expenses, item.credits, item.invoiced, item.collected]));
  const undated =
    data.expenses.filter((row) => !row.date).length +
    data.credits.filter((row) => !row.date).length +
    data.invoices.filter((row) => !row.date).length +
    data.quotations.filter((row) => !row.date).length;

  const drafts = [
    ...data.invoices.filter((row) => row.status === "draft"),
    ...data.quotations.filter((row) => row.status === "draft"),
  ];
  const latestExpenses = [...periodExpenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const latestCredits = [...periodCredits].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const unpaid = [...outstanding].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const waiting = [...sentQuotes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Dashboard</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{periodTitle(mode, month, year)}</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            Expenses, credits, invoices, and quotations follow their dates. Trainer, employee, and college counts are the current file.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("month");
              setMonth(today.slice(0, 7));
              setYear(Number(today.slice(0, 4)));
            }}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${mode === "month" && month === today.slice(0, 7) ? "bg-accent text-white" : "border border-line bg-card text-ink"}`}
          >
            This month
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("year");
              setYear(Number(today.slice(0, 4)));
            }}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${mode === "year" && year === Number(today.slice(0, 4)) ? "bg-accent text-white" : "border border-line bg-card text-ink"}`}
          >
            This year
          </button>
          <input
            type="month"
            value={month}
            aria-label="Choose a month"
            onChange={(event) => {
              const value = event.target.value;
              if (!value) return;
              setMode("month");
              setMonth(value);
              setYear(Number(value.slice(0, 4)));
            }}
            className="rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"
          />
          <select
            aria-label="Choose a year"
            value={year}
            onChange={(event) => {
              const next = Number(event.target.value);
              setYear(next);
              setMonth(`${next}-${month.slice(5, 7)}`);
              setMode("year");
            }}
            className="rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"
          >
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/trainers" className="rounded-2xl border border-line bg-card px-4 py-4 hover:border-accent">
          <p className="text-sm text-muted">Trainers</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{data.trainers.active}</p>
          <p className="mt-1 text-sm text-muted">{data.trainers.total} on file</p>
        </Link>
        <Link href="/payroll" className="rounded-2xl border border-line bg-card px-4 py-4 hover:border-accent">
          <p className="text-sm text-muted">Monthly salary bill</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatMoney(data.employees.monthlySalaryInr, "INR")}</p>
          <p className="mt-1 text-sm text-muted">
            {data.employees.active} active · {data.employees.total} employees. Current, not tied to the month.
          </p>
          {data.employees.hourlyCount > 0 ? (
            <p className="mt-1 text-xs text-muted">{data.employees.hourlyCount} hourly employees are outside this bill.</p>
          ) : null}
          {data.employees.otherPay.map((pay) => (
            <p key={pay.currency} className="mt-1 text-xs text-muted">
              Also {formatMoney(pay.monthly, pay.currency)} a month
            </p>
          ))}
        </Link>
        <Link href="/colleges" className="rounded-2xl border border-line bg-card px-4 py-4 hover:border-accent">
          <p className="text-sm text-muted">Colleges</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{data.colleges.total}</p>
          <p className="mt-1 text-sm text-muted">{data.colleges.programs} programs</p>
        </Link>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MoneyCard href="/expenses" label="Expenses" total={expenseMoney} hint={`${expenseMoney.count} recorded`} />
        <MoneyCard href="/credits" label="Credits" total={creditMoney} hint={`${creditMoney.count} received`} />
        <article className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">Credits minus expenses</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatMoney(netInr, "INR")}</p>
          <p className="mt-1 text-sm text-muted">Rupee totals for this period</p>
          {[...netOther.entries()].map(([currency, amount]) => (
            <p key={currency} className="mt-1 text-xs text-muted">
              Also {formatMoney(amount, currency)}
            </p>
          ))}
        </article>
        <MoneyCard href="/invoices" label="Invoiced" total={invoicedMoney} hint="Sent and paid" />
        <MoneyCard href="/invoices" label="Collected" total={collectedMoney} hint="Paid invoices" />
        <MoneyCard href="/invoices" label="Outstanding" total={outstandingMoney} hint="Sent, not paid" />
      </section>

      <Link href="/quotations" className="block rounded-2xl border border-line bg-card px-4 py-4 hover:border-accent">
        <p className="text-sm text-muted">Quotations</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-ink">Sent</p>
            <p className="mt-1 text-xl font-semibold text-ink">{formatMoney(sentMoney.inr, "INR")}</p>
            <p className="text-sm text-muted">{sentMoney.count} quotes</p>
          </div>
          <div>
            <p className="text-sm font-medium text-ink">Accepted</p>
            <p className="mt-1 text-xl font-semibold text-ink">{formatMoney(acceptedMoney.inr, "INR")}</p>
            <p className="text-sm text-muted">{acceptedMoney.count} quotes</p>
            {acceptedMoney.missing > 0 ? (
              <p className="text-xs text-muted">{acceptedMoney.missing} without a total</p>
            ) : null}
          </div>
        </div>
      </Link>

      <section className="rounded-2xl border border-line bg-card px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">{year} by month</h2>
            <p className="mt-1 text-sm text-muted">₹ expenses, credits, invoiced, and collected.</p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-money" /> Expenses</span>
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#1f7a4d]" /> Credits</span>
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-accent" /> Invoiced</span>
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-ink" /> Collected</span>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-12 gap-2">
            {months.map((item) => {
              const selected = mode === "month" && item.key === month;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setMode("month");
                    setMonth(item.key);
                  }}
                  className={`rounded-lg px-1 py-2 text-center ${selected ? "bg-accent-soft" : "hover:bg-background"}`}
                >
                  <div className="flex h-28 items-end justify-center gap-1">
                    <Bar value={item.expenses} peak={peak} className="bg-money" label={`${item.label} expenses ${formatMoney(item.expenses, "INR")}`} />
                    <Bar value={item.credits} peak={peak} className="bg-[#1f7a4d]" label={`${item.label} credits ${formatMoney(item.credits, "INR")}`} />
                    <Bar value={item.invoiced} peak={peak} className="bg-accent" label={`${item.label} invoiced ${formatMoney(item.invoiced, "INR")}`} />
                    <Bar value={item.collected} peak={peak} className="bg-ink" label={`${item.label} collected ${formatMoney(item.collected, "INR")}`} />
                  </div>
                  <p className="mt-2 text-xs text-muted">{item.label}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {undated > 0 ? (
        <p className="text-sm text-muted">{undated} records have no date, so they stay out of these totals.</p>
      ) : null}

      {drafts.length > 0 ? (
        <section className="rounded-2xl border border-line bg-card px-4 py-4">
          <h2 className="text-sm font-semibold text-ink">Still in draft</h2>
          <p className="mt-1 text-sm text-muted">These stay here until you mark them sent, paid, or accepted.</p>
          <ul className="mt-3 divide-y divide-line">
            {drafts.map((row) => (
              <li key={row.href} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <Link href={row.href} className="font-medium text-ink hover:text-accent">
                  {row.href.startsWith("/invoices") ? "Invoice" : "Quotation"} {row.title}
                </Link>
                <span className="text-sm text-muted">{[row.subtitle, row.date ? formatDate(row.date) : ""].filter(Boolean).join(" · ") || "Draft"}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <RecordList title="Latest expenses" rows={latestExpenses} empty="No expenses in this period." />
        <RecordList title="Latest credits" rows={latestCredits} empty="No credits in this period." />
        <RecordList title="Unpaid invoices" rows={unpaid} empty="No unpaid invoices in this period." statusKind="invoice" />
        <RecordList title="Quotations waiting" rows={waiting} empty="No sent quotations in this period." statusKind="quotation" />
      </section>
    </main>
  );
}

function MoneyCard({
  href,
  label,
  total,
  hint,
}: {
  href: string;
  label: string;
  total: ReturnType<typeof moneyTotals>;
  hint: string;
}) {
  return (
    <Link href={href} className="rounded-2xl border border-line bg-card px-4 py-4 hover:border-accent">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{formatMoney(total.inr, "INR")}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      {total.other.map(([currency, amount]) => (
        <p key={currency} className="mt-1 text-xs text-muted">
          Also {formatMoney(amount, currency)}
        </p>
      ))}
    </Link>
  );
}

function Bar({ value, peak, className, label }: { value: number; peak: number; className: string; label: string }) {
  const height = value <= 0 ? 2 : Math.max(8, Math.round((value / peak) * 112));
  return <span title={label} className={`w-2 rounded-sm ${className}`} style={{ height }} />;
}

function RecordList({
  title,
  rows,
  empty,
  statusKind,
}: {
  title: string;
  rows: DashboardRow[];
  empty: string;
  statusKind?: "invoice" | "quotation";
}) {
  return (
    <article className="rounded-2xl border border-line bg-card px-4 py-4">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {rows.map((row) => (
            <li key={`${row.href}-${row.id}`} className="py-2">
              <Link href={row.href} className="font-medium text-ink hover:text-accent">
                {row.title}
              </Link>
              <p className="text-sm text-muted">
                {[row.subtitle, row.date ? formatDate(row.date) : "", row.amount === null ? "" : formatMoney(row.amount, row.currency)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {statusKind === "invoice" && row.status ? (
                <p className="text-xs text-muted">{INVOICE_STATUS_LABELS[row.status as InvoiceStatus]}</p>
              ) : null}
              {statusKind === "quotation" && row.status ? (
                <p className="text-xs text-muted">{QUOTATION_STATUS_LABELS[row.status as QuotationStatus]}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
