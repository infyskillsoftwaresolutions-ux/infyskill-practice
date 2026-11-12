"use client";

import type { FieldDefinition } from "@/lib/payroll-types";

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium text-ink";

export function CustomFieldInputs({
  fields,
  values,
  onChange,
  emptyText,
}: {
  fields: FieldDefinition[];
  values: Record<string, string | boolean>;
  onChange: (key: string, value: string | boolean) => void;
  emptyText: string;
}) {
  if (fields.length === 0) {
    return <p className="text-sm leading-6 text-muted">{emptyText}</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => {
        const value = values[field.key];
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
                onChange={(event) => onChange(field.key, event.target.checked)}
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
          const options = current && !field.options.includes(current) ? [current, ...field.options] : field.options;
          return (
            <label key={field.id}>
              {fieldLabel}
              <select
                className={inputClass}
                value={current}
                required={field.required}
                onChange={(event) => onChange(field.key, event.target.value)}
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
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          </label>
        );
      })}
    </div>
  );
}

export function valuesFromCustom(
  fields: FieldDefinition[],
  stored: Record<string, string | number | boolean | null>,
) {
  const values: Record<string, string | boolean> = {};
  for (const field of fields) {
    const value = stored[field.key];
    if (field.type === "boolean") values[field.key] = value === true;
    else if (value === null || value === undefined) values[field.key] = "";
    else values[field.key] = String(value);
  }
  return values;
}

export function customPayload(fields: FieldDefinition[], values: Record<string, string | boolean>) {
  const customFields: Record<string, string | number | boolean | null> = {};
  for (const field of fields) {
    const value = values[field.key];
    if (field.type === "boolean") customFields[field.key] = value === true;
    else if (field.type === "number") {
      customFields[field.key] = typeof value === "string" && value.trim() === "" ? null : Number(value);
    } else customFields[field.key] = typeof value === "string" ? value : null;
  }
  return customFields;
}
