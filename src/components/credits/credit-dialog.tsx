"use client";

import { useEffect, useState, useTransition } from "react";
import { saveCreditAction } from "@/app/actions/credits";
import { Dialog } from "@/components/dialog";
import type { Credit } from "@/lib/credits";
import {
  CURRENCIES,
  type CurrencyCode,
  type CustomValue,
  type FieldDefinition,
} from "@/lib/payroll-types";

export type CreditCollegeOption = { id: string; name: string };
export type CreditInvoiceOption = { id: string; number: string; name: string };

type Draft = {
  fromName: string;
  collegeId: string;
  invoiceId: string;
  amount: string;
  currency: CurrencyCode;
  receivedOn: string;
  notes: string;
  customFields: Record<string, string | boolean>;
};

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium text-ink";

function todayStamp() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function emptyCustom(fields: FieldDefinition[]) {
  const customFields: Record<string, string | boolean> = {};
  for (const field of fields) customFields[field.key] = field.type === "boolean" ? false : "";
  return customFields;
}

function draftFromCredit(credit: Credit, fields: FieldDefinition[]): Draft {
  const customFields = emptyCustom(fields);
  for (const field of fields) {
    const value = credit.customFields[field.key];
    if (field.type === "boolean") customFields[field.key] = value === true;
    else if (value === null || value === undefined) customFields[field.key] = "";
    else customFields[field.key] = String(value);
  }
  return {
    fromName: credit.fromName,
    collegeId: credit.collegeId,
    invoiceId: credit.invoiceId,
    amount: String(credit.amount),
    currency: credit.currency,
    receivedOn: credit.receivedOn,
    notes: credit.notes,
    customFields,
  };
}

function blankDraft(fields: FieldDefinition[]): Draft {
  return {
    fromName: "",
    collegeId: "",
    invoiceId: "",
    amount: "",
    currency: "INR",
    receivedOn: todayStamp(),
    notes: "",
    customFields: emptyCustom(fields),
  };
}

export function CreditDialog({
  open,
  credit,
  fields,
  colleges,
  invoices,
  onClose,
}: {
  open: boolean;
  credit: Credit | null;
  fields: FieldDefinition[];
  colleges: CreditCollegeOption[];
  invoices: CreditInvoiceOption[];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => blankDraft(fields));
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError("");
    setDraft(credit ? draftFromCredit(credit, fields) : blankDraft(fields));
  }, [open, credit?.id]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function chooseCollege(collegeId: string) {
    const college = colleges.find((item) => item.id === collegeId);
    setDraft((current) => ({
      ...current,
      collegeId,
      fromName: college ? college.name : current.fromName,
    }));
  }

  function updateCustom(key: string, value: string | boolean) {
    setDraft((current) => ({
      ...current,
      customFields: { ...current.customFields, [key]: value },
    }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(draft.amount);
    if (draft.amount.trim() === "" || !Number.isFinite(amount)) {
      setError("Amount must be a number that is zero or greater.");
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
      const result = await saveCreditAction(credit?.id ?? null, { ...draft, amount, customFields });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  const collegeMissing = draft.collegeId && !colleges.some((college) => college.id === draft.collegeId);
  const invoiceMissing = draft.invoiceId && !invoices.some((invoice) => invoice.id === draft.invoiceId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={credit ? "Edit credit" : "Add credit"}
      description="Who paid, and how much. A college or an invoice is optional."
    >
      <form onSubmit={submit} className="grid gap-4">
        {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
        <label>
          <span className={labelClass}>College</span>
          <select className={inputClass} value={draft.collegeId} onChange={(event) => chooseCollege(event.target.value)}>
            <option value="">Not a college</option>
            {collegeMissing ? <option value={draft.collegeId}>College no longer on file</option> : null}
            {colleges.map((college) => (
              <option key={college.id} value={college.id}>
                {college.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelClass}>Received from</span>
          <input
            className={inputClass}
            value={draft.fromName}
            onChange={(event) => update("fromName", event.target.value)}
            required
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Amount</span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={draft.amount}
              onChange={(event) => update("amount", event.target.value)}
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
          <label>
            <span className={labelClass}>Date received</span>
            <input
              className={inputClass}
              type="date"
              value={draft.receivedOn}
              onChange={(event) => update("receivedOn", event.target.value)}
            />
          </label>
          <label>
            <span className={labelClass}>Invoice</span>
            <select className={inputClass} value={draft.invoiceId} onChange={(event) => update("invoiceId", event.target.value)}>
              <option value="">None</option>
              {invoiceMissing ? <option value={draft.invoiceId}>Invoice no longer on file</option> : null}
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.number}
                  {invoice.name ? ` · ${invoice.name}` : ""}
                </option>
              ))}
            </select>
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
              None yet. Use Custom fields on the credits page, then they show up on every credit.
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
            {pending ? "Saving…" : "Save credit"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
