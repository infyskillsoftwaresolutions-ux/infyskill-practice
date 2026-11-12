"use client";

import { useEffect, useState, useTransition } from "react";
import { saveEmployeeAction } from "@/app/actions/payroll";
import { Dialog } from "@/components/dialog";
import {
  CURRENCIES,
  EMPLOYEE_STATUSES,
  PAY_FREQUENCIES,
  PAY_FREQUENCY_LABELS,
  type CurrencyCode,
  type CustomValue,
  type Employee,
  type EmployeeStatus,
  type FieldDefinition,
  type PayFrequency,
} from "@/lib/payroll-types";

type Draft = {
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  salary: string;
  currency: CurrencyCode;
  payFrequency: PayFrequency;
  status: EmployeeStatus;
  hiredOn: string;
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

function draftFromEmployee(employee: Employee, fields: FieldDefinition[]): Draft {
  const customFields = emptyCustom(fields);
  for (const field of fields) {
    const value = employee.customFields[field.key];
    if (field.type === "boolean") customFields[field.key] = value === true;
    else if (value === null || value === undefined) customFields[field.key] = "";
    else customFields[field.key] = String(value);
  }
  return {
    fullName: employee.fullName,
    email: employee.email,
    phone: employee.phone,
    jobTitle: employee.jobTitle,
    department: employee.department,
    salary: String(employee.salary),
    currency: employee.currency,
    payFrequency: employee.payFrequency,
    status: employee.status,
    hiredOn: employee.hiredOn,
    notes: employee.notes,
    customFields,
  };
}

function blankDraft(fields: FieldDefinition[]): Draft {
  return {
    fullName: "",
    email: "",
    phone: "",
    jobTitle: "",
    department: "",
    salary: "",
    currency: "INR",
    payFrequency: "monthly",
    status: "active",
    hiredOn: "",
    notes: "",
    customFields: emptyCustom(fields),
  };
}

export function EmployeeDialog({
  open,
  employee,
  fields,
  onClose,
}: {
  open: boolean;
  employee: Employee | null;
  fields: FieldDefinition[];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => blankDraft(fields));
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError("");
    setDraft(employee ? draftFromEmployee(employee, fields) : blankDraft(fields));
    // Reset only when the dialog opens or a different person is selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee?.id]);

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
    setError("");
    const salary = Number(draft.salary);
    if (draft.salary.trim() === "" || !Number.isFinite(salary)) {
      setError("Salary must be a number that is zero or greater.");
      return;
    }
    const customFields: Record<string, CustomValue> = {};
    for (const field of fields) {
      const value = draft.customFields[field.key];
      if (field.type === "boolean") customFields[field.key] = value === true;
      else if (field.type === "number") {
        if (typeof value === "string" && value.trim() === "") customFields[field.key] = null;
        else customFields[field.key] = Number(value);
      } else customFields[field.key] = typeof value === "string" ? value : null;
    }

    startTransition(async () => {
      const result = await saveEmployeeAction(employee?.id ?? null, {
        ...draft,
        salary,
        customFields,
      });
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
      title={employee ? "Edit employee" : "Add employee"}
      description="Name and salary are required. Custom fields you created appear below."
    >
      <form onSubmit={submit} className="grid gap-4">
        {error ? (
          <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p>
        ) : null}
        <label className="sm:col-span-2">
          <span className={labelClass}>Full name</span>
          <input
            className={inputClass}
            value={draft.fullName}
            onChange={(event) => update("fullName", event.target.value)}
            required
            autoFocus
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Email</span>
            <input
              className={inputClass}
              type="email"
              value={draft.email}
              onChange={(event) => update("email", event.target.value)}
            />
          </label>
          <label>
            <span className={labelClass}>Phone</span>
            <input
              className={inputClass}
              value={draft.phone}
              onChange={(event) => update("phone", event.target.value)}
            />
          </label>
          <label>
            <span className={labelClass}>Job title</span>
            <input
              className={inputClass}
              value={draft.jobTitle}
              onChange={(event) => update("jobTitle", event.target.value)}
            />
          </label>
          <label>
            <span className={labelClass}>Department</span>
            <input
              className={inputClass}
              value={draft.department}
              onChange={(event) => update("department", event.target.value)}
            />
          </label>
          <label>
            <span className={labelClass}>Salary</span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={draft.salary}
              onChange={(event) => update("salary", event.target.value)}
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
            <span className={labelClass}>Paid</span>
            <select
              className={inputClass}
              value={draft.payFrequency}
              onChange={(event) => update("payFrequency", event.target.value as PayFrequency)}
            >
              {PAY_FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {PAY_FREQUENCY_LABELS[frequency]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Status</span>
            <select
              className={inputClass}
              value={draft.status}
              onChange={(event) => update("status", event.target.value as EmployeeStatus)}
            >
              {EMPLOYEE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status === "active" ? "Active" : "Inactive"}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Start date</span>
            <input
              className={inputClass}
              type="date"
              value={draft.hiredOn}
              onChange={(event) => update("hiredOn", event.target.value)}
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
              None yet. Use Custom fields on the payroll page, then they show up on every employee.
            </p>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {fields.map((field) => {
                const value = draft.customFields[field.key];
                const label = (
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
                    current && !field.options.includes(current)
                      ? [current, ...field.options]
                      : field.options;
                  return (
                    <label key={field.id}>
                      {label}
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
                    {label}
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
            {pending ? "Saving…" : "Save employee"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
