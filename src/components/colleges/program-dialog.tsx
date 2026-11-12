"use client";

import { useEffect, useState, useTransition } from "react";
import { saveProgramAction } from "@/app/actions/colleges";
import { customPayload, CustomFieldInputs, valuesFromCustom } from "@/components/colleges/custom-field-inputs";
import { Dialog } from "@/components/dialog";
import type { CollegeProgram } from "@/lib/colleges";
import { CURRENCIES, type CurrencyCode, type FieldDefinition } from "@/lib/payroll-types";

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium text-ink";

export function ProgramDialog({
  open,
  collegeId,
  program,
  fields,
  onClose,
}: {
  open: boolean;
  collegeId: string;
  program: CollegeProgram | null;
  fields: FieldDefinition[];
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("INR");
  const [customFields, setCustomFields] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError("");
    setName(program?.name ?? "");
    setPrice(program ? String(program.price) : "");
    setCurrency(program?.currency ?? "INR");
    setCustomFields(valuesFromCustom(fields, program?.customFields ?? {}));
  }, [open, program?.id]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(price);
    if (price.trim() === "" || !Number.isFinite(amount) || amount < 0) {
      setError("Price must be a number that is zero or greater.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await saveProgramAction(collegeId, program?.id ?? null, {
        name,
        price: amount,
        currency,
        customFields: customPayload(fields, customFields),
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
      title={program ? "Edit program" : "Add program"}
      description="Program name and price are required. Custom fields you created for programs appear below."
    >
      <form onSubmit={submit} className="grid gap-4">
        {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
        <label>
          <span className={labelClass}>Program name</span>
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Price</span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
            />
          </label>
          <label>
            <span className={labelClass}>Currency</span>
            <select
              className={inputClass}
              value={currency}
              onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
        </div>
        <section className="rounded-xl border border-line bg-background p-4">
          <h3 className="text-sm font-semibold text-ink">Program custom fields</h3>
          <div className="mt-3">
            <CustomFieldInputs
              fields={fields}
              values={customFields}
              onChange={(key, value) => setCustomFields((current) => ({ ...current, [key]: value }))}
              emptyText="None yet. Use Custom fields in the programs section, then they show up on every program."
            />
          </div>
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
            {pending ? "Saving…" : "Save program"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
