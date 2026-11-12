"use client";

import { useEffect, useState, useTransition } from "react";
import { saveExpenseAction } from "@/app/actions/expenses";
import { Dialog } from "@/components/dialog";
import type { Expense } from "@/lib/expenses";
import {
  CURRENCIES,
  type CurrencyCode,
  type CustomValue,
  type FieldDefinition,
} from "@/lib/payroll-types";

type Draft = {
  description: string;
  cost: string;
  currency: CurrencyCode;
  spentOn: string;
  notes: string;
  customFields: Record<string, string | boolean>;
};

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium text-ink";

function emptyCustom(fields: FieldDefinition[]) {
  const customFields: Record<string, string | boolean> = {};
  for (const field of fields) customFields[field.key] = field.type === "boolean" ? false : "";
  return customFields;
}

function draftFromExpense(expense: Expense, fields: FieldDefinition[]): Draft {
  const customFields = emptyCustom(fields);
  for (const field of fields) {
    const value = expense.customFields[field.key];
    if (field.type === "boolean") customFields[field.key] = value === true;
    else if (value === null || value === undefined) customFields[field.key] = "";
    else customFields[field.key] = String(value);
  }
  return {
    description: expense.description,
    cost: String(expense.cost),
    currency: expense.currency,
    spentOn: expense.spentOn,
    notes: expense.notes,
    customFields,
  };
}

function blankDraft(fields: FieldDefinition[]): Draft {
  return {
    description: "",
    cost: "",
    currency: "INR",
    spentOn: "",
    notes: "",
    customFields: emptyCustom(fields),
  };
}

export function ExpenseDialog({
  open,
  expense,
  fields,
  onClose,
}: {
  open: boolean;
  expense: Expense | null;
  fields: FieldDefinition[];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => blankDraft(fields));
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError("");
    setDraft(expense ? draftFromExpense(expense, fields) : blankDraft(fields));
  }, [open, expense?.id]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateCustom(key: string, value: string | boolean) {
    setDraft((current) => ({
      ...current,
      customFields: { ...current.customFields, [key]: value },
    }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const cost = Number(draft.cost);
    if (draft.cost.trim() === "" || !Number.isFinite(cost)) {
      setError("Cost must be a number that is zero or greater.");
      return;
    }
    const customFields: Record<string, CustomValue> = {};
    for (const field of fields) {
      const value = draft.customFields[field.key];
      if (field.type === "boolean") customFields[field.key] = value === true;
      else if (field.type === "number") {
        customFields[field.key] = typeof value === "string" && value.trim() === "" ? null : Number(value);
      } else customFields[field.key] = typeof value === "string" ? value : null;
    }
    setError("");
    startTransition(async () => {
      const result = await saveExpenseAction(expense?.id ?? null, { ...draft, cost, customFields });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={expense ? "Edit expense" : "Add expense"}
      description="Description and cost are required. Custom fields you created appear below."
    >
      <form onSubmit={submit} className="grid gap-4">
        {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
        <label>
          <span className={labelClass}>Description</span>
          <input
            className={inputClass}
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            required
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Cost</span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={draft.cost}
              onChange={(event) => update("cost", event.target.value)}
              required
            />
          </label>
          <label>
            <span className={labelClass}>Currency</span>
            <select
              className={inputClass}
              value={draft.currency}
              onChange={(event) => update("currency", event.target.value as CurrencyCode)}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Date</span>
            <input
              className={inputClass}
              type="date"
              value={draft.spentOn}
              onChange={(event) => update("spentOn", event.target.value)}
            />
          </label>
        </div>
        <label>
          <span className={labelClass}>Notes</span>
          <textarea
            className={`${inputClass} min-h-20 resize-y`}
            value={draft.notes}
            onChange={(event) => update("notes", event.target.value)}
          />
        </label>
        <section className="rounded-xl border border-line bg-background p-4">
          <h3 className="text-sm font-semibold text-ink">Custom fields</h3>
          {fields.length === 0 ? (
            <p className="mt-1 text-sm leading-6 text-muted">
              None yet. Use Custom fields on the expenses page, then they show up on every expense.
            </p>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {fields.map((field) => {
                const value = draft.customFields[field.key];
                const fieldLabel = (
                  <span className={labelClass}>
                    {field.label}
                    {field.required ? <span className="text-danger"> *</span> : null}
                  </span>
                );
                if (field.type === "boolean") {
                  return (
                    <label key={field.id} className="flex items-center gap-2 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={value === true}
                        onChange={(event) => updateCustom(field.key, event.target.checked)}
                      />
                      <span className="text-sm text-ink">
                        {field.label}
                        {field.required ? " (required)" : ""}
                      </span>
                    </label>
                  );
                }
                if (field.type === "select") {
                  const current = typeof value === "string" ? value : "";
                  const options =
                    current && !field.options.includes(current) ? [current, ...field.options] : field.options;
                  return (
                    <label key={field.id}>
                      {fieldLabel}
                      <select
                        className={inputClass}
                        value={current}
                        required={field.required}
                        onChange={(event) => updateCustom(field.key, event.target.value)}
                      >
                        <option value="">Select</option>
                        {options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }
                return (
                  <label key={field.id}>
                    {fieldLabel}
                    <input
                      className={inputClass}
                      type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                      step={field.type === "number" ? "any" : undefined}
                      required={field.required}
                      value={typeof value === "string" ? value : ""}
                      onChange={(event) => updateCustom(field.key, event.target.value)}
                    />
                  </label>
                );
              })}
            </div>
          )}
        </section>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line bg-background px-3.5 py-2 text-sm font-medium text-ink hover:bg-background"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save expense"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
