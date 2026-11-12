"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createExpenseFieldAction,
  deleteExpenseAction,
  deleteExpenseFieldAction,
  updateExpenseFieldAction,
} from "@/app/actions/expenses";
import { ExpenseDialog } from "@/components/expenses/expense-dialog";
import { FieldsDialog } from "@/components/payroll/fields-dialog";
import type { Expense } from "@/lib/expenses";
import { EXPENSE_SUGGESTED_FIELDS } from "@/lib/expense-suggestions";
import { formatDate, formatMoney } from "@/lib/format";
import type { CustomValue, FieldDefinition } from "@/lib/payroll-types";

type SortKey = "newest" | "cost" | "description";

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

function costTotals(expenses: Expense[]) {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    totals.set(expense.currency, (totals.get(expense.currency) ?? 0) + expense.cost);
  }
  return [...totals.entries()];
}

export function ExpensesWorkspace({
  expenses,
  fields,
  editId = "",
}: {
  expenses: Expense[];
  fields: FieldDefinition[];
  editId?: string;
}) {
  const router = useRouter();
  const opening = expenses.find((expense) => expense.id === editId) ?? null;
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [formOpen, setFormOpen] = useState(Boolean(opening));
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(opening);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const scoped = useMemo(
    () => (month ? expenses.filter((expense) => expense.spentOn.startsWith(month)) : expenses),
    [expenses, month],
  );
  const totals = costTotals(scoped);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = scoped.filter((expense) => {
      if (!needle) return true;
      const custom = Object.values(expense.customFields)
        .map((value) => (value === null || value === undefined ? "" : String(value)))
        .join(" ");
      return [expense.description, expense.notes, expense.spentOn, custom]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    return filtered.sort((a, b) => {
      if (sort === "cost") return b.cost - a.cost;
      if (sort === "description") return a.description.localeCompare(b.description, undefined, { sensitivity: "base" });
      const aDate = a.spentOn || a.createdAt;
      const bDate = b.spentOn || b.createdAt;
      return bDate.localeCompare(aDate);
    });
  }, [scoped, query, sort]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Expenses</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Costs and descriptions</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            Record what was spent. Add your own fields when description and cost are not enough.
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
            Add expense
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">Expenses</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{expenses.length}</p>
        </article>
        <article className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">{month ? `Total in ${monthLabel(month)}` : "Total cost"}</p>
          {totals.length === 0 ? (
            <p className="mt-1 text-lg font-semibold text-ink">—</p>
          ) : (
            <div className="mt-1 space-y-1">
              {totals.map(([currency, amount]) => (
                <p key={currency} className="text-lg font-semibold text-money">
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
            placeholder="Search description, notes, or a custom field"
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
              <option value="cost">Cost</option>
              <option value="description">Description</option>
            </select>
          </label>
        </div>
        {error ? <p className="mx-4 mt-3 rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
        {expenses.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="text-base font-medium text-ink">No expenses yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">
              Add the first cost and a short description. Custom fields are included on the form and in this table.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="mt-4 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0]"
            >
              Add expense
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Cost</th>
                  <th className="px-4 py-3 font-medium">Date</th>
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
                    <td colSpan={4 + fields.length} className="px-4 py-10 text-center text-muted">
                      Nothing matches that search.
                    </td>
                  </tr>
                ) : (
                  visible.map((expense) => (
                    <tr key={expense.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium text-ink">{expense.description}</p>
                        {expense.notes ? <p className="text-xs text-muted">{expense.notes}</p> : null}
                      </td>
                      <td className="px-4 py-3 align-top font-medium whitespace-nowrap text-ink">
                        {formatMoney(expense.cost, expense.currency)}
                      </td>
                      <td className="px-4 py-3 align-top">{expense.spentOn ? formatDate(expense.spentOn) : "—"}</td>
                      {fields.map((field) => (
                        <td key={field.id} className="max-w-48 px-4 py-3 align-top">
                          {displayCustom(field, expense.customFields[field.key])}
                        </td>
                      ))}
                      <td className="row-actions px-4 py-3 align-top text-right">
                        {confirmId === expense.id ? (
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              disabled={pending}
                              className="font-medium text-danger"
                              onClick={() => {
                                setError("");
                                startTransition(async () => {
                                  const result = await deleteExpenseAction(expense.id);
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
                                setEditing(expense);
                                setConfirmId(null);
                                setFormOpen(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="font-medium text-danger"
                              onClick={() => setConfirmId(expense.id)}
                            >
                              Delete
                            </button>
                          </div>
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

      <ExpenseDialog
        open={formOpen}
        expense={editing}
        fields={fields}
        onClose={() => {
          setFormOpen(false);
          if (editId) router.replace("/expenses");
        }}
      />
      <FieldsDialog
        open={fieldsOpen}
        fields={fields}
        onClose={() => setFieldsOpen(false)}
        suggestions={EXPENSE_SUGGESTED_FIELDS}
        description="These fields are added to every expense. The stored key stays the same if you rename a label, so existing answers keep working."
        recordNoun="expense"
        labelPlaceholder="Vendor"
        choicePlaceholder="Travel, Supplies, Rent"
        actions={{
          create: createExpenseFieldAction,
          update: updateExpenseFieldAction,
          remove: deleteExpenseFieldAction,
        }}
      />
    </main>
  );
}
